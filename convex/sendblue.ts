import { v } from "convex/values";
import { action } from "./_generated/server";
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
