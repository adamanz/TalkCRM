import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// ============================================================================
// SENDBLUE SMS ACTIONS (Replaces Twilio for SMS verification)
// ============================================================================

/**
 * Send SMS verification code via SendBlue
 */
export const sendVerificationSMS = action({
  args: {
    phone: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.SENDBLUE_API_KEY;
    const apiSecret = process.env.SENDBLUE_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error("SendBlue credentials not configured");
      // In development, just log the code
      console.log(`[DEV MODE] Verification code for ${args.phone}: ${args.code}`);
      return {
        success: true,
        mode: "dev",
        message: "Code logged to console (SendBlue not configured)",
      };
    }

    const url = "https://api.sendblue.co/api/send-message";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "sb-api-key-id": apiKey,
          "sb-api-secret-key": apiSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: args.phone,
          content: `Your TalkCRM verification code is: ${args.code}. This code expires in 10 minutes.`,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("SendBlue SMS error:", error);
        throw new Error(`Failed to send SMS: ${error}`);
      }

      const result = await response.json();

      // SendBlue returns status in the response
      if (result.status === "ERROR" || result.error_code) {
        throw new Error(`SendBlue error: ${result.error_message || "Unknown error"}`);
      }

      return {
        success: true,
        mode: "production",
        messageHandle: result.message_handle,
        status: result.status,
      };
    } catch (error: any) {
      console.error("Failed to send SMS:", error);
      throw new Error(`SMS sending failed: ${error.message}`);
    }
  },
});

/**
 * Start phone verification flow (creates code + sends SMS)
 */
export const startVerification = action({
  args: {
    phone: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    phone: v.string(),
    expiresAt: v.number(),
    smsMode: v.string(),
    code: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    phone: string;
    expiresAt: number;
    smsMode: string;
    code?: string;
  }> => {
    // Create verification record and get code
    const verification = await ctx.runMutation(api.users.startPhoneVerification, {
      phone: args.phone,
      email: args.email,
      name: args.name,
    });

    // Send SMS with code via SendBlue
    const smsResult = await ctx.runAction(api.sendblue.sendVerificationSMS, {
      phone: verification.phone,
      code: verification.code,
    });

    return {
      success: true,
      phone: verification.phone,
      expiresAt: verification.expiresAt,
      smsMode: smsResult.mode,
      // In dev mode, include the code for testing
      ...(smsResult.mode === "dev" ? { code: verification.code } : {}),
    };
  },
});

/**
 * Verify code and complete signup/login
 */
export const completeVerification = action({
  args: {
    phone: v.string(),
    code: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    userId: v.id("users"),
    user: v.any(),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    userId: any;
    user: any;
  }> => {
    // Verify the code
    const result = await ctx.runMutation(api.users.verifyPhoneCode, {
      phone: args.phone,
      code: args.code,
    });

    // Update last login
    if (result.userId) {
      await ctx.runMutation(internal.users.updateLastLogin, {
        userId: result.userId,
      });
    }

    return result;
  },
});

// ============================================================================
// SENDBLUE MESSAGING ACTIONS (AI-powered text conversations)
// ============================================================================

/**
 * Send a text message via SendBlue (iMessage/SMS)
 */
