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
    durationSeconds: v.optional(v.number()),
    callerPhone: v.optional(v.string()),
    // New ElevenLabs analytics fields
    elevenlabsAgentId: v.optional(v.string()),
    calledNumber: v.optional(v.string()),
    costCents: v.optional(v.number()),
    successEvaluation: v.optional(v.object({
      success: v.boolean(),
      criteriaResults: v.optional(v.array(v.object({
        criterionId: v.string(),
        name: v.string(),
        result: v.string(),
        rationale: v.optional(v.string()),
      }))),
    })),
    dataCollection: v.optional(v.any()),
    dynamicVariables: v.optional(v.any()),
    sentiment: v.optional(v.string()),
    turnCount: v.optional(v.number()),
  },
  returns: v.object({
    conversationId: v.id("conversations"),
    userId: v.optional(v.id("users")),
  }),
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
        durationSeconds: args.durationSeconds,
        callerPhone: args.callerPhone ?? conversation.callerPhone,
        // ElevenLabs analytics
        elevenlabsAgentId: args.elevenlabsAgentId,
        calledNumber: args.calledNumber,
        costCents: args.costCents,
        successEvaluation: args.successEvaluation,
        dataCollection: args.dataCollection,
        dynamicVariables: args.dynamicVariables,
        sentiment: args.sentiment,
        turnCount: args.turnCount,
      });
      return { conversationId: conversation._id, userId: conversation.userId };
    }

    // If we didn't see a "start" event (e.g. when using an ElevenLabs-managed phone number),
    // create the conversation record here.
    const newId = await ctx.db.insert("conversations", {
      conversationId: args.conversationId,
      callerPhone: args.callerPhone,
      startTime: args.startTime ?? args.endTime,
      endTime: args.endTime,
      durationSeconds: args.durationSeconds,
      status: "completed",
      transcript: args.transcript,
      summary: args.summary,
      salesforceRecordsAccessed: [],
      salesforceRecordsModified: [],
      // ElevenLabs analytics
      elevenlabsAgentId: args.elevenlabsAgentId,
      calledNumber: args.calledNumber,
      costCents: args.costCents,
      successEvaluation: args.successEvaluation,
      dataCollection: args.dataCollection,
      dynamicVariables: args.dynamicVariables,
      sentiment: args.sentiment,
      turnCount: args.turnCount,
    });
    return { conversationId: newId, userId: undefined };
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

/**
 * Update conversation with ElevenLabs conversation ID
 * Called when ElevenLabs conversation-start webhook fires with dynamic_variables
 * This maps the ElevenLabs conversation_id to our userId for per-user auth
 */
export const updateElevenlabsConversationId = internalMutation({
  args: {
    elevenlabsConversationId: v.string(),
    userId: v.string(),
    callerPhone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find the most recent active conversation for this user/phone
    // (the one we just created when Twilio webhook fired)
    let conversation;

    if (args.callerPhone) {
      // Find by caller phone (most reliable since we just created it)
      const recent = await ctx.db
        .query("conversations")
        .withIndex("by_user")
        .filter((q) => q.eq(q.field("callerPhone"), args.callerPhone))
        .order("desc")
        .first();
      conversation = recent;
    }

    if (!conversation) {
      // Fallback: find most recent active conversation for this user
      const allActive = await ctx.db
        .query("conversations")
        .filter((q) => q.eq(q.field("status"), "active"))
        .order("desc")
        .take(10);

      // Find one matching the userId
      conversation = allActive.find(c => c.userId === args.userId);
    }

    if (conversation) {
      await ctx.db.patch(conversation._id, {
        elevenlabsConversationId: args.elevenlabsConversationId,
      });
      console.log(`Mapped ElevenLabs ${args.elevenlabsConversationId} to conversation ${conversation._id}`);
    } else {
      // Create new mapping record if no existing conversation found
      console.log(`No active conversation found for userId ${args.userId}, creating new entry`);
      await ctx.db.insert("conversations", {
        conversationId: args.elevenlabsConversationId, // Use ElevenLabs ID as primary
        elevenlabsConversationId: args.elevenlabsConversationId,
        userId: args.userId as any,
        callerPhone: args.callerPhone,
        startTime: Date.now(),
        status: "active",
        salesforceRecordsAccessed: [],
        salesforceRecordsModified: [],
      });
    }
    return null;
  },
});

