import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Helper to log activity to dashboard
type ActivityType = "thinking" | "searching" | "found" | "creating" | "updating" | "success" | "error";

async function logActivity(
  ctx: any,
  type: ActivityType,
  message: string,
  options?: {
    toolName?: string;
    recordId?: string;
    recordName?: string;
    recordType?: string;
    conversationId?: string;
  }
) {
  try {
    await ctx.runMutation(internal.activities.logActivityInternal, {
      type,
      message,
      ...options,
    });
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
}

const http = httpRouter();

// ============================================================================
// CORS HELPERS
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function corsOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// ============================================================================
// AI-POWERED SALESFORCE ASSISTANT (Primary Tool)
// Single intelligent endpoint that interprets natural language using Claude
// ============================================================================

/**
 * AI-powered Salesforce assistant
 * This is the PRIMARY tool for ElevenLabs - handles all natural language requests
 */
http.route({
  path: "/tools/assistant",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    try {
      const body = await request.json();
      console.log("AI assistant called with:", body);

      // ElevenLabs sends the user's message
      const userMessage = body.message || body.user_message || body.query || body.text || "";

      if (!userMessage) {
        return new Response(
          JSON.stringify({
            response: "I didn't catch that. Could you repeat your request?",
            error: "No message provided"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Log thinking activity
      await logActivity(ctx, "thinking", `Processing: "${userMessage.slice(0, 50)}${userMessage.length > 50 ? '...' : ''}"`, {
        toolName: "ai_assistant",
        conversationId: body.conversation_id,
      });

      // Call the AI-powered action
      const result = await ctx.runAction(api.ai.askSalesforce, {
        userMessage,
        conversationHistory: body.conversation_history,
      });

      // Log success with action details
      const actionType = result.action || "response";
      const successMessage = actionType === "search" ? `Found results` :
                            actionType === "query" ? `Retrieved data` :
                            actionType === "create" ? `Created record` :
                            actionType === "update" ? `Updated record` :
                            `Responded`;

      await logActivity(ctx, "success", successMessage, {
        toolName: "ai_assistant",
        conversationId: body.conversation_id,
      });

      // Log the tool call
      if (body.conversation_id) {
        await ctx.runMutation(internal.conversations.logToolCall, {
          conversationId: body.conversation_id,
          toolName: "ai_assistant",
          input: JSON.stringify({ message: userMessage }),
          output: JSON.stringify(result),
          success: true,
          durationMs: Date.now() - startTime,
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("AI assistant error:", error);
      await logActivity(ctx, "error", `Error: ${error.message}`, {
        toolName: "ai_assistant",
      });
      return new Response(
        JSON.stringify({
          response: "I'm having trouble right now. Let me try again.",
          error: error.message
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ============================================================================
// ELEVENLABS SERVER TOOL ENDPOINTS (Legacy - specific tools)
// These endpoints are called by ElevenLabs Conversational AI when the agent
// decides to use a tool. Each tool corresponds to a Salesforce operation.
// ============================================================================

/**
 * Search Salesforce records
 * Tool name in ElevenLabs: search_salesforce
 */
http.route({
  path: "/tools/search",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    try {
      const body = await request.json();
      console.log("search_salesforce called with:", body);

      // ElevenLabs sends tool parameters in the body
      const { query, object_type, limit } = body;

      // Log searching activity
      await logActivity(ctx, "searching", `Searching ${object_type || 'Salesforce'} for "${query}"`, {
        toolName: "search_salesforce",
        recordType: object_type,
        conversationId: body.conversation_id,
      });

      const result = await ctx.runAction(api.salesforce.searchRecords, {
        query: query || "",
        objectType: object_type,
        limit: limit || 10,
      }) as { records: any[]; totalSize: number };

      // Log found activity with record details
      if (result.records && result.records.length > 0) {
        const firstRecord = result.records[0];
        await logActivity(ctx, "found", `Found ${result.totalSize} ${object_type || 'record'}${result.totalSize !== 1 ? 's' : ''}`, {
          toolName: "search_salesforce",
          recordId: firstRecord.Id,
          recordName: firstRecord.Name,
          recordType: object_type || firstRecord.attributes?.type,
          conversationId: body.conversation_id,
        });
      } else {
        await logActivity(ctx, "found", `No ${object_type || 'records'} found for "${query}"`, {
          toolName: "search_salesforce",
          conversationId: body.conversation_id,
        });
      }

      // Log the tool call
      if (body.conversation_id) {
        await ctx.runMutation(internal.conversations.logToolCall, {
          conversationId: body.conversation_id,
          toolName: "search_salesforce",
          input: JSON.stringify(body),
          output: JSON.stringify(result),
          success: true,
          durationMs: Date.now() - startTime,
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("search_salesforce error:", error);
      await logActivity(ctx, "error", `Search failed: ${error.message}`, {
        toolName: "search_salesforce",
      });
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Get a specific record
 * Tool name in ElevenLabs: get_record
 */
http.route({
  path: "/tools/get-record",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    try {
      const body = await request.json();
      console.log("get_record called with:", body);

      // Accept both camelCase (from ElevenLabs) and snake_case
      const record_id = body.record_id || body.recordId;
      const object_type = body.object_type || body.objectType;
      const fields = body.fields;

      const result = await ctx.runAction(api.salesforce.getRecord, {
        recordId: record_id,
        objectType: object_type,
        fields: fields,
      });

      if (body.conversation_id) {
        await ctx.runMutation(internal.conversations.logToolCall, {
          conversationId: body.conversation_id,
          toolName: "get_record",
          input: JSON.stringify(body),
          output: JSON.stringify(result),
          success: true,
          durationMs: Date.now() - startTime,
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("get_record error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Create a new record
 * Tool name in ElevenLabs: create_record
 */
http.route({
  path: "/tools/create-record",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    try {
      const body = await request.json();
      console.log("create_record called with:", body);

      // Accept both camelCase (from ElevenLabs) and snake_case
      const object_type = body.object_type || body.objectType;
      const { object_type: _ot, objectType: _ot2, conversation_id: _cid, ...fields } = body;

      // Log creating activity
      const recordName = fields.Name || fields.Subject || fields.FirstName || 'new record';
      await logActivity(ctx, "creating", `Creating ${object_type}: ${recordName}`, {
        toolName: "create_record",
        recordType: object_type,
        conversationId: body.conversation_id,
      });

      const result = await ctx.runAction(api.salesforce.createRecord, {
        objectType: object_type,
        fields: fields,
      }) as { id: string; success: boolean };

      // Log success
      await logActivity(ctx, "success", `Created ${object_type} successfully`, {
        toolName: "create_record",
        recordId: result.id,
        recordName: recordName,
        recordType: object_type,
        conversationId: body.conversation_id,
      });

      if (body.conversation_id) {
        await ctx.runMutation(internal.conversations.logToolCall, {
          conversationId: body.conversation_id,
          toolName: "create_record",
          input: JSON.stringify(body),
          output: JSON.stringify(result),
          success: true,
          durationMs: Date.now() - startTime,
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("create_record error:", error);
      await logActivity(ctx, "error", `Failed to create record: ${error.message}`, {
        toolName: "create_record",
      });
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Update an existing record
 * Tool name in ElevenLabs: update_record
 */
http.route({
  path: "/tools/update-record",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    try {
      const body = await request.json();
      console.log("update_record called with:", body);

      // Accept both camelCase (from ElevenLabs) and snake_case
      const record_id = body.record_id || body.recordId;
      const object_type = body.object_type || body.objectType;
      const { record_id: _rid, recordId: _rid2, object_type: _ot, objectType: _ot2, conversation_id: _cid, ...fields } = body;

      // Log updating activity with what's being changed
      const fieldNames = Object.keys(fields).join(', ');
      await logActivity(ctx, "updating", `Updating ${object_type}: ${fieldNames}`, {
        toolName: "update_record",
        recordId: record_id,
        recordType: object_type,
        conversationId: body.conversation_id,
      });

      const result = await ctx.runAction(api.salesforce.updateRecord, {
        recordId: record_id,
        objectType: object_type,
        fields: fields,
      });

      // Log success
      await logActivity(ctx, "success", `Updated ${object_type} successfully`, {
        toolName: "update_record",
        recordId: record_id,
        recordType: object_type,
        conversationId: body.conversation_id,
      });

      if (body.conversation_id) {
        await ctx.runMutation(internal.conversations.logToolCall, {
          conversationId: body.conversation_id,
          toolName: "update_record",
          input: JSON.stringify(body),
          output: JSON.stringify(result),
          success: true,
          durationMs: Date.now() - startTime,
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("update_record error:", error);
      await logActivity(ctx, "error", `Failed to update record: ${error.message}`, {
        toolName: "update_record",
      });
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Log a call activity
 * Tool name in ElevenLabs: log_call
 */
http.route({
  path: "/tools/log-call",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    try {
      const body = await request.json();
      console.log("log_call called with:", body);

      const result = await ctx.runAction(api.salesforce.logCall, {
        whoId: body.who_id || body.contact_id || body.lead_id,
        whatId: body.what_id || body.account_id || body.opportunity_id,
        subject: body.subject || "Voice Call",
        description: body.description || body.notes,
        durationMinutes: body.duration_minutes,
      });

      if (body.conversation_id) {
        await ctx.runMutation(internal.conversations.logToolCall, {
          conversationId: body.conversation_id,
          toolName: "log_call",
          input: JSON.stringify(body),
          output: JSON.stringify(result),
          success: true,
          durationMs: Date.now() - startTime,
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("log_call error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Get my tasks
 * Tool name in ElevenLabs: get_my_tasks
 */
http.route({
  path: "/tools/my-tasks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    try {
      const body = await request.json();
      console.log("get_my_tasks called with:", body);

      // Log searching activity
      await logActivity(ctx, "searching", "Retrieving your tasks...", {
        toolName: "get_my_tasks",
        recordType: "Task",
        conversationId: body.conversation_id,
      });

      const result = await ctx.runAction(api.salesforce.getMyTasks, {
        status: body.status,
        dueDate: body.due_date,
      }) as { tasks: any[]; count: number };

      // Log found
      await logActivity(ctx, "found", `Found ${result.count} task${result.count !== 1 ? 's' : ''}`, {
        toolName: "get_my_tasks",
        recordType: "Task",
        conversationId: body.conversation_id,
      });

      if (body.conversation_id) {
        await ctx.runMutation(internal.conversations.logToolCall, {
          conversationId: body.conversation_id,
          toolName: "get_my_tasks",
          input: JSON.stringify(body),
          output: JSON.stringify(result),
          success: true,
          durationMs: Date.now() - startTime,
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("get_my_tasks error:", error);
      await logActivity(ctx, "error", `Failed to get tasks: ${error.message}`, {
        toolName: "get_my_tasks",
      });
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Get my opportunities/pipeline
 * Tool name in ElevenLabs: get_my_pipeline
 */
http.route({
  path: "/tools/my-pipeline",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    try {
      const body = await request.json();
      console.log("get_my_pipeline called with:", body);

      // Log searching activity
      await logActivity(ctx, "searching", "Retrieving your pipeline...", {
        toolName: "get_my_pipeline",
        recordType: "Opportunity",
        conversationId: body.conversation_id,
      });

      const result = await ctx.runAction(api.salesforce.getMyOpportunities, {
        stage: body.stage,
        closeDate: body.close_date,
      }) as { opportunities: any[]; summary: string; totalAmount?: number };

      // Log found with pipeline value
      const oppCount = result.opportunities?.length || 0;
      const totalVal = result.totalAmount ? `$${(result.totalAmount / 1000).toFixed(0)}k` : '';
      await logActivity(ctx, "found", `Found ${oppCount} opportunit${oppCount !== 1 ? 'ies' : 'y'} ${totalVal}`, {
        toolName: "get_my_pipeline",
        recordType: "Opportunity",
        conversationId: body.conversation_id,
      });

      if (body.conversation_id) {
        await ctx.runMutation(internal.conversations.logToolCall, {
          conversationId: body.conversation_id,
          toolName: "get_my_pipeline",
          input: JSON.stringify(body),
          output: JSON.stringify(result),
          success: true,
          durationMs: Date.now() - startTime,
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("get_my_pipeline error:", error);
      await logActivity(ctx, "error", `Failed to get pipeline: ${error.message}`, {
        toolName: "get_my_pipeline",
      });
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ============================================================================
// ELEVENLABS WEBHOOKS
// ============================================================================

/**
 * Post-call webhook - called when a conversation ends
 */
http.route({
  path: "/webhooks/elevenlabs/post-call",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      console.log("ElevenLabs post-call webhook:", body);

      // Validate webhook signature (optional but recommended)
      // const signature = request.headers.get("elevenlabs-signature");

      // ElevenLabs sends: { type, event_timestamp, data }
      const data = body?.data ?? body?.data?.data ?? body?.data;
      const conversationId: string | undefined = data?.conversation_id;
      if (!conversationId) {
        return new Response(JSON.stringify({ error: "Missing data.conversation_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Store transcript as a string in Convex for easy display + debugging.
      const transcriptRaw = data?.transcript;
      const transcript =
        typeof transcriptRaw === "string" ? transcriptRaw : JSON.stringify(transcriptRaw ?? null);

      const summary: string | undefined = data?.analysis?.transcript_summary;

      const startTimeUnixSecs: number | undefined = data?.metadata?.start_time_unix_secs;
      const callDurationSecs: number | undefined = data?.metadata?.call_duration_secs;
      const startTime =
        typeof startTimeUnixSecs === "number" ? startTimeUnixSecs * 1000 : undefined;
      const endTime =
        typeof startTimeUnixSecs === "number" && typeof callDurationSecs === "number"
          ? (startTimeUnixSecs + callDurationSecs) * 1000
          : Date.now();

      // Complete the conversation and get user info for recording
      const result = await ctx.runMutation(internal.conversations.completeConversation, {
        conversationId,
        transcript,
        summary,
        startTime,
        endTime,
        durationSeconds: callDurationSecs,
      });

      // Check for recording URL in ElevenLabs data and fetch it
      const recordingUrl: string | undefined = data?.recording_url || data?.audio_url;
      if (recordingUrl) {
        // Fetch and store the recording asynchronously
        ctx.runAction(api.recordings.fetchFromElevenLabs, {
          conversationId,
          audioUrl: recordingUrl,
          userId: result.userId,
          durationSeconds: callDurationSecs,
        }).catch((err: Error) => {
          console.error("Failed to fetch ElevenLabs recording:", err);
        });
      }

      return new Response(JSON.stringify({ status: "received" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("Post-call webhook error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ============================================================================
// TWILIO WEBHOOKS
// ============================================================================

/**
 * Twilio recording status callback
 * Called when a recording is ready to be downloaded
 */
http.route({
  path: "/webhooks/twilio/recording",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const formData = await request.formData();
      const recordingSid = formData.get("RecordingSid") as string;
      const recordingUrl = formData.get("RecordingUrl") as string;
      const callSid = formData.get("CallSid") as string;
      const recordingDuration = parseInt(formData.get("RecordingDuration") as string || "0", 10);
      const recordingStatus = formData.get("RecordingStatus") as string;

      console.log("Twilio recording callback:", {
        recordingSid,
        callSid,
        recordingStatus,
        recordingDuration,
      });

      // Only process completed recordings
      if (recordingStatus !== "completed" || !recordingUrl) {
        return new Response("OK", { status: 200 });
      }

      // Get conversation to find user ID
      const conversation = await ctx.runQuery(api.conversations.getConversation, {
        conversationId: callSid,
      });

      // Fetch and store the recording
      await ctx.runAction(api.recordings.fetchFromTwilio, {
        conversationId: callSid,
        recordingUrl,
        userId: conversation?.userId ?? undefined,
        durationSeconds: recordingDuration,
      });

      return new Response("OK", { status: 200 });
    } catch (error: any) {
      console.error("Twilio recording webhook error:", error);
      return new Response("Error", { status: 500 });
    }
  }),
});

/**
 * Twilio incoming call webhook
 * Performs Caller ID lookup to identify user, then connects to ElevenLabs
 */
http.route({
  path: "/webhooks/twilio/incoming",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const formData = await request.formData();
      const callSid = formData.get("CallSid") as string;
      const from = formData.get("From") as string;
      const to = formData.get("To") as string;

      console.log("Incoming call:", { callSid, from, to });

      // =========================================================
      // CALLER ID LOOKUP - Identify user by their phone number
      // =========================================================
      const user = await ctx.runQuery(internal.users.getUserByPhoneInternal, {
        phone: from,
      });

      // If caller is not registered, reject the call with instructions
      if (!user) {
        console.log("Unregistered caller:", from);
        const rejectTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    Sorry, this phone number is not registered with Talk CRM.
    Please visit talk crm dot com to create an account and verify your phone number.
    Goodbye.
  </Say>
  <Hangup />
</Response>`;
        return new Response(rejectTwiml, {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        });
      }

      // Check if user account is active
      if (user.status !== "active") {
        const suspendedTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    Your Talk CRM account is currently ${user.status}.
    Please contact support for assistance.
    Goodbye.
  </Say>
  <Hangup />
</Response>`;
        return new Response(suspendedTwiml, {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        });
      }

      console.log("Authenticated user:", { userId: user._id, name: user.name, email: user.email });

      // Log conversation start with user ID
      await ctx.runMutation(internal.conversations.startConversation, {
        conversationId: callSid,
        callerPhone: from,
        userId: user._id,
      });

      // Update user's last login
      await ctx.runMutation(internal.users.updateLastLogin, {
        userId: user._id,
      });

      // Get the ElevenLabs agent ID from environment
      const agentId = process.env.ELEVENLABS_AGENT_ID;

      // Return TwiML to connect to ElevenLabs Conversational AI
      // Include user context in the connection (ElevenLabs can use this)
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Welcome back, ${user.name.split(" ")[0]}. Connecting you to your assistant.</Say>
  <Connect>
    <ConversationalAi url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}" />
  </Connect>
</Response>`;

      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    } catch (error: any) {
      console.error("Twilio webhook error:", error);
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, there was an error connecting your call. Please try again later.</Say>
  <Hangup />
</Response>`;
      return new Response(errorTwiml, {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    }
  }),
});

// ============================================================================
// USER AUTHENTICATION API
// ============================================================================

/**
 * Start signup - sends verification code to phone
 * POST /api/auth/signup/start
 * Body: { email, name, phone }
 */
http.route({
  path: "/api/auth/signup/start",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { email, name, phone } = body;

      if (!email || !name || !phone) {
        return new Response(
          JSON.stringify({ error: "Email, name, and phone are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if email already exists
      const existingUser = await ctx.runQuery(api.users.getUserByEmail, { email });
      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "An account with this email already exists" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Start verification (creates code + sends SMS)
      const result = await ctx.runAction(api.twilio.startVerification, {
        phone,
        email,
        name,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("Signup start error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Complete signup/login - verify code (OPTIONS preflight)
 */
http.route({
  path: "/api/auth/verify",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsResponse()),
});

/**
 * Complete signup/login - verify code
 * POST /api/auth/verify
 * Body: { phone, code }
 */
http.route({
  path: "/api/auth/verify",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { phone, code } = body;

      if (!phone || !code) {
        return corsResponse({ error: "Phone and code are required" }, 400);
      }

      const result = await ctx.runAction(api.twilio.completeVerification, {
        phone,
        code,
      });

      return corsResponse(result);
    } catch (error: any) {
      console.error("Verification error:", error);
      return corsResponse({ error: error.message }, 400);
    }
  }),
});

/**
 * Login with phone - sends verification code
 * POST /api/auth/login/start
 * Body: { phone }
 */
http.route({
  path: "/api/auth/login/start",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { phone } = body;

      if (!phone) {
        return new Response(
          JSON.stringify({ error: "Phone is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if user exists with this phone
      const existingUser = await ctx.runQuery(api.users.getUserByPhone, { phone });
      if (!existingUser) {
        return new Response(
          JSON.stringify({ error: "No account found with this phone number. Please sign up first." }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Start verification for existing user
      const result = await ctx.runAction(api.twilio.startVerification, {
        phone,
      });

      return new Response(JSON.stringify({
        ...result,
        userId: existingUser._id,
        name: existingUser.name,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("Login start error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Add phone to existing user (OPTIONS preflight)
 */
http.route({
  path: "/api/auth/add-phone",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsResponse()),
});

/**
 * Add phone to existing user
 * POST /api/auth/add-phone
 * Body: { userId, phone }
 */
http.route({
  path: "/api/auth/add-phone",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { userId, phone } = body;

      if (!userId || !phone) {
        return corsResponse({ error: "userId and phone are required" }, 400);
      }

      // Start verification for adding phone
      const verification = await ctx.runMutation(api.users.startPhoneVerification, {
        phone,
        userId,
      });

      // Send SMS
      const smsResult = await ctx.runAction(api.twilio.sendVerificationSMS, {
        phone: verification.phone,
        code: verification.code,
      });

      return corsResponse({
        success: true,
        phone: verification.phone,
        expiresAt: verification.expiresAt,
        smsMode: smsResult.mode,
        ...(smsResult.mode === "dev" ? { code: verification.code } : {}),
      });
    } catch (error: any) {
      console.error("Add phone error:", error);
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

/**
 * Get current user profile
 * GET /api/user?userId=xxx
 */
http.route({
  path: "/api/user",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get("userId");

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "userId query parameter required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const user = await ctx.runQuery(api.users.getUser, {
        userId: userId as any
      });

      if (!user) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify(user), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ============================================================================
// SALESFORCE OAUTH (Package Flow)
// ============================================================================

/**
 * Initiate OAuth flow from Salesforce LWC
 * Called by the TalkCRM Setup wizard in the Salesforce package
 */
http.route({
  path: "/auth/salesforce/initiate",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const callbackUrl = url.searchParams.get("callback_url");
      const instanceUrl = url.searchParams.get("instance_url");

      if (!callbackUrl) {
        return new Response("Missing callback_url parameter", { status: 400 });
      }

      const clientId = process.env.SALESFORCE_CLIENT_ID!;
      const redirectUri = process.env.SALESFORCE_REDIRECT_URI!;

      // Store the callback URL in state parameter (base64 encoded)
      const state = btoa(JSON.stringify({
        callbackUrl,
        instanceUrl,
      }));

      // Build Salesforce OAuth URL (use My Domain URL for org-specific login)
      const loginDomain = process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com";
      const authUrl = new URL(`${loginDomain}/services/oauth2/authorize`);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", "api refresh_token");
      authUrl.searchParams.set("state", state);

      // Redirect to Salesforce OAuth
      return new Response(null, {
        status: 302,
        headers: {
          Location: authUrl.toString(),
        },
      });
    } catch (error: any) {
      console.error("OAuth initiate error:", error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }),
});

/**
 * OAuth callback from Salesforce
 * Creates/updates user and redirects back to Salesforce LWC
 */
http.route({
  path: "/auth/salesforce/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");

      // Log all params for debugging
      console.log("OAuth callback params:", {
        hasCode: !!code,
        hasState: !!state,
        error,
        errorDescription,
        fullUrl: request.url,
      });

      if (error) {
        return new Response(`Salesforce OAuth Error: ${error} - ${errorDescription || 'No description'}`, { status: 400 });
      }

      if (!code) {
        return new Response(`Missing authorization code. URL: ${request.url}`, { status: 400 });
      }

      const clientId = process.env.SALESFORCE_CLIENT_ID!;
      const clientSecret = process.env.SALESFORCE_CLIENT_SECRET!;
      const redirectUri = process.env.SALESFORCE_REDIRECT_URI!;

      // Exchange code for tokens
      const loginDomain = process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com";
      const tokenResponse = await fetch(
        `${loginDomain}/services/oauth2/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
          }),
        }
      );

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error("Token exchange failed:", error);
        return new Response(`Authentication failed: ${error}`, { status: 400 });
      }

      const tokens = await tokenResponse.json();

      // Get user info from Salesforce
      const userInfoResponse = await fetch(
        `${tokens.instance_url}/services/oauth2/userinfo`,
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
      );
      const userInfo = await userInfoResponse.json();

      // Find or create TalkCRM user by email
      let user = await ctx.runQuery(api.users.getUserByEmail, {
        email: userInfo.email,
      });

      let userId: string;

      if (!user) {
        // Create new user (without phone - will add in step 2)
        const result = await ctx.runMutation(internal.users.createUserWithoutPhone, {
          email: userInfo.email,
          name: userInfo.name || userInfo.preferred_username || "User",
        });
        userId = result.userId;
      } else {
        userId = user._id;
      }

      // Store Salesforce auth tokens for this user
      await ctx.runMutation(internal.salesforce.updateAuthForUser, {
        userId: userId as any,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        instanceUrl: tokens.instance_url,
        expiresAt: Date.now() + 7200 * 1000, // 2 hours
        salesforceUserId: userInfo.user_id,
      });

      // Parse state to get callback URL
      let salesforceUrl = "";
      if (state) {
        try {
          const stateData = JSON.parse(atob(state));
          salesforceUrl = stateData.callbackUrl || "";
        } catch (e) {
          console.error("Failed to parse state:", e);
        }
      }

      // Return an HTML page that stores data and redirects back to Salesforce
      const redirectUrl = salesforceUrl ? `${salesforceUrl}#talkcrm_user_id=${userId}&talkcrm_email=${encodeURIComponent(userInfo.email)}` : "";

      const html = `<!DOCTYPE html>
<html>
<head>
  <title>TalkCRM - Connected!</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .card { background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; }
    h1 { color: #22c55e; margin-bottom: 10px; }
    p { color: #666; margin-bottom: 20px; }
    .btn { background: #3b82f6; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn:hover { background: #2563eb; }
    .info { background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left; font-size: 14px; }
    .info strong { color: #1e40af; }
    .copy-btn { background: #e5e7eb; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-left: 8px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✓ Connected!</h1>
    <p>Your Salesforce account is now linked to TalkCRM.</p>
    <div class="info">
      <strong>Email:</strong> ${userInfo.email}<br><br>
      <strong>Your TalkCRM ID:</strong><br>
      <code id="userId">${userId}</code>
      <button class="copy-btn" onclick="navigator.clipboard.writeText('${userId}')">Copy</button>
    </div>
    <p style="font-size: 13px; color: #666;">Copy your ID above, then click continue and paste it when prompted.</p>
    <a href="${redirectUrl || '#'}" class="btn">Continue to Phone Setup →</a>
  </div>
</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }),
});

export default http;
