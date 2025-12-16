import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// ============================================================================
// TWILIO SMS ACTIONS
// ============================================================================

/**
 * Send SMS verification code via Twilio
 */
export const sendVerificationSMS = action({
  args: {
    phone: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error("Twilio credentials not configured");
      // In development, just log the code
      console.log(`[DEV MODE] Verification code for ${args.phone}: ${args.code}`);
      return {
        success: true,
        mode: "dev",
        message: "Code logged to console (Twilio not configured)",
      };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const body = new URLSearchParams({
      To: args.phone,
      From: fromNumber,
      Body: `Your TalkCRM verification code is: ${args.code}. This code expires in 10 minutes.`,
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Twilio SMS error:", error);
        throw new Error(`Failed to send SMS: ${error}`);
      }

      const result = await response.json();
      return {
        success: true,
        mode: "production",
        messageSid: result.sid,
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

    // Send SMS with code
    const smsResult = await ctx.runAction(api.twilio.sendVerificationSMS, {
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

/**
 * Make an outbound call using Twilio (for future use - call back user)
 */
export const makeOutboundCall = action({
  args: {
    to: v.string(),
    agentId: v.optional(v.string()), // ElevenLabs agent ID to use
  },
  handler: async (ctx, args) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const agentId = args.agentId || process.env.ELEVENLABS_AGENT_ID;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Twilio credentials not configured");
    }

    if (!agentId) {
      throw new Error("ElevenLabs agent ID not configured");
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    // TwiML to connect to ElevenLabs
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationalAi url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}" />
  </Connect>
</Response>`;

    const body = new URLSearchParams({
      To: args.to,
      From: fromNumber,
      Twiml: twiml,
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to make call: ${error}`);
      }

      const result = await response.json();
      return {
        success: true,
        callSid: result.sid,
        status: result.status,
      };
    } catch (error: any) {
      throw new Error(`Call failed: ${error.message}`);
    }
  },
});
