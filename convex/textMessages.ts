import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// TEXT MESSAGE QUERIES AND MUTATIONS
// ============================================================================

/**
 * Get or create a text conversation for a user
 */
export const getOrCreateConversation = internalMutation({
  args: {
    userId: v.id("users"),
    userPhone: v.string(),
    sendblueNumber: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"textConversations">> => {
    // Try to find existing conversation
    const existing = await ctx.db
      .query("textConversations")
      .withIndex("by_phone", (q) => q.eq("userPhone", args.userPhone))
      .first();

    if (existing && existing.userId === args.userId) {
      return existing;
    }

    // Create new conversation
    const now = Date.now();
    const conversationId = await ctx.db.insert("textConversations", {
      userId: args.userId,
      userPhone: args.userPhone,
      sendblueNumber: args.sendblueNumber,
      lastMessageAt: now,
      messageCount: 0,
      status: "active",
      createdAt: now,
    });

    const conversation = await ctx.db.get(conversationId);
    return conversation!;
  },
});

/**
 * Log a text message (inbound or outbound)
 */
export const logMessage = internalMutation({
  args: {
    conversationId: v.id("textConversations"),
    userId: v.id("users"),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    content: v.string(),
    messageHandle: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed")
    ),
    service: v.optional(v.union(v.literal("iMessage"), v.literal("SMS"))),
    errorMessage: v.optional(v.string()),
    aiProcessed: v.optional(v.boolean()),
    salesforceAction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Insert the message
    const messageId = await ctx.db.insert("textMessages", {
      conversationId: args.conversationId,
      userId: args.userId,
      direction: args.direction,
      content: args.content,
      mediaUrl: args.mediaUrl,
      timestamp: now,
      messageHandle: args.messageHandle,
      status: args.status,
      service: args.service,
      errorMessage: args.errorMessage,
      aiProcessed: args.aiProcessed,
      salesforceAction: args.salesforceAction,
    });

    // Update conversation stats
    const conversation = await ctx.db.get(args.conversationId);
    if (conversation) {
      await ctx.db.patch(args.conversationId, {
        lastMessageAt: now,
        messageCount: conversation.messageCount + 1,
      });
    }

    return messageId;
  },
});

/**
 * Get recent messages for a conversation (for AI context)
 */
export const getRecentMessages = internalQuery({
  args: {
    conversationId: v.id("textConversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const messages = await ctx.db
      .query("textMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(limit);

    // Return in chronological order (oldest first)
    return messages.reverse();
  },
});

/**
 * Update message status (for delivery callbacks)
 */
export const updateMessageStatus = internalMutation({
  args: {
    messageHandle: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
    service: v.optional(v.union(v.literal("iMessage"), v.literal("SMS"))),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("textMessages")
      .withIndex("by_message_handle", (q) => q.eq("messageHandle", args.messageHandle))
      .first();

    if (message) {
      await ctx.db.patch(message._id, {
        status: args.status,
        errorMessage: args.errorMessage,
        service: args.service || message.service,
      });
      return true;
    }

    return false;
  },
});

// ============================================================================
// PUBLIC QUERIES (for UI)
// ============================================================================

/**
 * Get all text conversations for a user
 */
export const getUserConversations = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("textConversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

/**
 * Get messages for a specific conversation
 */
export const getConversationMessages = query({
  args: {
    conversationId: v.id("textConversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    const messages = await ctx.db
      .query("textMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(limit);

    // Return in chronological order
    return messages.reverse();
  },
});

/**
 * Get recent text messages for a user (across all conversations)
 */
export const getUserRecentMessages = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    return await ctx.db
      .query("textMessages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get text message stats for a user
 */
export const getUserTextStats = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("textConversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messageCount, 0);

    // Get messages from last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentMessages = await ctx.db
      .query("textMessages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gte(q.field("timestamp"), oneDayAgo))
      .collect();

    return {
      totalConversations: conversations.length,
      totalMessages,
      messagesLast24Hours: recentMessages.length,
      inboundLast24Hours: recentMessages.filter((m) => m.direction === "inbound").length,
      outboundLast24Hours: recentMessages.filter((m) => m.direction === "outbound").length,
    };
  },
});