export const sendMessage = action({
  args: {
    to: v.string(), // E.164 format
    content: v.string(),
    mediaUrl: v.optional(v.string()),
    fromNumber: v.optional(v.string()), // Optional: specific SendBlue number to send from
    statusCallback: v.optional(v.string()), // Webhook for delivery status
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.SENDBLUE_API_KEY;
    const apiSecret = process.env.SENDBLUE_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error("SendBlue credentials not configured");
      return {
        success: false,
        error: "SendBlue not configured",
        mode: "dev",
      };
    }

    const url = "https://api.sendblue.co/api/send-message";

    try {
      const payload: Record<string, any> = {
        number: args.to,
        content: args.content,
      };

      if (args.mediaUrl) {
        payload.media_url = args.mediaUrl;
      }

      if (args.fromNumber) {
        payload.from_number = args.fromNumber;
      }

      if (args.statusCallback) {
        payload.status_callback = args.statusCallback;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "sb-api-key-id": apiKey,
          "sb-api-secret-key": apiSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("SendBlue send error:", error);
        throw new Error(`Failed to send message: ${error}`);
      }

      const result = await response.json();

      if (result.status === "ERROR" || result.error_code) {
        throw new Error(`SendBlue error: ${result.error_message || "Unknown error"}`);
      }

      return {
        success: true,
        messageHandle: result.message_handle,
        status: result.status,
        service: result.service, // "iMessage" or "SMS"
      };
    } catch (error: any) {
      console.error("Failed to send message:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Send a typing indicator to show the AI is thinking
 * Shows animated dots on recipient's iMessage
 */
export const sendTypingIndicator = action({
  args: {
    to: v.string(), // Recipient phone (E.164 format)
    fromNumber: v.string(), // Your SendBlue number (E.164 format)
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.SENDBLUE_API_KEY;
    const apiSecret = process.env.SENDBLUE_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log("SendBlue not configured - skipping typing indicator");
      return { success: false, error: "SendBlue not configured" };
    }

    try {
      const response = await fetch("https://api.sendblue.co/api/send-typing-indicator", {
        method: "POST",
        headers: {
          "sb-api-key-id": apiKey,
          "sb-api-secret-key": apiSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: args.to,
          from_number: args.fromNumber,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.log("Typing indicator failed (non-critical):", error);
        return { success: false, error };
      }

      const result = await response.json();
      console.log("Typing indicator sent:", result.status);

      return {
        success: result.status === "SENT",
        status: result.status,
      };
    } catch (error: any) {
      // Non-critical - don't throw, just log
      console.log("Typing indicator error (non-critical):", error.message);
      return { success: false, error: error.message };
    }
  },
});

/**
 * Process incoming text message with AI and send response
 * This is the core AI text handler
 */
export const processIncomingText = internalAction({
  args: {
    userId: v.id("users"),
    userPhone: v.string(),
    sendblueNumber: v.string(),
    messageContent: v.string(),
    messageHandle: v.string(),
    mediaUrl: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    response: v.optional(v.string()),
    error: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; response?: string; error?: string; durationMs?: number }> => {
    const startTime = Date.now();

    try {
      // 1. Get or create text conversation
      const conversation = await ctx.runMutation(internal.textMessages.getOrCreateConversation, {
        userId: args.userId,
        userPhone: args.userPhone,
        sendblueNumber: args.sendblueNumber,
      });

      // 2. Log the incoming message
      await ctx.runMutation(internal.textMessages.logMessage, {
        conversationId: conversation._id,
        userId: args.userId,
        direction: "inbound",
        content: args.messageContent,
        messageHandle: args.messageHandle,
        mediaUrl: args.mediaUrl,
        status: "delivered",
      });

      // 3. Show typing indicator while AI thinks
      // Fire and forget - don't await, don't block on failure
      ctx.runAction(api.sendblue.sendTypingIndicator, {
        to: args.userPhone,
        fromNumber: args.sendblueNumber,
      }).catch(() => {}); // Ignore errors - typing indicator is nice-to-have

      // 4. Get recent conversation context (last 10 messages)
      const recentMessages = await ctx.runQuery(internal.textMessages.getRecentMessages, {
        conversationId: conversation._id,
        limit: 10,
      });

      // 5. Build conversation history for Claude
      const conversationHistory = recentMessages.map((msg: { direction: string; content: string }) => ({
        role: msg.direction === "inbound" ? "user" : "assistant",
        content: msg.content,
      }));

      // 6. Call AI to process the message (reuse existing Salesforce AI)
      const aiResult = await ctx.runAction(api.ai.askSalesforce, {
        userMessage: args.messageContent,
        conversationHistory: conversationHistory as any,
        userId: args.userId, // Pass userId for Salesforce auth lookup
      });

      // 7. Build response - append record link for create actions (text agent only)
      let responseContent = aiResult.response;
      if (aiResult.action === "create" && aiResult.recordUrl) {
        responseContent += `\n\nView in Salesforce: ${aiResult.recordUrl}`;
      }

      // 8. Send AI response via SendBlue
      const sendResult = await ctx.runAction(api.sendblue.sendMessage, {
        to: args.userPhone,
        content: responseContent,
        fromNumber: args.sendblueNumber,
      });

      // 8. Log the outgoing message
      await ctx.runMutation(internal.textMessages.logMessage, {
        conversationId: conversation._id,
        userId: args.userId,
        direction: "outbound",
        content: responseContent,
        messageHandle: sendResult.messageHandle,
        status: sendResult.success ? "sent" : "failed",
        service: (sendResult.service || undefined) as "iMessage" | "SMS" | undefined,
        aiProcessed: true,
        salesforceAction: aiResult.action,
      });

      // 9. Log activity for dashboard
      await ctx.runMutation(internal.activities.logActivityInternal, {
        type: "success",
        message: `Processed text: "${args.messageContent.slice(0, 30)}${args.messageContent.length > 30 ? "..." : ""}"`,
        toolName: "ai_text",
      });

      console.log(`Text processed in ${Date.now() - startTime}ms`);
      return {
        success: true,
        response: aiResult.response,
      };
    } catch (error: any) {
      console.error("Error processing incoming text:", error);

      // Send error response to user
      try {
        await ctx.runAction(api.sendblue.sendMessage, {
          to: args.userPhone,
          content: "Sorry, I had trouble processing that. Please try again or rephrase your request.",
          fromNumber: args.sendblueNumber,
        });
      } catch (sendError) {
        console.error("Failed to send error response:", sendError);
      }

      console.log(`Text processing failed in ${Date.now() - startTime}ms`);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

// Result type for send message operations
type SendMessageResult = {
  success: boolean;
  messageHandle?: string;
  status?: string;
  service?: string;
  error?: string;
  mode?: string;
};

/**
 * Send a proactive text to a user (for notifications, reminders, etc.)
 */
export const sendProactiveText = action({
  args: {
    userId: v.id("users"),
    content: v.string(),
    mediaUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SendMessageResult> => {
    // Get user's primary phone
    const user: { primaryPhone?: string } | null = await ctx.runQuery(api.users.getUser, {
      userId: args.userId,
    });

    if (!user || !user.primaryPhone) {
      return {
        success: false,
        error: "User has no primary phone number",
      };
    }

    // Send the message (SendBlue auto-assigns the from number)
    const result: SendMessageResult = await ctx.runAction(api.sendblue.sendMessage, {
      to: user.primaryPhone,
      content: args.content,
      mediaUrl: args.mediaUrl,
    });

    if (result.success) {
      // Log the message (sendblueNumber comes from webhook response or use placeholder)
      const conversation = await ctx.runMutation(internal.textMessages.getOrCreateConversation, {
        userId: args.userId,
        userPhone: user.primaryPhone,
        sendblueNumber: "auto", // SendBlue auto-assigns
      });

      await ctx.runMutation(internal.textMessages.logMessage, {
        conversationId: conversation._id,
        userId: args.userId,
        direction: "outbound",
        content: args.content,
        messageHandle: result.messageHandle,
        status: "sent",
        service: result.service as "iMessage" | "SMS" | undefined,
        mediaUrl: args.mediaUrl,
      });
    }

    return result;
  },
});
