import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// ============================================================================
// INTERNAL MUTATIONS (Called by HTTP actions)
// ============================================================================

export const startConversation = internalMutation({
  args: {
    conversationId: v.string(),
    callerPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("conversations", {
      conversationId: args.conversationId,
      callerPhone: args.callerPhone,
      startTime: Date.now(),
      status: "active",
      salesforceRecordsAccessed: [],
      salesforceRecordsModified: [],
    });
  },
});

export const completeConversation = internalMutation({
  args: {
    conversationId: v.string(),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    endTime: v.number(),
  },
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
        endTime: args.endTime,
      });
    }
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

    if (conversation) {
      try {
        const output = JSON.parse(args.output);

        // Track record IDs from output
        if (output.id) {
          const modifyTools = ["create_record", "update_record", "log_call"];
          if (modifyTools.includes(args.toolName)) {
            await ctx.db.patch(conversation._id, {
              salesforceRecordsModified: [
                ...conversation.salesforceRecordsModified,
                output.id,
              ],
            });
          } else {
            await ctx.db.patch(conversation._id, {
              salesforceRecordsAccessed: [
                ...conversation.salesforceRecordsAccessed,
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
          await ctx.db.patch(conversation._id, {
            salesforceRecordsAccessed: [
              ...new Set([
                ...conversation.salesforceRecordsAccessed,
                ...recordIds,
              ]),
            ],
          });
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  },
});

// ============================================================================
// QUERIES (For frontend dashboard)
// ============================================================================

export const listConversations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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
  args: {},
  handler: async (ctx) => {
    const allConversations = await ctx.db.query("conversations").collect();

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const todayConversations = allConversations.filter(
      (c) => c.startTime > oneDayAgo
    );
    const weekConversations = allConversations.filter(
      (c) => c.startTime > oneWeekAgo
    );

    const avgDuration =
      allConversations
        .filter((c) => c.endTime)
        .reduce((sum, c) => sum + (c.endTime! - c.startTime), 0) /
      allConversations.filter((c) => c.endTime).length;

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
