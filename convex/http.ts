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
// ELEVENLABS WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify ElevenLabs webhook signature using HMAC-SHA256
 * Signature format: t=timestamp,v0=hash
 */
async function verifyElevenLabsSignature(
  signature: string,
  payload: string,
  secret: string
): Promise<boolean> {
  try {
    // Parse signature header: t=timestamp,v0=hash
    const parts = signature.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const hashPart = parts.find((p) => p.startsWith("v0="));

    if (!timestampPart || !hashPart) {
      console.error("Invalid signature format - missing parts");
      return false;
    }

    const timestamp = timestampPart.slice(2);
    const expectedHash = hashPart.slice(3);

    // Check timestamp is within 5 minutes to prevent replay attacks
    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > 300) {
      console.error("Webhook timestamp too old");
      return false;
    }

    // Compute HMAC-SHA256 of timestamp.payload
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );

    // Convert to hex
    const computedHash = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computedHash === expectedHash;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
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

      // Look up userId from conversation_id (for per-user Salesforce auth)
      // ElevenLabs passes its own conversation_id which we map to userId via the webhook
      let userId: string | undefined;

      // First try ElevenLabs conversation_id (mapped via conversation-start webhook)
      if (body.conversation_id) {
        const conversation = await ctx.runQuery(api.conversations.getConversationByElevenlabsId, {
          elevenlabsConversationId: body.conversation_id,
        });
        if (conversation?.userId) {
          userId = conversation.userId;
          console.log(`Found userId ${userId} from ElevenLabs conversation ${body.conversation_id}`);
        }
      }

      // Fall back to caller_phone if passed
      if (!userId && body.caller_phone) {
        const user = await ctx.runQuery(api.users.getUserByPhone, {
          phone: body.caller_phone,
        });
        if (user) {
          userId = user._id;
        }
      }

      // Fall back to user_id if passed directly
      if (!userId && body.user_id) {
        userId = body.user_id;
      }

      // Call the AI-powered action
      const result = await ctx.runAction(api.ai.askSalesforce, {
        userMessage,
        conversationHistory: body.conversation_history,
        userId: userId as any, // Pass userId for per-user Salesforce auth
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
        conversationId: body.conversation_id,
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
        conversationId: body.conversation_id,
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
        conversationId: body.conversation_id,
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
        conversationId: body.conversation_id,
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
        conversationId: body.conversation_id,
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
        conversationId: body.conversation_id,
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
        conversationId: body.conversation_id,
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

/**
 * Get my accounts
 * Tool name in ElevenLabs: get_my_accounts
 */
http.route({
  path: "/tools/my-accounts",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    try {
      const body = await request.json();
      console.log("get_my_accounts called with:", body);

      // Log searching activity
      await logActivity(ctx, "searching", "Retrieving your accounts...", {
        toolName: "get_my_accounts",
        recordType: "Account",
        conversationId: body.conversation_id,
      });

      const result = await ctx.runAction(api.salesforce.getMyAccounts, {
        industry: body.industry,
        limit: body.limit,
        conversationId: body.conversation_id,
      }) as { accounts: any[]; count: number; userId: string; userName: string };

      // Log found
      await logActivity(ctx, "found", `Found ${result.count} account${result.count !== 1 ? 's' : ''}`, {
        toolName: "get_my_accounts",
        recordType: "Account",
        conversationId: body.conversation_id,
      });

      if (body.conversation_id) {
        await ctx.runMutation(internal.conversations.logToolCall, {
          conversationId: body.conversation_id,
          toolName: "get_my_accounts",
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
      console.error("get_my_accounts error:", error);
      await logActivity(ctx, "error", `Failed to get accounts: ${error.message}`, {
        toolName: "get_my_accounts",
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
 * Conversation initiation webhook - called when a conversation starts
 * This allows us to capture the ElevenLabs conversation_id and map it to the userId
 * passed via dynamic_variables from Twilio
 */
http.route({
  path: "/webhooks/elevenlabs/conversation-start",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      console.log("ElevenLabs conversation-start webhook:", JSON.stringify(body, null, 2));

      // ElevenLabs sends conversation_id and dynamic_variables
      const conversationId = body?.conversation_id;
      const dynamicVars = body?.dynamic_variables || body?.conversation_initiation_client_data?.dynamic_variables;

      if (conversationId && dynamicVars) {
        const callerPhone = dynamicVars.caller_phone;
        const userId = dynamicVars.user_id;
        const userName = dynamicVars.user_name;

        console.log("Mapping ElevenLabs conversation:", {
          conversationId,
          callerPhone,
          userId,
          userName,
        });

        // Store the mapping - update the conversation with ElevenLabs ID
        if (userId) {
          await ctx.runMutation(internal.conversations.updateElevenlabsConversationId, {
            elevenlabsConversationId: conversationId,
            userId,
            callerPhone,
          });
        }
      }

      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("ElevenLabs conversation-start error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * Post-call webhook - called when a conversation ends
 * Captures all ElevenLabs analytics data including:
 * - Transcript and summary
 * - Call metadata (duration, cost, phone numbers)
 * - Success evaluation results
 * - Data collection (extracted structured data)
 * - Dynamic variables that were passed
 */
http.route({
  path: "/webhooks/elevenlabs/post-call",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const rawBody = await request.text();
      const body = JSON.parse(rawBody);
      console.log("ElevenLabs post-call webhook:", JSON.stringify(body, null, 2));

      // Validate webhook signature
      const signature = request.headers.get("elevenlabs-signature");
      const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;

      if (webhookSecret && signature) {
        const isValid = await verifyElevenLabsSignature(signature, rawBody, webhookSecret);
        if (!isValid) {
          console.error("Invalid ElevenLabs webhook signature");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        console.log("ElevenLabs webhook signature verified");
      }

      // ElevenLabs sends: { type, event_timestamp, data }
      // Some webhook variants nest the payload at `data.data`; prefer that if present.
      const data = body?.data?.data ?? body?.data;
      const conversationId: string | undefined = data?.conversation_id;
      if (!conversationId) {
        return new Response(JSON.stringify({ error: "Missing data.conversation_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // ============================================================================
      // TRANSCRIPT
      // ============================================================================
      const transcriptRaw = data?.transcript;
      const transcript =
        typeof transcriptRaw === "string" ? transcriptRaw : JSON.stringify(transcriptRaw ?? null);

      // Count turns in transcript
      const turnCount = Array.isArray(transcriptRaw) ? transcriptRaw.length : undefined;

      // ============================================================================
      // METADATA
      // ============================================================================
      const metadata = data?.metadata || {};
      const startTimeUnixSecs: number | undefined = metadata?.start_time_unix_secs;
      const callDurationSecs: number | undefined = metadata?.call_duration_secs;
      const startTime =
        typeof startTimeUnixSecs === "number" ? startTimeUnixSecs * 1000 : undefined;
      const endTime =
        typeof startTimeUnixSecs === "number" && typeof callDurationSecs === "number"
          ? (startTimeUnixSecs + callDurationSecs) * 1000
          : Date.now();

      // Cost in cents (ElevenLabs may send as dollars or cents)
      const costRaw = metadata?.cost ?? metadata?.total_cost;
      const costCents = typeof costRaw === "number"
        ? (costRaw < 1 ? Math.round(costRaw * 100) : Math.round(costRaw))
        : undefined;

      // Phone numbers
      const callerPhone = metadata?.caller_id || metadata?.from_number;
      const calledNumber = metadata?.called_number || metadata?.to_number;

      // ============================================================================
      // ANALYSIS
      // ============================================================================
      const analysis = data?.analysis || {};
      const summary: string | undefined = analysis?.transcript_summary;

      // Success Evaluation
      let successEvaluation: { success: boolean; criteriaResults?: any[] } | undefined;
      if (analysis?.evaluation_criteria_results || analysis?.success_evaluation !== undefined) {
        const evalResults = analysis?.evaluation_criteria_results;
        const isSuccess = analysis?.success_evaluation ??
          (evalResults ? evalResults.every((r: any) => r.result === "success") : undefined);

        successEvaluation = {
          success: Boolean(isSuccess),
          criteriaResults: evalResults?.map((r: any) => ({
            criterionId: r.criterion_id || r.id || "",
            name: r.name || r.criterion || "",
            result: r.result || "unknown",
            rationale: r.rationale || r.reason,
          })),
        };
      }

      // Data Collection - extracted structured data
      const dataCollection = analysis?.data_collection || analysis?.collected_data;

      // Sentiment (if available)
      const sentiment = analysis?.sentiment || analysis?.user_sentiment;

      // ============================================================================
      // DYNAMIC VARIABLES (what was passed to ElevenLabs)
      // ============================================================================
      const dynamicVariables = data?.conversation_initiation_client_data?.dynamic_variables ||
        data?.dynamic_variables;

      // ============================================================================
      // AGENT INFO
      // ============================================================================
      const elevenlabsAgentId = data?.agent_id;

      // ============================================================================
      // COMPLETE THE CONVERSATION
      // ============================================================================
      const result = await ctx.runMutation(internal.conversations.completeConversation, {
        conversationId,
        transcript,
        summary,
        startTime,
        endTime,
        durationSeconds: callDurationSecs,
        callerPhone,
        // New analytics fields
        elevenlabsAgentId,
        calledNumber,
        costCents,
        successEvaluation,
        dataCollection,
        dynamicVariables,
        sentiment,
        turnCount,
      });

      console.log("Conversation completed with analytics:", {
        conversationId,
        costCents,
        turnCount,
        hasSuccessEvaluation: !!successEvaluation,
        hasDataCollection: !!dataCollection,
        hasDynamicVariables: !!dynamicVariables,
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

      return new Response(JSON.stringify({ status: "received", conversationId }), {
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
      // Pass dynamic variables for user context (caller_phone, user_id, user_name)
      const dynamicVars = encodeURIComponent(JSON.stringify({
        caller_phone: from,
        user_id: user._id,
        user_name: user.name,
      }));
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Welcome back, ${user.name.split(" ")[0]}. Connecting you to your assistant.</Say>
  <Connect>
    <ConversationalAi url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}&amp;dynamic_variables=${dynamicVars}" />
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
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsResponse()),
});

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
        return corsResponse({ error: "Email, name, and phone are required" }, 400);
      }

      // Check if email already exists
      const existingUser = await ctx.runQuery(api.users.getUserByEmail, { email });
      if (existingUser) {
        return corsResponse({ error: "An account with this email already exists" }, 400);
      }

      // Start verification (creates code + sends SMS via SendBlue)
      const result = await ctx.runAction(api.sendblue.startVerification, {
        phone,
        email,
        name,
      });

      return corsResponse(result);
    } catch (error: any) {
      console.error("Signup start error:", error);
      return corsResponse({ error: error.message }, 500);
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

      const result = await ctx.runAction(api.sendblue.completeVerification, {
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
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsResponse()),
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
        return corsResponse({ error: "Phone is required" }, 400);
      }

      // Check if user exists with this phone
      const existingUser = await ctx.runQuery(api.users.getUserByPhone, { phone });
      if (!existingUser) {
        return corsResponse({ error: "No account found with this phone number. Please sign up first." }, 404);
      }

      // Start verification for existing user via SendBlue
      const result = await ctx.runAction(api.sendblue.startVerification, {
        phone,
      });

      return corsResponse({
        ...result,
        userId: existingUser._id,
        name: existingUser.name,
      });
    } catch (error: any) {
      console.error("Login start error:", error);
      return corsResponse({ error: error.message }, 500);
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

      // Send SMS via SendBlue
      const smsResult = await ctx.runAction(api.sendblue.sendVerificationSMS, {
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
        return corsResponse({ error: "userId query parameter required" }, 400);
      }

      const user = await ctx.runQuery(api.users.getUser, {
        userId: userId as any
      });

      if (!user) {
        return corsResponse({ error: "User not found" }, 404);
      }

      return corsResponse(user, 200);
    } catch (error: any) {
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

http.route({
  path: "/api/user",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsResponse()),
});

// ============================================================================
// ANALYTICS ENDPOINTS
// ============================================================================

/**
 * Get conversation stats
 * GET /api/analytics/stats?userId=xxx (optional)
 */
http.route({
  path: "/api/analytics/stats",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get("userId");

      const stats = await ctx.runQuery(api.conversations.getConversationStats, {
        userId: userId ? (userId as any) : undefined,
      });

      return corsResponse(stats);
    } catch (error: any) {
      console.error("Analytics stats error:", error);
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

/**
 * Get detailed analytics for a time period
 * GET /api/analytics/detailed?userId=xxx&days=30 (both optional)
 */
http.route({
  path: "/api/analytics/detailed",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get("userId");
      const days = url.searchParams.get("days");

      const analytics = await ctx.runQuery(api.conversations.getConversationAnalytics, {
        userId: userId ? (userId as any) : undefined,
        days: days ? parseInt(days, 10) : undefined,
      });

      return corsResponse(analytics);
    } catch (error: any) {
      console.error("Analytics detailed error:", error);
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

/**
 * Get list of conversations with analytics
 * GET /api/conversations?userId=xxx&limit=50 (both optional)
 */
http.route({
  path: "/api/conversations",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get("userId");
      const limit = url.searchParams.get("limit");

      const conversations = await ctx.runQuery(api.conversations.listConversations, {
        userId: userId ? (userId as any) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return corsResponse(conversations);
    } catch (error: any) {
      console.error("List conversations error:", error);
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

/**
 * Get single conversation with full details
 * GET /api/conversations/:conversationId
 */
http.route({
  path: "/api/conversation",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const conversationId = url.searchParams.get("id");

      if (!conversationId) {
        return corsResponse({ error: "id query parameter required" }, 400);
      }

      const conversation = await ctx.runQuery(api.conversations.getConversation, {
        conversationId,
      });

      if (!conversation) {
        return corsResponse({ error: "Conversation not found" }, 404);
      }

      return corsResponse(conversation);
    } catch (error: any) {
      console.error("Get conversation error:", error);
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

// ============================================================================
// ORG CREDENTIALS (Multi-tenant Connected App support)
// ============================================================================

/**
 * Register org credentials (OPTIONS preflight)
 */
http.route({
  path: "/api/org/register",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsResponse()),
});

/**
 * Register org's Connected App credentials
 * POST /api/org/register
 * Body: { instanceUrl, consumerKey, consumerSecret }
 */
http.route({
  path: "/api/org/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { instanceUrl, consumerKey, consumerSecret } = body;

      if (!instanceUrl || !consumerKey || !consumerSecret) {
        return corsResponse({ error: "instanceUrl, consumerKey, and consumerSecret are required" }, 400);
      }

      // Normalize instance URL (remove trailing slash, convert lightning to my.salesforce)
      let normalizedUrl = instanceUrl.replace(/\/$/, "");
      // Convert lightning.force.com to my.salesforce.com for consistency
      normalizedUrl = normalizedUrl.replace(".lightning.force.com", ".my.salesforce.com");

      // Check if credentials already exist for this org
      const existing = await ctx.runQuery(internal.orgCredentials.getByInstance, {
        instanceUrl: normalizedUrl,
      });

      if (existing) {
        // Update existing credentials
        await ctx.runMutation(internal.orgCredentials.update, {
          id: existing._id,
          consumerKey,
          consumerSecret,
        });
      } else {
        // Create new credentials
        await ctx.runMutation(internal.orgCredentials.create, {
          instanceUrl: normalizedUrl,
          consumerKey,
          consumerSecret,
        });
      }

      return corsResponse({
        success: true,
        instanceUrl: normalizedUrl,
        message: "Credentials saved successfully",
      });
    } catch (error: any) {
      console.error("Org register error:", error);
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

/**
 * Sync org metadata (custom objects, etc.)
 * POST /api/org/sync-metadata
 * Body: { userId } - sync metadata for this user's org
 */
http.route({
  path: "/api/org/sync-metadata",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsResponse()),
});

http.route({
  path: "/api/org/sync-metadata",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { userId } = body;

      if (!userId) {
        return corsResponse({ error: "userId is required" }, 400);
      }

      // Get user's Salesforce auth
      const auth = await ctx.runQuery(internal.salesforce.getAuthForUser, {
        userId: userId as any,
      });

      if (!auth) {
        return corsResponse({ error: "User has no Salesforce connection" }, 400);
      }

      // Sync metadata
      const result = await ctx.runAction(internal.orgMetadata.syncFromSalesforce, {
        accessToken: auth.accessToken,
        instanceUrl: auth.instanceUrl,
      });

      return corsResponse(result);
    } catch (error: any) {
      console.error("Sync metadata error:", error);
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

/**
 * Get org metadata (available objects for AI context)
 * GET /api/org/metadata?userId=xxx
 */
http.route({
  path: "/api/org/metadata",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsResponse()),
});

http.route({
  path: "/api/org/metadata",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get("userId");

      if (!userId) {
        return corsResponse({ error: "userId query param is required" }, 400);
      }

      const metadata = await ctx.runQuery(internal.orgMetadata.getAvailableObjects, {
        userId: userId as any,
      });

      return corsResponse(metadata);
    } catch (error: any) {
      console.error("Get metadata error:", error);
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

// ============================================================================
// SALESFORCE OAUTH (Multi-tenant - works from web app or Salesforce LWC)
// ============================================================================

/**
 * Web-based OAuth initiation (for self-service signup)
 * Called from the TalkCRM web app to connect a user's Salesforce
 */
http.route({
  path: "/auth/salesforce/connect",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get("user_id");
      const returnUrl = url.searchParams.get("return_url") || process.env.TALKCRM_WEB_URL || "";

      const clientId = process.env.SALESFORCE_CLIENT_ID!;
      const redirectUri = process.env.SALESFORCE_REDIRECT_URI!;

      // Store return info in state
      const state = btoa(JSON.stringify({
        source: "web",
        userId,
        returnUrl,
      }));

      // Build Salesforce OAuth URL
      const loginDomain = process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com";
      const authUrl = new URL(`${loginDomain}/services/oauth2/authorize`);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", "api refresh_token");
      authUrl.searchParams.set("state", state);

      return new Response(null, {
        status: 302,
        headers: { Location: authUrl.toString() },
      });
    } catch (error: any) {
      console.error("OAuth connect error:", error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }),
});

/**
 * Initiate OAuth flow from Salesforce LWC (package flow)
 * Called by the TalkCRM Setup wizard in the Salesforce package
 * Uses per-org Connected App credentials for multi-tenant support
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

      if (!instanceUrl) {
        return new Response("Missing instance_url parameter", { status: 400 });
      }

      // Normalize instance URL
      let normalizedUrl = instanceUrl.replace(/\/$/, "");
      normalizedUrl = normalizedUrl.replace(".lightning.force.com", ".my.salesforce.com");

      // Look up org credentials
      const orgCreds = await ctx.runQuery(internal.orgCredentials.getByInstance, {
        instanceUrl: normalizedUrl,
      });

      if (!orgCreds) {
        // Return helpful error for unconfigured org
        return new Response(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>TalkCRM - Setup Required</title>
</head>
<body style="font-family: sans-serif; padding: 40px; text-align: center;">
  <h1>Connected App Not Configured</h1>
  <p>No credentials found for: <strong>${normalizedUrl}</strong></p>
  <p>Please complete Step 1 in the TalkCRM Setup wizard to configure your Connected App credentials.</p>
  <a href="${callbackUrl}" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #0176d3; color: white; text-decoration: none; border-radius: 4px;">Back to Setup</a>
</body>
</html>`,
          { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      }

      const clientId = orgCreds.consumerKey;
      const redirectUri = process.env.SALESFORCE_REDIRECT_URI!;

      // Store the callback URL and instance URL in state parameter (base64 encoded)
      const state = btoa(JSON.stringify({
        source: "salesforce",
        callbackUrl,
        instanceUrl: normalizedUrl,
      }));

      // Build Salesforce OAuth URL - use the org's My Domain URL for org-specific login
      const authUrl = new URL(`${normalizedUrl}/services/oauth2/authorize`);
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
 * Uses per-org Connected App credentials for multi-tenant support
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

      // Parse state to get instanceUrl for per-org credentials
      let stateData: any = {};
      if (state) {
        try {
          stateData = JSON.parse(atob(state));
        } catch (e) {
          console.error("Failed to parse state:", e);
        }
      }

      const redirectUri = process.env.SALESFORCE_REDIRECT_URI!;
      let clientId: string;
      let clientSecret: string;
      let tokenEndpoint: string;

      // Check if this is a per-org flow (from Salesforce LWC) or legacy flow
      if (stateData.instanceUrl && stateData.source === "salesforce") {
        // Per-org flow - look up credentials
        const orgCreds = await ctx.runQuery(internal.orgCredentials.getByInstance, {
          instanceUrl: stateData.instanceUrl,
        });

        if (!orgCreds) {
          return new Response(`No credentials found for org: ${stateData.instanceUrl}`, { status: 400 });
        }

        clientId = orgCreds.consumerKey;
        clientSecret = orgCreds.consumerSecret;
        tokenEndpoint = `${stateData.instanceUrl}/services/oauth2/token`;
      } else {
        // Legacy flow - use env vars (for web app or backward compatibility)
        clientId = process.env.SALESFORCE_CLIENT_ID!;
        clientSecret = process.env.SALESFORCE_CLIENT_SECRET!;
        const loginDomain = process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com";
        tokenEndpoint = `${loginDomain}/services/oauth2/token`;
      }

      // Exchange code for tokens
      const tokenResponse = await fetch(
        tokenEndpoint,
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

      // Sync org metadata (custom objects, etc.) for AI context
      // Run async - don't block the OAuth callback
      ctx.runAction(internal.orgMetadata.syncFromSalesforce, {
        accessToken: tokens.access_token,
        instanceUrl: tokens.instance_url,
      }).then((result) => {
        console.log("Org metadata sync result:", result);
      }).catch((error) => {
        console.error("Org metadata sync failed:", error);
      });

      // Handle different OAuth sources (stateData already parsed above)
      if (stateData.source === "web") {
        // Web app flow - redirect back to web app
        const returnUrl = stateData.returnUrl || "/";
        const separator = returnUrl.includes("?") ? "&" : "?";
        const redirectUrl = `${returnUrl}${separator}sf_connected=true&user_id=${userId}`;

        return new Response(null, {
          status: 302,
          headers: { Location: redirectUrl },
        });
      }

      // Salesforce LWC flow - show success page and redirect back
      const salesforceUrl = stateData.callbackUrl || "";
      const redirectUrl = salesforceUrl ? `${salesforceUrl}#talkcrm_user_id=${userId}&talkcrm_email=${encodeURIComponent(userInfo.email)}` : "";

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
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
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }),
});

// ============================================================================
// SENDBLUE WEBHOOKS (AI-powered text messaging)
// ============================================================================

/**
 * Verify SendBlue webhook signature using HMAC-SHA256
 */
async function verifySendBlueSignature(request: Request, bodyText: string): Promise<boolean> {
  const secret = process.env.SENDBLUE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("SENDBLUE_WEBHOOK_SECRET not configured - skipping verification");
    return true; // Allow in dev mode
  }

  const signature = request.headers.get("x-sendblue-signature") ||
                    request.headers.get("sendblue-signature") ||
                    request.headers.get("X-Sendblue-Signature");

  if (!signature) {
    // SendBlue doesn't always send signature headers - allow but warn
    console.warn("No SendBlue signature header found - allowing request");
    return true;
  }

  // SendBlue uses HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const expectedSignature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const isValid = signature === expectedSignature;
  if (!isValid) {
    console.log("Signature mismatch:", { received: signature, expected: expectedSignature });
  }
  return isValid;
}

/**
 * SendBlue incoming message webhook
 * Called when a user texts the TalkCRM number
 * Identifies user, processes with AI, and sends response
 */
http.route({
  path: "/webhooks/sendblue/incoming",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Read body as text first for signature verification
      const bodyText = await request.text();

      // Verify webhook signature
      const isValid = await verifySendBlueSignature(request, bodyText);
      if (!isValid) {
        console.error("Invalid SendBlue webhook signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = JSON.parse(bodyText);
      console.log("SendBlue incoming message:", body);

      // SendBlue webhook payload:
      // {
      //   accountEmail, content, is_outbound, status, error_code, error_message,
      //   message_handle, date_sent, date_updated, from_number, number, to_number,
      //   was_downgraded, plan, media_url, message_type, group_id, participants,
      //   send_style, opted_out, sendblue_number, service
      // }

      const fromNumber = body.from_number || body.number;
      const toNumber = body.to_number || body.sendblue_number;
      const content = body.content;
      const messageHandle = body.message_handle;
      const mediaUrl = body.media_url;
      const isOutbound = body.is_outbound;

      // Ignore outbound messages (our own sends)
      if (isOutbound) {
        console.log("Ignoring outbound message");
        return new Response(JSON.stringify({ status: "ignored", reason: "outbound" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Ignore empty messages
      if (!content && !mediaUrl) {
        console.log("Ignoring empty message");
        return new Response(JSON.stringify({ status: "ignored", reason: "empty" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if user opted out
      if (body.opted_out) {
        console.log("User has opted out:", fromNumber);
        return new Response(JSON.stringify({ status: "ignored", reason: "opted_out" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Identify user by phone number
      const user = await ctx.runQuery(internal.users.getUserByPhoneInternal, {
        phone: fromNumber,
      });

      if (!user) {
        console.log("Unregistered texter:", fromNumber);

        // Send registration instructions
        await ctx.runAction(api.sendblue.sendMessage, {
          to: fromNumber,
          content: "Welcome! To use TalkCRM via text, please sign up at talkcrm.com and verify this phone number. Once registered, you can text me to manage your Salesforce data.",
          fromNumber: toNumber,
        });

        return new Response(JSON.stringify({ status: "unregistered" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check user status
      if (user.status !== "active") {
        await ctx.runAction(api.sendblue.sendMessage, {
          to: fromNumber,
          content: `Your TalkCRM account is currently ${user.status}. Please contact support for assistance.`,
          fromNumber: toNumber,
        });

        return new Response(JSON.stringify({ status: "inactive_user" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      console.log("Authenticated texter:", { userId: user._id, name: user.name });

      // Log activity
      await logActivity(ctx, "thinking", `Text from ${user.name}: "${content?.slice(0, 30)}${content?.length > 30 ? '...' : ''}"`, {
        toolName: "ai_text",
      });

      // Process the message with AI using scheduler to ensure it runs
      await ctx.scheduler.runAfter(0, internal.sendblue.processIncomingText, {
        userId: user._id,
        userPhone: fromNumber,
        sendblueNumber: toNumber,
        messageContent: content || "[Media message]",
        messageHandle: messageHandle,
        mediaUrl: mediaUrl,
      });

      // Respond immediately to acknowledge receipt
      return new Response(JSON.stringify({ status: "processing" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("SendBlue incoming webhook error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * SendBlue message status callback webhook
 * Called when message status changes (QUEUED, SENT, DELIVERED, READ, ERROR)
 */
http.route({
  path: "/webhooks/sendblue/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Read body as text first for signature verification
      const bodyText = await request.text();

      // Verify webhook signature
      const isValid = await verifySendBlueSignature(request, bodyText);
      if (!isValid) {
        console.error("Invalid SendBlue webhook signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = JSON.parse(bodyText);
      console.log("SendBlue status callback:", body);

      // SendBlue status callback payload:
      // {
      //   message_handle, status, error_code, error_message,
      //   date_sent, date_updated, to_number, from_number, service
      // }

      const messageHandle = body.message_handle;
      const status = body.status;
      const errorMessage = body.error_message;
      const service = body.service;

      if (!messageHandle) {
        return new Response(JSON.stringify({ error: "Missing message_handle" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Map SendBlue status to our status
      const statusMap: Record<string, "pending" | "queued" | "sent" | "delivered" | "read" | "failed"> = {
        "REGISTERED": "pending",
        "PENDING": "pending",
        "QUEUED": "queued",
        "ACCEPTED": "queued",
        "SENT": "sent",
        "DELIVERED": "delivered",
        "READ": "read",
        "ERROR": "failed",
        "DECLINED": "failed",
      };

      const mappedStatus = statusMap[status] || "pending";

      // Update message status in database
      await ctx.runMutation(internal.textMessages.updateMessageStatus, {
        messageHandle,
        status: mappedStatus,
        errorMessage: errorMessage || undefined,
        service: service as "iMessage" | "SMS" | undefined,
      });

      return new Response(JSON.stringify({ status: "updated" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("SendBlue status webhook error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * SendBlue call logs webhook
 * Called when a call is made to/from a SendBlue number
 */
http.route({
  path: "/webhooks/sendblue/call-logs",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const bodyText = await request.text();
      const isValid = await verifySendBlueSignature(request, bodyText);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = JSON.parse(bodyText);
      console.log("SendBlue call log:", body);

      // Log call activity for tracking
      await logActivity(ctx, "found", `Call log: ${body.from_number} -> ${body.to_number} (${body.duration || 0}s)`, {
        toolName: "sendblue_call",
      });

      return new Response(JSON.stringify({ status: "received" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("SendBlue call logs webhook error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * SendBlue line blocked webhook
 * Called when a recipient blocks messages from the SendBlue number
 */
http.route({
  path: "/webhooks/sendblue/line-blocked",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const bodyText = await request.text();
      const isValid = await verifySendBlueSignature(request, bodyText);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = JSON.parse(bodyText);
      console.log("SendBlue line blocked:", body);

      const blockedNumber = body.number || body.to_number;

      // Find user by phone and mark as blocked
      if (blockedNumber) {
        const user = await ctx.runQuery(internal.users.getUserByPhoneInternal, {
          phone: blockedNumber,
        });

        if (user) {
          console.log(`User ${user._id} blocked SendBlue number`);
          await logActivity(ctx, "error", `Line blocked by ${blockedNumber}`, {
            toolName: "sendblue_blocked",
          });
        }
      }

      return new Response(JSON.stringify({ status: "received" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("SendBlue line blocked webhook error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * SendBlue line assigned webhook
 * Called when a new phone number is assigned to the SendBlue account
 */
http.route({
  path: "/webhooks/sendblue/line-assigned",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const bodyText = await request.text();
      const isValid = await verifySendBlueSignature(request, bodyText);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = JSON.parse(bodyText);
      console.log("SendBlue line assigned:", body);

      const assignedNumber = body.number || body.phone_number;

      await logActivity(ctx, "success", `New SendBlue line assigned: ${assignedNumber}`, {
        toolName: "sendblue_line",
      });

      return new Response(JSON.stringify({ status: "received" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("SendBlue line assigned webhook error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * SendBlue outbound messages webhook
 * Called when a message is sent from the SendBlue dashboard or API
 * This is separate from status updates - it's for tracking all outbound sends
 */
http.route({
  path: "/webhooks/sendblue/outbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const bodyText = await request.text();
      const isValid = await verifySendBlueSignature(request, bodyText);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = JSON.parse(bodyText);
      console.log("SendBlue outbound message:", body);

      // Log for audit trail - these are messages we sent
      const toNumber = body.to_number || body.number;
      const content = body.content || "";

      await logActivity(ctx, "success", `Outbound text to ${toNumber}: "${content.slice(0, 30)}${content.length > 30 ? '...' : ''}"`, {
        toolName: "sendblue_outbound",
      });

      return new Response(JSON.stringify({ status: "received" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("SendBlue outbound webhook error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * SendBlue contact created webhook
 * Called when a new contact is created in SendBlue
 */
http.route({
  path: "/webhooks/sendblue/contact-created",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const bodyText = await request.text();
      const isValid = await verifySendBlueSignature(request, bodyText);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = JSON.parse(bodyText);
      console.log("SendBlue contact created:", body);

      const contactNumber = body.number || body.phone_number;
      const contactName = body.name || body.first_name || "";

      await logActivity(ctx, "creating", `SendBlue contact created: ${contactName || contactNumber}`, {
        toolName: "sendblue_contact",
      });

      return new Response(JSON.stringify({ status: "received" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("SendBlue contact created webhook error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ============================================================================
// ADMIN ENDPOINTS (temporary - for testing)
// ============================================================================

/**
 * Create or activate a user account
 * POST /admin/activate-user
 */
http.route({
  path: "/admin/activate-user",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { email, phone, name } = body;
      console.log("Admin user request:", { email, phone, name });

      if (!email) {
        return corsResponse({ error: "email required" }, 400);
      }

      // Get user by email
      let user = await ctx.runQuery(api.users.getUserByEmail, { email });

      if (!user && phone && name) {
        // Create new user with phone already verified
        const result = await ctx.runMutation(api.users.createUser, {
          email,
          name,
          phone,
        });
        user = await ctx.runQuery(api.users.getUserByEmail, { email });
      }

      if (!user) {
        return corsResponse({ error: "User not found. Provide email, phone, and name to create." }, 404);
      }

      // Activate user
      await ctx.runMutation(internal.users.activateUser, { userId: user._id });

      return corsResponse({
        success: true,
        message: `User ${user.email} activated`,
        status: "active",
        userId: user._id
      });
    } catch (error: any) {
      console.error("Activate user error:", error);
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

http.route({
  path: "/admin/activate-user",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsResponse()),
});

/**
 * Force refresh Salesforce token
 * POST /admin/refresh-token
 */
http.route({
  path: "/admin/refresh-token",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const email = body.email;

      if (!email) {
        return corsResponse({ error: "email required" }, 400);
      }

      const user = await ctx.runQuery(api.users.getUserByEmail, { email });
      if (!user) {
        return corsResponse({ error: "User not found" }, 404);
      }

      // Force a Salesforce API call which will trigger refresh if needed
      const result = await ctx.runAction(api.salesforce.getMyOpportunities, {
        userId: user._id,
      });

      return corsResponse({
        success: true,
        message: "Token refreshed/validated",
        opportunitiesFound: result?.opportunities?.length || 0,
      });
    } catch (error: any) {
      console.error("Refresh token error:", error);
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

http.route({
  path: "/admin/refresh-token",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsResponse()),
});

/**
 * Check user auth status
 * GET /admin/check-auth?email=...
 */
http.route({
  path: "/admin/check-auth",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const email = url.searchParams.get("email");

      if (!email) {
        return corsResponse({ error: "email required" }, 400);
      }

      const user = await ctx.runQuery(api.users.getUserByEmail, { email });
      if (!user) {
        return corsResponse({ error: "User not found", email }, 404);
      }

      // Check for Salesforce auth
      const auth = await ctx.runQuery(internal.salesforce.getAuthForUser, { userId: user._id });

      return corsResponse({
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          status: user.status,
          phones: user.verifiedPhones,
        },
        salesforceAuth: auth ? {
          hasAuth: true,
          instanceUrl: auth.instanceUrl,
          hasAccessToken: !!auth.accessToken,
          hasRefreshToken: !!auth.refreshToken,
          expiresAt: auth.expiresAt,
          isExpired: auth.expiresAt ? auth.expiresAt < Date.now() : null,
        } : {
          hasAuth: false,
        }
      });
    } catch (error: any) {
      console.error("Check auth error:", error);
      return corsResponse({ error: error.message }, 500);
    }
  }),
});

// ============================================================================
// ELEVENLABS WIDGET EMBED PAGE
// Serves an HTML page that can be embedded in Salesforce LWC via iframe
// ============================================================================

/**
 * ElevenLabs ConvAI Widget Page
 * GET /widget/elevenlabs
 * Returns an HTML page with the ElevenLabs conversational AI widget
 */
http.route({
  path: "/widget/elevenlabs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    // Allow passing a custom agent ID, or use default from env
    const agentId = url.searchParams.get("agent_id") || process.env.ELEVENLABS_AGENT_ID || "";

    // Optional dynamic variables from query params
    const userPhone = url.searchParams.get("phone") || "";
    const userId = url.searchParams.get("user_id") || "";
    const userName = url.searchParams.get("user_name") || "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TalkCRM Voice Assistant</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .widget-container {
      width: 100%;
      max-width: 400px;
      padding: 20px;
      text-align: center;
    }
    .widget-title {
      color: #1a1a2e;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .widget-subtitle {
      color: #666;
      font-size: 14px;
      margin-bottom: 24px;
    }
    elevenlabs-convai {
      display: block;
      width: 100%;
    }
    .powered-by {
      margin-top: 20px;
      font-size: 12px;
      color: #999;
    }
    .powered-by a {
      color: #0176d3;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="widget-container">
    <elevenlabs-convai
      agent-id="${agentId}"
      ${userPhone ? `data-caller-phone="${userPhone}"` : ''}
      ${userId ? `data-user-id="${userId}"` : ''}
      ${userName ? `data-user-name="${userName}"` : ''}
    ></elevenlabs-convai>
    <p class="powered-by">Powered by <a href="https://talkcrm.com" target="_blank">TalkCRM</a></p>
  </div>
  <script src="https://unpkg.com/@elevenlabs/convai-widget-embed@beta" async type="text/javascript"></script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "ALLOWALL",
        "Content-Security-Policy": "frame-ancestors *",
      },
    });
  }),
});

export default http;