/**
 * Get conversation by ElevenLabs conversation ID
 * Used by /tools/assistant to look up userId for per-user Salesforce auth
 */
export const getConversationByElevenlabsId = query({
  args: {
    elevenlabsConversationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_elevenlabs_id", (q) => q.eq("elevenlabsConversationId", args.elevenlabsConversationId))
      .first();
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
  handler: async (ctx, args) => {
    // If userId is provided, filter by user
    let conversations;
    if (args.userId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(args.limit || 50);
    } else {
      // Otherwise return all (for admin view)
      conversations = await ctx.db
        .query("conversations")
        .order("desc")
        .take(args.limit || 50);
    }

    // Return with key analytics fields for list view
    return conversations.map((c) => ({
      _id: c._id,
      _creationTime: c._creationTime,
      conversationId: c.conversationId,
      userId: c.userId,
      callerPhone: c.callerPhone,
      calledNumber: c.calledNumber,
      startTime: c.startTime,
      endTime: c.endTime,
      durationSeconds: c.durationSeconds,
      status: c.status,
      summary: c.summary,
      // Key analytics for list view
      costCents: c.costCents,
      turnCount: c.turnCount,
      sentiment: c.sentiment,
      successEvaluation: c.successEvaluation,
      salesforceRecordsAccessed: c.salesforceRecordsAccessed,
      salesforceRecordsModified: c.salesforceRecordsModified,
    }));
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

    // Return full conversation with all analytics fields
    return {
      _id: conversation._id,
      _creationTime: conversation._creationTime,
      conversationId: conversation.conversationId,
      elevenlabsAgentId: conversation.elevenlabsAgentId,
      userId: conversation.userId,
      callerPhone: conversation.callerPhone,
      calledNumber: conversation.calledNumber,
      startTime: conversation.startTime,
      endTime: conversation.endTime,
      durationSeconds: conversation.durationSeconds,
      status: conversation.status,
      transcript: conversation.transcript,
      summary: conversation.summary,
      salesforceRecordsAccessed: conversation.salesforceRecordsAccessed,
      salesforceRecordsModified: conversation.salesforceRecordsModified,
      recordingId: conversation.recordingId,
      // ElevenLabs Analytics
      costCents: conversation.costCents,
      successEvaluation: conversation.successEvaluation,
      dataCollection: conversation.dataCollection,
      dynamicVariables: conversation.dynamicVariables,
      sentiment: conversation.sentiment,
      turnCount: conversation.turnCount,
      // Tool calls
      toolCalls,
    };
  },
});

export const getConversationStats = query({
  args: {
    userId: v.optional(v.id("users")), // Filter by user
  },
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

    // ElevenLabs Analytics
    const conversationsWithCost = allConversations.filter((c) => c.costCents != null);
    const totalCostCents = conversationsWithCost.reduce((sum, c) => sum + (c.costCents || 0), 0);

    const conversationsWithEval = allConversations.filter((c) => c.successEvaluation != null);
    const successfulCalls = conversationsWithEval.filter((c) => c.successEvaluation?.success);
    const successRate = conversationsWithEval.length > 0
      ? (successfulCalls.length / conversationsWithEval.length) * 100
      : null;

    const conversationsWithTurns = allConversations.filter((c) => c.turnCount != null);
    const avgTurns = conversationsWithTurns.length > 0
      ? conversationsWithTurns.reduce((sum, c) => sum + (c.turnCount || 0), 0) / conversationsWithTurns.length
      : null;

    // Sentiment breakdown
    const sentimentCounts = {
      positive: allConversations.filter((c) => c.sentiment === "positive").length,
      neutral: allConversations.filter((c) => c.sentiment === "neutral").length,
      negative: allConversations.filter((c) => c.sentiment === "negative").length,
    };

    return {
      // Basic stats
      total: allConversations.length,
      today: todayConversations.length,
      thisWeek: weekConversations.length,
      avgDurationSeconds: Math.round(avgDuration / 1000) || 0,
      // Salesforce integration
      recordsAccessed: allConversations.reduce(
        (sum, c) => sum + c.salesforceRecordsAccessed.length,
        0
      ),
      recordsModified: allConversations.reduce(
        (sum, c) => sum + c.salesforceRecordsModified.length,
        0
      ),
      // ElevenLabs Analytics
      totalCostCents,
      totalCostDollars: totalCostCents / 100,
      successRate: successRate !== null ? Math.round(successRate) : null,
      successfulCalls: successfulCalls.length,
      evaluatedCalls: conversationsWithEval.length,
      avgTurnsPerCall: avgTurns !== null ? Math.round(avgTurns * 10) / 10 : null,
      sentimentBreakdown: sentimentCounts,
    };
  },
});

