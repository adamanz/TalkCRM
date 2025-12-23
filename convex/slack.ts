import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { Block } from "./slackBlocks";

// ============================================================================
// SLACK API HELPERS
// ============================================================================

const SLACK_API_BASE = "https://slack.com/api";

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  [key: string]: any;
}

/**
 * Make an authenticated request to Slack API
 */
async function slackApiRequest(
  method: string,
  endpoint: string,
  token: string,
  body?: Record<string, any>
): Promise<SlackApiResponse> {
  const url = `${SLACK_API_BASE}/${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!data.ok) {
    console.error(`Slack API error [${endpoint}]:`, data.error);
  }

  return data;
}

// ============================================================================
// QUERIES - Get Slack data
// ============================================================================

/**
 * Get Slack installation for a user
 */
export const getInstallation = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("slackInstallations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
  },
});

/**
 * Get all Slack installations for a user (including inactive)
 */
export const getAllInstallations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("slackInstallations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Get channel mappings for a user
 */
export const getChannelMappings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("slackChannelMappings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

/**
 * Get Slack status for frontend display
 */
export const getSlackStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const installation = await ctx.db
      .query("slackInstallations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!installation) {
      return { connected: false };
    }

    const channelMappings = await ctx.db
      .query("slackChannelMappings")
      .withIndex("by_installation", (q) => q.eq("installationId", installation._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return {
      connected: true,
      teamName: installation.teamName,
      teamId: installation.teamId,
      installedAt: installation.installedAt,
      channels: channelMappings.map((c) => ({
        channelId: c.channelId,
        channelName: c.channelName,
        purpose: c.purpose,
      })),
    };
  },
});

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

export const getInstallationByTeam = internalQuery({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("slackInstallations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
  },
});

/**
 * Seed a Slack installation for testing (creates user if needed)
 */
export const seedSlackInstallation = mutation({
  args: {
    teamId: v.string(),
    teamName: v.string(),
    botToken: v.string(),
    botUserId: v.string(),
    botId: v.string(),
    appId: v.string(),
    authedUserId: v.string(),
    scope: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"slackInstallations">> => {
    // Find or create a user
    let user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.userEmail || "test@talkcrm.ai"))
      .first();

    if (!user) {
      // Create a test user
      const userId = await ctx.db.insert("users", {
        email: args.userEmail || "test@talkcrm.ai",
        name: "Test User",
        createdAt: Date.now(),
      });
      user = await ctx.db.get(userId);
    }

    if (!user) {
      throw new Error("Failed to create user");
    }

    // Check for existing installation
    const existing = await ctx.db
      .query("slackInstallations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        botToken: args.botToken,
        botUserId: args.botUserId,
        botId: args.botId,
        authedUserId: args.authedUserId,
        scope: args.scope,
        updatedAt: Date.now(),
        isActive: true,
      });
      return existing._id;
    }

    return await ctx.db.insert("slackInstallations", {
      userId: user._id,
      teamId: args.teamId,
      teamName: args.teamName,
      botToken: args.botToken,
      botUserId: args.botUserId,
      botId: args.botId,
      appId: args.appId,
      authedUserId: args.authedUserId,
      scope: args.scope,
      installedAt: Date.now(),
      isActive: true,
    });
  },
});

export const getInstallationById = internalQuery({
  args: { installationId: v.id("slackInstallations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.installationId);
  },
});

export const getInstallationForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("slackInstallations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
  },
});

export const getChannelByPurpose = internalQuery({
  args: {
    userId: v.id("users"),
    purpose: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("slackChannelMappings")
      .withIndex("by_purpose", (q) =>
        q.eq("userId", args.userId).eq("purpose", args.purpose as any)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
  },
});

// ============================================================================
// MUTATIONS - Store Slack data
// ============================================================================

/**
 * Save or update Slack installation
 */
export const saveInstallation = internalMutation({
  args: {
    userId: v.id("users"),
    teamId: v.string(),
    teamName: v.string(),
    botToken: v.string(),
    botUserId: v.string(),
    botId: v.string(),
    appId: v.string(),
    authedUserId: v.string(),
    scope: v.string(),
  },
  handler: async (ctx, args) => {
    // Check for existing installation for this user+team
    const existing = await ctx.db
      .query("slackInstallations")
      .withIndex("by_user_team", (q) =>
        q.eq("userId", args.userId).eq("teamId", args.teamId)
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        botToken: args.botToken,
        botUserId: args.botUserId,
        botId: args.botId,
        authedUserId: args.authedUserId,
        scope: args.scope,
        updatedAt: Date.now(),
        isActive: true,
      });
      return existing._id;
    }

    // Create new
    return await ctx.db.insert("slackInstallations", {
      userId: args.userId,
      teamId: args.teamId,
      teamName: args.teamName,
      botToken: args.botToken,
      botUserId: args.botUserId,
      botId: args.botId,
      appId: args.appId,
      authedUserId: args.authedUserId,
      scope: args.scope,
      installedAt: Date.now(),
      isActive: true,
    });
  },
});

/**
 * Deactivate a Slack installation
 */
export const deactivateInstallation = mutation({
  args: { installationId: v.id("slackInstallations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.installationId, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Save a channel mapping
 */
export const saveChannelMapping = mutation({
  args: {
    userId: v.id("users"),
    installationId: v.id("slackInstallations"),
    channelId: v.string(),
    channelName: v.string(),
    channelType: v.union(v.literal("public"), v.literal("private"), v.literal("dm")),
    purpose: v.union(
      v.literal("deal_alerts"),
      v.literal("call_summaries"),
      v.literal("task_reminders"),
      v.literal("all_activity"),
      v.literal("general")
    ),
    notifyOnDealClosed: v.optional(v.boolean()),
    notifyOnDealStageChange: v.optional(v.boolean()),
    notifyOnCallComplete: v.optional(v.boolean()),
    notifyOnTaskOverdue: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check for existing mapping for same channel+purpose
    const existing = await ctx.db
      .query("slackChannelMappings")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("purpose"), args.purpose))
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        channelName: args.channelName,
        notifyOnDealClosed: args.notifyOnDealClosed,
        notifyOnDealStageChange: args.notifyOnDealStageChange,
        notifyOnCallComplete: args.notifyOnCallComplete,
        notifyOnTaskOverdue: args.notifyOnTaskOverdue,
        updatedAt: Date.now(),
        isActive: true,
      });
      return existing._id;
    }

    // Create new
    return await ctx.db.insert("slackChannelMappings", {
      userId: args.userId,
      installationId: args.installationId,
      channelId: args.channelId,
      channelName: args.channelName,
      channelType: args.channelType,
      purpose: args.purpose,
      isActive: true,
      notifyOnDealClosed: args.notifyOnDealClosed ?? true,
      notifyOnDealStageChange: args.notifyOnDealStageChange ?? true,
      notifyOnCallComplete: args.notifyOnCallComplete ?? true,
      notifyOnTaskOverdue: args.notifyOnTaskOverdue ?? true,
      createdAt: Date.now(),
    });
  },
});

/**
 * Remove a channel mapping
 */
export const removeChannelMapping = mutation({
  args: { mappingId: v.id("slackChannelMappings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.mappingId, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Remove a channel mapping by user and purpose
 */
export const removeChannelMappingByPurpose = internalMutation({
  args: {
    userId: v.id("users"),
    purpose: v.string(),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.db
      .query("slackChannelMappings")
      .withIndex("by_purpose", (q) =>
        q.eq("userId", args.userId).eq("purpose", args.purpose as any)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (mapping) {
      await ctx.db.patch(mapping._id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Log a Slack message
 */
export const logMessage = internalMutation({
  args: {
    userId: v.id("users"),
    installationId: v.id("slackInstallations"),
    channelId: v.string(),
    messageTs: v.string(),
    threadTs: v.optional(v.string()),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    messageType: v.union(
      v.literal("command"),
      v.literal("mention"),
      v.literal("notification"),
      v.literal("interactive")
    ),
    content: v.optional(v.string()),
    salesforceRecordId: v.optional(v.string()),
    salesforceRecordType: v.optional(v.string()),
    slackUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("slackMessages", {
      userId: args.userId,
      installationId: args.installationId,
      channelId: args.channelId,
      messageTs: args.messageTs,
      threadTs: args.threadTs,
      direction: args.direction,
      messageType: args.messageType,
      content: args.content,
      salesforceRecordId: args.salesforceRecordId,
      salesforceRecordType: args.salesforceRecordType,
      slackUserId: args.slackUserId,
      timestamp: Date.now(),
    });
  },
});

// ============================================================================
// ACTIONS - Slack API calls
// ============================================================================

/**
 * Send a message to a Slack channel
 */
export const sendMessage = internalAction({
  args: {
    installationId: v.id("slackInstallations"),
    channelId: v.string(),
    text: v.string(),
    blocks: v.optional(v.array(v.any())),
    threadTs: v.optional(v.string()),
    unfurlLinks: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const installation = await ctx.runQuery(internal.slack.getInstallationById, {
      installationId: args.installationId,
    });

    if (!installation) {
      throw new Error("Slack installation not found");
    }

    const body: Record<string, any> = {
      channel: args.channelId,
      text: args.text,
    };

    if (args.blocks) {
      body.blocks = args.blocks;
    }

    if (args.threadTs) {
      body.thread_ts = args.threadTs;
    }

    if (args.unfurlLinks !== undefined) {
      body.unfurl_links = args.unfurlLinks;
    }

    const response = await slackApiRequest("POST", "chat.postMessage", installation.botToken, body);

    if (response.ok) {
      // Log the message
      await ctx.runMutation(internal.slack.logMessage, {
        userId: installation.userId,
        installationId: args.installationId,
        channelId: args.channelId,
        messageTs: response.ts,
        threadTs: args.threadTs,
        direction: "outbound",
        messageType: "notification",
        content: args.text,
      });
    }

    return response;
  },
});

/**
 * Update an existing Slack message
 */
export const updateMessage = internalAction({
  args: {
    installationId: v.id("slackInstallations"),
    channelId: v.string(),
    messageTs: v.string(),
    text: v.string(),
    blocks: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args): Promise<SlackApiResponse> => {
    const installation = await ctx.runQuery(internal.slack.getInstallationById, {
      installationId: args.installationId,
    });

    if (!installation) {
      throw new Error("Slack installation not found");
    }

    const body: Record<string, any> = {
      channel: args.channelId,
      ts: args.messageTs,
      text: args.text,
    };

    if (args.blocks) {
      body.blocks = args.blocks;
    }

    return await slackApiRequest("POST", "chat.update", installation.botToken, body);
  },
});

/**
 * Get list of channels the bot can post to
 */
export const getChannels = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Array<{ id: string; name: string; is_private: boolean; is_member: boolean }>> => {
    const installation = await ctx.runQuery(internal.slack.getInstallationForUser, {
      userId: args.userId,
    });

    if (!installation) {
      throw new Error("Slack not connected");
    }

    // Get public channels
    const publicChannels = await slackApiRequest(
      "GET",
      "conversations.list?types=public_channel&exclude_archived=true&limit=200",
      installation.botToken
    );

    // Get private channels bot is in
    const privateChannels = await slackApiRequest(
      "GET",
      "conversations.list?types=private_channel&exclude_archived=true&limit=200",
      installation.botToken
    );

    const channels = [
      ...(publicChannels.channels || []),
      ...(privateChannels.channels || []),
    ].map((ch: any) => ({
      id: ch.id as string,
      name: ch.name as string,
      is_private: ch.is_private as boolean,
      is_member: ch.is_member as boolean,
    }));

    return channels;
  },
});

/**
 * Join a channel (so bot can post to it)
 */
export const joinChannel = action({
  args: {
    userId: v.id("users"),
    channelId: v.string(),
  },
  handler: async (ctx, args): Promise<SlackApiResponse> => {
    const installation = await ctx.runQuery(internal.slack.getInstallationForUser, {
      userId: args.userId,
    });

    if (!installation) {
      throw new Error("Slack not connected");
    }

    return await slackApiRequest("POST", "conversations.join", installation.botToken, {
      channel: args.channelId,
    });
  },
});

/**
 * Send a notification to configured channel
 */
export const sendNotification = internalAction({
  args: {
    userId: v.id("users"),
    purpose: v.string(),
    text: v.string(),
    blocks: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string; messageTs?: string }> => {
    // Get installation
    const installation = await ctx.runQuery(internal.slack.getInstallationForUser, {
      userId: args.userId,
    });

    if (!installation) {
      console.log(`No Slack installation for user ${args.userId}`);
      return { sent: false, reason: "no_installation" };
    }

    // Get channel mapping for this purpose
    const channelMapping = await ctx.runQuery(internal.slack.getChannelByPurpose, {
      userId: args.userId,
      purpose: args.purpose,
    });

    if (!channelMapping) {
      console.log(`No channel configured for ${args.purpose} notifications`);
      return { sent: false, reason: "no_channel_configured" };
    }

    // Send the message
    const result = await ctx.runAction(internal.slack.sendMessage, {
      installationId: installation._id,
      channelId: channelMapping.channelId,
      text: args.text,
      blocks: args.blocks,
    });

    return { sent: result.ok, messageTs: result.ts };
  },
});

/**
 * Post a response to a slash command
 */
export const respondToCommand = internalAction({
  args: {
    responseUrl: v.string(),
    text: v.string(),
    blocks: v.optional(v.array(v.any())),
    responseType: v.optional(v.union(v.literal("in_channel"), v.literal("ephemeral"))),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; status: number }> => {
    const body: Record<string, any> = {
      text: args.text,
      response_type: args.responseType || "ephemeral",
    };

    if (args.blocks) {
      body.blocks = args.blocks;
    }

    const response = await fetch(args.responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return { ok: response.ok, status: response.status };
  },
});

// ============================================================================
// NOTIFICATION HELPERS - Called from other parts of the app
// ============================================================================

/**
 * Send a call summary notification
 */
export const notifyCallCompleted = internalAction({
  args: {
    userId: v.id("users"),
    callSummary: v.string(),
    durationSeconds: v.optional(v.number()),
    callerPhone: v.optional(v.string()),
    recordsAccessed: v.optional(v.number()),
    recordsModified: v.optional(v.number()),
    sentiment: v.optional(v.string()),
    successEvaluation: v.optional(v.object({
      success: v.boolean(),
      criteria: v.optional(v.array(v.object({
        name: v.string(),
        result: v.string(),
      }))),
    })),
  },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string; messageTs?: string }> => {
    // Import block builders dynamically to avoid circular deps
    const { buildCallSummaryBlocks } = await import("./slackBlocks");

    const durationMinutes = args.durationSeconds
      ? Math.round(args.durationSeconds / 60)
      : undefined;

    const blocks = buildCallSummaryBlocks({
      summary: args.callSummary,
      durationMinutes,
      callerPhone: args.callerPhone,
      recordsAccessed: args.recordsAccessed,
      recordsModified: args.recordsModified,
      sentiment: args.sentiment,
      successEvaluation: args.successEvaluation,
    });

    const durationText = durationMinutes ? ` (${durationMinutes} min)` : "";
    const contactText = args.callerPhone || "Unknown caller";
    const text = `Call completed with ${contactText}${durationText}`;

    return await ctx.runAction(internal.slack.sendNotification, {
      userId: args.userId,
      purpose: "call_summaries",
      text,
      blocks,
    });
  },
});

/**
 * Send a deal alert notification
 */
export const notifyDealChange = internalAction({
  args: {
    userId: v.id("users"),
    dealName: v.string(),
    accountName: v.string(),
    amount: v.number(),
    stage: v.string(),
    ownerName: v.string(),
    changeType: v.union(
      v.literal("closed_won"),
      v.literal("closed_lost"),
      v.literal("stage_change")
    ),
    previousStage: v.optional(v.string()),
    recordUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string; messageTs?: string }> => {
    const { buildDealAlertBlocks } = await import("./slackBlocks");

    const blocks = buildDealAlertBlocks(
      args.dealName,
      args.accountName,
      args.amount,
      args.stage,
      args.ownerName,
      args.changeType,
      args.previousStage,
      args.recordUrl
    );

    let text: string;
    switch (args.changeType) {
      case "closed_won":
        text = `🎉 Deal Won! ${args.dealName} - $${args.amount.toLocaleString()}`;
        break;
      case "closed_lost":
        text = `😔 Deal Lost: ${args.dealName}`;
        break;
      case "stage_change":
        text = `📈 ${args.dealName} moved to ${args.stage}`;
        break;
    }

    return await ctx.runAction(internal.slack.sendNotification, {
      userId: args.userId,
      purpose: "deal_alerts",
      text,
      blocks,
    });
  },
});
