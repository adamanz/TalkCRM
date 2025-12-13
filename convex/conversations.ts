import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// ============================================================================
// INTERNAL MUTATIONS (Called by HTTP actions)
// ============================================================================

export const startConversation = internalMutation({
  args: {
    conversationId: v.string(),
    callerPhone: v.optional(v.string()),
    userId: v.optional(v.id("users")), // Link to authenticated user
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        callerPhone: args.callerPhone ?? existing.callerPhone,
        userId: args.userId ?? existing.userId,
        status: "active",
      });
      return null;
    }

    await ctx.db.insert("conversations", {
      conversationId: args.conversationId,
      callerPhone: args.callerPhone,
      userId: args.userId,
      startTime: Date.now(),
      status: "active",
      salesforceRecordsAccessed: [],
      salesforceRecordsModified: [],
    });
    return null;
  },
});

export const completeConversation = internalMutation({
  args: {
    conversationId: v.string(),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.number(),
    callerPhone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();

    if (conversation) {
      await ctx.db.patch(conversation._id, {
        status: "completed",
        transcript: args.transcript,
        summary: args.summary,
        startTime: args.startTime ?? conversation.startTime,
        endTime: args.endTime,
        callerPhone: args.callerPhone ?? conversation.callerPhone,
      });
      return null;
    }

    // If we didn't see a "start" event (e.g. when using an ElevenLabs-managed phone number),
    // create the conversation record here.
    await ctx.db.insert("conversations", {
      conversationId: args.conversationId,
      callerPhone: args.callerPhone,
      startTime: args.startTime ?? args.endTime,
      endTime: args.endTime,
      status: "completed",
      transcript: args.transcript,
      summary: args.summary,
      salesforceRecordsAccessed: [],
      salesforceRecordsModified: [],
    });
    return null;
  },
});

export const logToolCall = internalMutation({
  args: {
    conversationId: v.string(),
    toolName: v.string(),
    input: v.string(),
    output: v.string(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    durationMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("toolCalls", {
      conversationId: args.conversationId,
      toolName: args.toolName,
      input: args.input,
      output: args.output,
      success: args.success,
      errorMessage: args.errorMessage,
      durationMs: args.durationMs,
      timestamp: Date.now(),
    });

    // Update conversation with accessed/modified records
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();

    // If we didn't get a start event (ElevenLabs-managed phone numbers), create an "active"
    // conversation on first tool call so dashboards and stats work.
    const conversationDoc =
      conversation ??
      (await ctx.db.insert("conversations", {
        conversationId: args.conversationId,
        startTime: Date.now(),
        status: "active",
        salesforceRecordsAccessed: [],
        salesforceRecordsModified: [],
      }).then((id) => ctx.db.get(id)));

    if (conversationDoc) {
      try {
        const output = JSON.parse(args.output);

        // Track record IDs from output
        if (output.id) {
          const modifyTools = ["create_record", "update_record", "log_call"];
          if (modifyTools.includes(args.toolName)) {
            await ctx.db.patch(conversationDoc._id, {
              salesforceRecordsModified: [
                ...conversationDoc.salesforceRecordsModified,
                output.id,
              ],
            });
          } else {
            await ctx.db.patch(conversationDoc._id, {
              salesforceRecordsAccessed: [
                ...conversationDoc.salesforceRecordsAccessed,
                output.id,
              ],
            });
          }
        }

        // Track multiple records from search results
        if (output.records) {
          const recordIds = output.records
            .map((r: any) => r.Id || r.id)
            .filter(Boolean);
          await ctx.db.patch(conversationDoc._id, {
            salesforceRecordsAccessed: [
              ...new Set([
                ...conversationDoc.salesforceRecordsAccessed,
                ...recordIds,
              ]),
            ],
          });
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    return null;
  },
});

// ============================================================================
// QUERIES (For frontend dashboard)
// ============================================================================

export const listConversations = query({
  args: {
    limit: v.optional(v.number()),
    userId: v.optional(v.id("users")), // Filter by user
  },
  returns: v.array(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      conversationId: v.string(),
      userId: v.optional(v.id("users")),
      callerPhone: v.optional(v.string()),
      startTime: v.number(),
      endTime: v.optional(v.number()),
      status: v.union(v.literal("active"), v.literal("completed"), v.literal("failed")),
      transcript: v.optional(v.string()),
      summary: v.optional(v.string()),
      salesforceRecordsAccessed: v.array(v.string()),
      salesforceRecordsModified: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    // If userId is provided, filter by user
    if (args.userId) {
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(args.limit || 50);
      return conversations;
    }

    // Otherwise return all (for admin view)
    const conversations = await ctx.db
      .query("conversations")
      .order("desc")
      .take(args.limit || 50);

    return conversations;
  },
});

export const getConversation = query({
  args: {
    conversationId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      conversationId: v.string(),
      callerPhone: v.optional(v.string()),
      startTime: v.number(),
      endTime: v.optional(v.number()),
      status: v.union(v.literal("active"), v.literal("completed"), v.literal("failed")),
      transcript: v.optional(v.string()),
      summary: v.optional(v.string()),
      salesforceRecordsAccessed: v.array(v.string()),
      salesforceRecordsModified: v.array(v.string()),
      toolCalls: v.array(
        v.object({
          _id: v.id("toolCalls"),
          _creationTime: v.number(),
          conversationId: v.string(),
          toolName: v.string(),
          input: v.string(),
          output: v.string(),
          success: v.boolean(),
          errorMessage: v.optional(v.string()),
          durationMs: v.number(),
          timestamp: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();

    if (!conversation) {
      return null;
    }

    const toolCalls = await ctx.db
      .query("toolCalls")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    return {
      ...conversation,
      toolCalls,
    };
  },
});

export const getConversationStats = query({
  args: {
    userId: v.optional(v.id("users")), // Filter by user
  },
  returns: v.object({
    total: v.number(),
    today: v.number(),
    thisWeek: v.number(),
    avgDurationSeconds: v.number(),
    recordsAccessed: v.number(),
    recordsModified: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get conversations, optionally filtered by user
    let allConversations;
    if (args.userId) {
      allConversations = await ctx.db
        .query("conversations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    } else {
      allConversations = await ctx.db.query("conversations").collect();
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const todayConversations = allConversations.filter(
      (c) => c.startTime > oneDayAgo
    );
    const weekConversations = allConversations.filter(
      (c) => c.startTime > oneWeekAgo
    );

    const completedConversations = allConversations.filter((c) => c.endTime);
    const avgDuration = completedConversations.length > 0
      ? completedConversations.reduce((sum, c) => sum + (c.endTime! - c.startTime), 0) /
        completedConversations.length
      : 0;

    return {
      total: allConversations.length,
      today: todayConversations.length,
      thisWeek: weekConversations.length,
      avgDurationSeconds: Math.round(avgDuration / 1000) || 0,
      recordsAccessed: allConversations.reduce(
        (sum, c) => sum + c.salesforceRecordsAccessed.length,
        0
      ),
      recordsModified: allConversations.reduce(
        (sum, c) => sum + c.salesforceRecordsModified.length,
        0
      ),
    };
  },
});
