import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

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

      // Call the AI-powered action
      const result = await ctx.runAction(api.ai.askSalesforce, {
        userMessage,
        conversationHistory: body.conversation_history,
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

      const result = await ctx.runAction(api.salesforce.searchRecords, {
        query: query || "",
        objectType: object_type,
        limit: limit || 10,
      });

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

      const result = await ctx.runAction(api.salesforce.createRecord, {
        objectType: object_type,
        fields: fields,
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

      const result = await ctx.runAction(api.salesforce.updateRecord, {
        recordId: record_id,
        objectType: object_type,
        fields: fields,
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

      const result = await ctx.runAction(api.salesforce.getMyTasks, {
        status: body.status,
        dueDate: body.due_date,
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

      const result = await ctx.runAction(api.salesforce.getMyOpportunities, {
        stage: body.stage,
        closeDate: body.close_date,
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
 * Returns TwiML to connect to ElevenLabs
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

      // Log conversation start
      await ctx.runMutation(internal.conversations.startConversation, {
        conversationId: callSid,
        callerPhone: from,
      });

      // Get the ElevenLabs agent ID from environment
      const agentId = process.env.ELEVENLABS_AGENT_ID;

      // Return TwiML to connect to ElevenLabs Conversational AI
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
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
  <Say>Sorry, there was an error connecting your call. Please try again later.</Say>
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