/**
 * Get detailed analytics for a time period
 * Includes daily breakdown, top metrics, and trends
 */
export const getConversationAnalytics = query({
  args: {
    userId: v.optional(v.id("users")),
    days: v.optional(v.number()), // Default 30 days
  },
  handler: async (ctx, args) => {
    const daysToAnalyze = args.days || 30;
    const now = Date.now();
    const startDate = now - daysToAnalyze * 24 * 60 * 60 * 1000;

    // Get conversations in date range
    let conversations;
    if (args.userId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    } else {
      conversations = await ctx.db.query("conversations").collect();
    }

    // Filter to date range
    const filtered = conversations.filter((c) => c.startTime >= startDate);

    // Group by day
    const dailyStats: Record<string, {
      date: string;
      calls: number;
      totalDurationSecs: number;
      totalCostCents: number;
      successfulCalls: number;
      evaluatedCalls: number;
    }> = {};

    filtered.forEach((c) => {
      const date = new Date(c.startTime).toISOString().split("T")[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          calls: 0,
          totalDurationSecs: 0,
          totalCostCents: 0,
          successfulCalls: 0,
          evaluatedCalls: 0,
        };
      }
      dailyStats[date].calls++;
      dailyStats[date].totalDurationSecs += c.durationSeconds || 0;
      dailyStats[date].totalCostCents += c.costCents || 0;
      if (c.successEvaluation != null) {
        dailyStats[date].evaluatedCalls++;
        if (c.successEvaluation.success) {
          dailyStats[date].successfulCalls++;
        }
      }
    });

    // Sort by date
    const dailyBreakdown = Object.values(dailyStats).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Calculate totals
    const totalCalls = filtered.length;
    const totalDurationSecs = filtered.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
    const totalCostCents = filtered.reduce((sum, c) => sum + (c.costCents || 0), 0);

    const evaluatedCalls = filtered.filter((c) => c.successEvaluation != null);
    const successfulCalls = evaluatedCalls.filter((c) => c.successEvaluation?.success);

    // Find most common data collection fields
    const dataCollectionFields: Record<string, number> = {};
    filtered.forEach((c) => {
      if (c.dataCollection && typeof c.dataCollection === "object") {
        Object.keys(c.dataCollection as object).forEach((key) => {
          dataCollectionFields[key] = (dataCollectionFields[key] || 0) + 1;
        });
      }
    });

    // Top callers (by phone)
    const callerCounts: Record<string, number> = {};
    filtered.forEach((c) => {
      if (c.callerPhone) {
        callerCounts[c.callerPhone] = (callerCounts[c.callerPhone] || 0) + 1;
      }
    });
    const topCallers = Object.entries(callerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([phone, count]) => ({ phone, count }));

    return {
      period: {
        days: daysToAnalyze,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(now).toISOString(),
      },
      summary: {
        totalCalls,
        avgCallsPerDay: Math.round((totalCalls / daysToAnalyze) * 10) / 10,
        totalDurationMinutes: Math.round(totalDurationSecs / 60),
        avgDurationSeconds: totalCalls > 0 ? Math.round(totalDurationSecs / totalCalls) : 0,
        totalCostDollars: Math.round(totalCostCents) / 100,
        avgCostPerCallCents: totalCalls > 0 ? Math.round(totalCostCents / totalCalls) : 0,
        successRate: evaluatedCalls.length > 0
          ? Math.round((successfulCalls.length / evaluatedCalls.length) * 100)
          : null,
        evaluatedCallsCount: evaluatedCalls.length,
      },
      dailyBreakdown,
      topCallers,
      dataCollectionFields: Object.entries(dataCollectionFields)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([field, count]) => ({ field, count })),
    };
  },
});
