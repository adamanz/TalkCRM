import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================================================
// SLACK OAUTH AUTHENTICATION
// Handles the OAuth 2.0 flow for Slack app installation
// ============================================================================

// Required scopes for the Slack app
const SLACK_SCOPES = [
  "app_mentions:read",     // Respond to @mentions
  "channels:join",         // Join public channels
  "channels:read",         // List channels
  "chat:write",            // Send messages
  "commands",              // Slash commands
  "groups:read",           // List private channels
  "im:read",               // DM info
  "im:write",              // Send DMs
  "users:read",            // User info
  "users:read.email",      // User emails (for matching)
].join(",");

// ============================================================================
// OAUTH STATE MANAGEMENT
// ============================================================================

/**
 * Create an OAuth state for CSRF protection
 */
export const createOAuthState = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    returnUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate random state
    const state = crypto.randomUUID();

    // Store state with 10-minute expiry
    await ctx.db.insert("slackOAuthStates", {
      state,
      userId: args.userId,
      returnUrl: args.returnUrl,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      createdAt: Date.now(),
    });

    return state;
  },
});

/**
 * Validate and consume an OAuth state
 */
export const validateOAuthState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const stateDoc = await ctx.db
      .query("slackOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();

    if (!stateDoc) {
      return null;
    }

    // Check expiration
    if (stateDoc.expiresAt < Date.now()) {
      await ctx.db.delete(stateDoc._id);
      return null;
    }

    // Consume the state (delete it)
    await ctx.db.delete(stateDoc._id);

    return {
      userId: stateDoc.userId,
      returnUrl: stateDoc.returnUrl,
    };
  },
});

/**
 * Clean up expired OAuth states
 */
export const cleanupExpiredStates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expiredStates = await ctx.db
      .query("slackOAuthStates")
      .withIndex("by_expires", (q) => q.lt("expiresAt", Date.now()))
      .collect();

    for (const state of expiredStates) {
      await ctx.db.delete(state._id);
    }

    return { deleted: expiredStates.length };
  },
});

// ============================================================================
// OAUTH FLOW
// ============================================================================

/**
 * Generate the Slack OAuth installation URL
 */
export const getInstallUrl = action({
  args: {
    userId: v.optional(v.id("users")),
    returnUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      throw new Error("SLACK_CLIENT_ID not configured");
    }

    // Create OAuth state
    const state: string = await ctx.runMutation(internal.slackAuth.createOAuthState, {
      userId: args.userId,
      returnUrl: args.returnUrl,
    });

    // Get redirect URI from env or construct it
    const redirectUri = process.env.SLACK_REDIRECT_URI ||
      `${process.env.CONVEX_SITE_URL}/api/slack/oauth/callback`;

    // Build OAuth URL
    const params: URLSearchParams = new URLSearchParams({
      client_id: clientId,
      scope: SLACK_SCOPES,
      redirect_uri: redirectUri,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  },
});

/**
 * Exchange OAuth code for tokens and save installation
 */
export const completeOAuthFlow = internalAction({
  args: {
    code: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    installationId: Id<"slackInstallations">;
    teamName: string;
    returnUrl?: string;
  }> => {
    // Validate state
    const stateData: { userId?: Id<"users">; returnUrl?: string } | null =
      await ctx.runMutation(internal.slackAuth.validateOAuthState, {
        state: args.state,
      });

    if (!stateData) {
      throw new Error("Invalid or expired OAuth state");
    }

    // Get credentials
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI ||
      `${process.env.CONVEX_SITE_URL}/api/slack/oauth/callback`;

    if (!clientId || !clientSecret) {
      throw new Error("Slack OAuth credentials not configured");
    }

    // Exchange code for token
    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: args.code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error("Slack OAuth error:", tokenData.error);
      throw new Error(`Slack OAuth failed: ${tokenData.error}`);
    }

    // Extract installation data
    const {
      access_token: botToken,
      team,
      bot_user_id: botUserId,
      app_id: appId,
      authed_user,
      scope,
    } = tokenData;

    // We need a userId - either from state or we need to find/create one
    let userId: Id<"users"> | undefined = stateData.userId;

    if (!userId) {
      // Try to find user by Slack email
      try {
        const userInfoResponse = await fetch(
          `https://slack.com/api/users.info?user=${authed_user.id}`,
          {
            headers: {
              Authorization: `Bearer ${botToken}`,
            },
          }
        );
        const userInfo = await userInfoResponse.json();

        if (userInfo.ok && userInfo.user?.profile?.email) {
          // Look up user by email
          const existingUser = await ctx.runQuery(internal.slackAuth.getUserByEmail, {
            email: userInfo.user.profile.email,
          });

          if (existingUser) {
            userId = existingUser._id;
          }
        }
      } catch (e) {
        console.error("Could not fetch Slack user info:", e);
      }
    }

    if (!userId) {
      throw new Error("Could not determine user for Slack installation. Please log in first.");
    }

    // Save installation
    const installationId: Id<"slackInstallations"> = await ctx.runMutation(internal.slack.saveInstallation, {
      userId,
      teamId: team.id,
      teamName: team.name,
      botToken,
      botUserId,
      botId: tokenData.bot_user_id,
      appId,
      authedUserId: authed_user.id,
      scope,
    });

    return {
      success: true,
      installationId,
      teamName: team.name,
      returnUrl: stateData.returnUrl,
    };
  },
});

/**
 * Internal query to find user by email
 */
export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
  },
});

// ============================================================================
// DISCONNECT
// ============================================================================

/**
 * Disconnect Slack (revoke token and remove installation)
 */
export const disconnectSlack = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const installation = await ctx.runQuery(internal.slack.getInstallationForUser, {
      userId: args.userId,
    });

    if (!installation) {
      return { success: true, message: "No Slack connection found" };
    }

    // Try to revoke the token (best effort)
    try {
      await fetch("https://slack.com/api/auth.revoke", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${installation.botToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
    } catch (e) {
      console.error("Failed to revoke Slack token:", e);
    }

    // Deactivate installation
    await ctx.runMutation(internal.slackAuth.deactivateInstallation, {
      installationId: installation._id,
    });

    return { success: true, message: "Slack disconnected" };
  },
});

/**
 * Deactivate installation mutation
 */
export const deactivateInstallation = internalMutation({
  args: { installationId: v.id("slackInstallations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.installationId, {
      isActive: false,
      updatedAt: Date.now(),
    });

    // Also deactivate channel mappings
    const mappings = await ctx.db
      .query("slackChannelMappings")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .collect();

    for (const mapping of mappings) {
      await ctx.db.patch(mapping._id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    }
  },
});

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify Slack request signature
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export async function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string,
  signingSecret: string
): Promise<boolean> {
  // Check timestamp is recent (within 5 minutes)
  const requestTimestamp = parseInt(timestamp, 10);
  const currentTimestamp = Math.floor(Date.now() / 1000);

  if (Math.abs(currentTimestamp - requestTimestamp) > 300) {
    console.error("Slack signature timestamp too old");
    return false;
  }

  // Calculate expected signature
  const sigBasestring = `v0:${timestamp}:${body}`;

  // Use Web Crypto API
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(sigBasestring)
  );

  // Convert to hex
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const computedSignature = "v0=" + signatureArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Compare signatures (timing-safe comparison)
  if (signature.length !== computedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ computedSignature.charCodeAt(i);
  }

  return result === 0;
}
