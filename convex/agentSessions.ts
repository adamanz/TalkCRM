import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get or create an active session for a user
 * If user has an active session within the timeout window, return it
 * Otherwise create a new session
 */
export const getOrCreateSession = mutation({
  args: {
    userId: v.id("users"),
    channel: v.union(
      v.literal("web"),
      v.literal("voice"),
      v.literal("sms"),
      v.literal("api")
    ),
    sourceConversationId: v.optional(v.string()),
    sourceTextConversationId: v.optional(v.id("textConversations")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes

    // Look for active session for this user on this channel
    const existingSession = await ctx.db
      .query("agentSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .filter((q) => q.eq(q.field("channel"), args.channel))
      .first();

    // If session exists and hasn't expired, return it
    if (existingSession && now - existingSession.lastMessageAt < sessionTimeoutMs) {
      return existingSession;
    }

    // If old session exists, mark it as expired
    if (existingSession) {
      await ctx.db.patch(existingSession._id, {
        status: "expired",
      });
    }

    // Create new session
    const sessionId = await ctx.db.insert("agentSessions", {
      userId: args.userId,
      channel: args.channel,
      sourceConversationId: args.sourceConversationId,
      sourceTextConversationId: args.sourceTextConversationId,
      status: "active",
      createdAt: now,
      lastMessageAt: now,
      messageCount: 0,
      expiresAt: now + sessionTimeoutMs,
    });

    return await ctx.db.get(sessionId);
  },
});

/**
 * Get active session for user (without creating)
 */
export const getActiveSession = query({
  args: {
    userId: v.id("users"),
    channel: v.optional(v.union(
      v.literal("web"),
      v.literal("voice"),
      v.literal("sms"),
      v.literal("api")
    )),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("agentSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      );

    if (args.channel) {
      return await query.filter((q) => q.eq(q.field("channel"), args.channel)).first();
    }

    return await query.first();
  },
});

/**
 * Get session by ID
 */
export const getSession = query({
  args: { sessionId: v.id("agentSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

/**
 * Internal version for actions
 */
export const getSessionInternal = internalQuery({
  args: { sessionId: v.id("agentSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

/**
 * List user's sessions
 */
export const listUserSessions = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
    includeExpired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("agentSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc");

    if (!args.includeExpired) {
      query = query.filter((q) => q.neq(q.field("status"), "expired"));
    }

    return await query.take(args.limit || 20);
  },
});

// ============================================================================
// MESSAGE MANAGEMENT
// ============================================================================

/**
 * Add a message to a session
 */
export const addMessage = mutation({
  args: {
    sessionId: v.id("agentSessions"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.object({
      toolName: v.string(),
      input: v.any(),
      output: v.optional(v.any()),
      success: v.boolean(),
    }))),
    referencedRecords: v.optional(v.array(v.object({
      id: v.string(),
      type: v.string(),
      name: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const now = Date.now();

    // Add the message
    const messageId = await ctx.db.insert("agentMessages", {
      sessionId: args.sessionId,
      userId: session.userId,
      role: args.role,
      content: args.content,
      timestamp: now,
      toolCalls: args.toolCalls,
      referencedRecords: args.referencedRecords,
    });

    // Update session metadata
    await ctx.db.patch(args.sessionId, {
      lastMessageAt: now,
      messageCount: session.messageCount + 1,
      expiresAt: now + 30 * 60 * 1000, // Reset expiry
    });

    return messageId;
  },
});

/**
 * Internal version for actions
 */
export const addMessageInternal = internalMutation({
  args: {
    sessionId: v.id("agentSessions"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.object({
      toolName: v.string(),
      input: v.any(),
      output: v.optional(v.any()),
      success: v.boolean(),
    }))),
    referencedRecords: v.optional(v.array(v.object({
      id: v.string(),
      type: v.string(),
      name: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const now = Date.now();

    const messageId = await ctx.db.insert("agentMessages", {
      sessionId: args.sessionId,
      userId: session.userId,
      role: args.role,
      content: args.content,
      timestamp: now,
      toolCalls: args.toolCalls,
      referencedRecords: args.referencedRecords,
    });

    await ctx.db.patch(args.sessionId, {
      lastMessageAt: now,
      messageCount: session.messageCount + 1,
      expiresAt: now + 30 * 60 * 1000,
    });

    return messageId;
  },
});

/**
 * Get messages for a session (for AI context)
 */
export const getSessionMessages = query({
  args: {
    sessionId: v.id("agentSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .take(args.limit || 50);

    return messages;
  },
});

/**
 * Internal version for actions
 */
export const getSessionMessagesInternal = internalQuery({
  args: {
    sessionId: v.id("agentSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .take(args.limit || 50);
  },
});

/**
 * Get recent messages formatted for Claude API
 */
export const getMessagesForContext = query({
  args: {
    sessionId: v.id("agentSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc") // Get most recent first
      .take(args.limit || 20);

    // Reverse to chronological order and format for Claude
    return messages.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  },
});

// ============================================================================
// SESSION LIFECYCLE
// ============================================================================

/**
 * Complete a session
 */
export const completeSession = mutation({
  args: {
    sessionId: v.id("agentSessions"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      title: args.title,
    });

    return { success: true };
  },
});

/**
 * Update session context summary (for long conversations)
 */
export const updateContextSummary = internalMutation({
  args: {
    sessionId: v.id("agentSessions"),
    contextSummary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      contextSummary: args.contextSummary,
    });
  },
});

/**
 * Update Salesforce context for session
 */
export const updateSalesforceContext = mutation({
  args: {
    sessionId: v.id("agentSessions"),
    salesforceContext: v.object({
      recentRecords: v.optional(v.array(v.object({
        id: v.string(),
        type: v.string(),
        name: v.string(),
      }))),
      userInfo: v.optional(v.object({
        salesforceUserId: v.string(),
        userName: v.string(),
      })),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      salesforceContext: args.salesforceContext,
    });
  },
});

/**
 * Cleanup expired sessions (run periodically)
 */
export const cleanupExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired sessions
    const expiredSessions = await ctx.db
      .query("agentSessions")
      .withIndex("by_expires")
      .filter((q) =>
        q.and(
          q.lt(q.field("expiresAt"), now),
          q.eq(q.field("status"), "active")
        )
      )
      .take(100);

    // Mark them as expired
    for (const session of expiredSessions) {
      await ctx.db.patch(session._id, {
        status: "expired",
      });
    }

    return { expiredCount: expiredSessions.length };
  },
});

// ============================================================================
// CONTEXT HELPERS
// ============================================================================

/**
 * Get full session context for AI (session + messages + Salesforce context)
 */
export const getFullSessionContext = query({
  args: {
    sessionId: v.id("agentSessions"),
    messageLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(args.messageLimit || 20);

    // Get user info
    const user = await ctx.db.get(session.userId);

    return {
      session,
      messages: messages.reverse(),
      user: user ? { name: user.name, email: user.email } : null,
      contextSummary: session.contextSummary,
      salesforceContext: session.salesforceContext,
    };
  },
});

/**
 * Internal version for actions
 */
export const getFullSessionContextInternal = internalQuery({
  args: {
    sessionId: v.id("agentSessions"),
    messageLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(args.messageLimit || 20);

    const user = await ctx.db.get(session.userId);

    return {
      session,
      messages: messages.reverse(),
      user: user ? { name: user.name, email: user.email } : null,
      contextSummary: session.contextSummary,
      salesforceContext: session.salesforceContext,
    };
  },
});
