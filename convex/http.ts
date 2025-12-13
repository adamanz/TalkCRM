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

      await ctx.runMutation(internal.conversations.completeConversation, {
        conversationId,
        transcript,
        summary,
        startTime,
        endTime,
      });

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
        return new Response(
          JSON.stringify({ error: "Phone and code are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const result = await ctx.runAction(api.twilio.completeVerification, {
        phone,
        code,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("Verification error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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
        return new Response(
          JSON.stringify({ error: "userId and phone are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
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

      return new Response(JSON.stringify({
        success: true,
        phone: verification.phone,
        expiresAt: verification.expiresAt,
        smsMode: smsResult.mode,
        ...(smsResult.mode === "dev" ? { code: verification.code } : {}),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("Add phone error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
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
// SALESFORCE OAUTH CALLBACK
// ============================================================================

/**
 * OAuth callback from Salesforce
 */
http.route({
  path: "/auth/salesforce/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get("code");

      if (!code) {
        return new Response("Missing authorization code", { status: 400 });
      }

      const clientId = process.env.SALESFORCE_CLIENT_ID!;
      const clientSecret = process.env.SALESFORCE_CLIENT_SECRET!;
      const redirectUri = process.env.SALESFORCE_REDIRECT_URI!;

      // Exchange code for tokens
      const tokenResponse = await fetch(
        "https://login.salesforce.com/services/oauth2/token",
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

      // Store tokens in database
      await ctx.runMutation(internal.salesforce.updateAuth, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        instanceUrl: tokens.instance_url,
        expiresAt: Date.now() + 7200 * 1000, // 2 hours
      });

      // Redirect to success page
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/?auth=success",
        },
      });
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }),
});

export default http;
