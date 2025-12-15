import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================================
// USAGE ANALYTICS QUERIES
// ============================================================================

/**
 * Get overall usage stats for a user
 */
export const getUserUsage = query({
  args: {
    userId: v.id("users"),
    days: v.optional(v.number()), // Default to 30 days
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

    // Get conversations for the user in the time period
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const recentConversations = conversations.filter(
      (c) => c.startTime >= startTime
    );

    // Calculate stats
    const totalCalls = recentConversations.length;
    const completedCalls = recentConversations.filter(
      (c) => c.status === "completed"
    ).length;

    // Calculate total duration
    const totalDurationSeconds = recentConversations.reduce((sum, c) => {
      if (c.durationSeconds) return sum + c.durationSeconds;
      if (c.endTime) return sum + Math.round((c.endTime - c.startTime) / 1000);
      return sum;
    }, 0);

    // Get tool calls for these conversations
    const conversationIds = recentConversations.map((c) => c.conversationId);
    const toolCalls = await ctx.db.query("toolCalls").collect();
    const relevantToolCalls = toolCalls.filter((tc) =>
      conversationIds.includes(tc.conversationId)
    );

    // Group tool calls by type
    const toolUsage = relevantToolCalls.reduce(
      (acc, tc) => {
        acc[tc.toolName] = (acc[tc.toolName] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Records touched
    const recordsAccessed = recentConversations.reduce(
      (sum, c) => sum + c.salesforceRecordsAccessed.length,
      0
    );
    const recordsModified = recentConversations.reduce(
      (sum, c) => sum + c.salesforceRecordsModified.length,
      0
    );

    return {
      period: { days, startTime, endTime: Date.now() },
      calls: {
        total: totalCalls,
        completed: completedCalls,
        avgDurationSeconds: totalCalls > 0 ? Math.round(totalDurationSeconds / totalCalls) : 0,
        totalDurationMinutes: Math.round(totalDurationSeconds / 60),
      },
      tools: {
        totalCalls: relevantToolCalls.length,
        byType: toolUsage,
        successRate: relevantToolCalls.length > 0
          ? Math.round(
              (relevantToolCalls.filter((tc) => tc.success).length /
                relevantToolCalls.length) *
                100
            )
          : 100,
      },
      salesforce: {
        recordsAccessed,
        recordsModified,
      },
    };
  },
});

/**
 * Get daily usage breakdown for charting
 */
export const getDailyUsage = query({
  args: {
    userId: v.optional(v.id("users")),
    days: v.optional(v.number()), // Default to 7 days
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 7;
    const now = Date.now();
    const startTime = now - days * 24 * 60 * 60 * 1000;

    // Get conversations
    let conversations;
    if (args.userId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    } else {
      conversations = await ctx.db.query("conversations").collect();
    }

    const recentConversations = conversations.filter(
      (c) => c.startTime >= startTime
    );

    // Group by day
    const dailyStats: Record<
      string,
      { calls: number; duration: number; date: string }
    > = {};

    // Initialize all days
    for (let i = 0; i < days; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      dailyStats[dateStr] = { calls: 0, duration: 0, date: dateStr };
    }

    // Populate with data
    for (const conv of recentConversations) {
      const dateStr = new Date(conv.startTime).toISOString().split("T")[0];
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].calls += 1;
        if (conv.durationSeconds) {
          dailyStats[dateStr].duration += conv.durationSeconds;
        } else if (conv.endTime) {
          dailyStats[dateStr].duration += Math.round(
            (conv.endTime - conv.startTime) / 1000
          );
        }
      }
    }

    // Convert to array sorted by date
    return Object.values(dailyStats).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  },
});

/**
 * Get tool usage breakdown
 */
export const getToolUsage = query({
  args: {
    userId: v.optional(v.id("users")),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

    // Get conversations for filtering
    let conversationIds: string[] = [];
    if (args.userId) {
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      conversationIds = conversations
        .filter((c) => c.startTime >= startTime)
        .map((c) => c.conversationId);
    }

    // Get all tool calls
    const allToolCalls = await ctx.db.query("toolCalls").collect();

    // Filter by time and optionally by user
    const toolCalls = allToolCalls.filter((tc) => {
      if (tc.timestamp < startTime) return false;
      if (args.userId && !conversationIds.includes(tc.conversationId))
        return false;
      return true;
    });

    // Group by tool name
    const byTool = toolCalls.reduce(
      (acc, tc) => {
        if (!acc[tc.toolName]) {
          acc[tc.toolName] = {
            name: tc.toolName,
            count: 0,
            successCount: 0,
            totalDurationMs: 0,
          };
        }
        acc[tc.toolName].count += 1;
        if (tc.success) acc[tc.toolName].successCount += 1;
        acc[tc.toolName].totalDurationMs += tc.durationMs;
        return acc;
      },
      {} as Record<
        string,
        {
          name: string;
          count: number;
          successCount: number;
          totalDurationMs: number;
        }
      >
    );

    // Convert to sorted array
    return Object.values(byTool)
      .map((tool) => ({
        ...tool,
        avgDurationMs: Math.round(tool.totalDurationMs / tool.count),
        successRate: Math.round((tool.successCount / tool.count) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  },
});

/**
 * Get most frequently accessed Salesforce records
 */
export const getTopRecords = query({
  args: {
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // Get conversations
    let conversations;
    if (args.userId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    } else {
      conversations = await ctx.db.query("conversations").collect();
    }

    // Count record accesses
    const recordCounts: Record<string, { id: string; accessCount: number; modifyCount: number }> = {};

    for (const conv of conversations) {
      for (const recordId of conv.salesforceRecordsAccessed) {
        if (!recordCounts[recordId]) {
          recordCounts[recordId] = { id: recordId, accessCount: 0, modifyCount: 0 };
        }
        recordCounts[recordId].accessCount += 1;
      }
      for (const recordId of conv.salesforceRecordsModified) {
        if (!recordCounts[recordId]) {
          recordCounts[recordId] = { id: recordId, accessCount: 0, modifyCount: 0 };
        }
        recordCounts[recordId].modifyCount += 1;
      }
    }

    // Sort by total interactions and return top N
    return Object.values(recordCounts)
      .sort((a, b) => (b.accessCount + b.modifyCount) - (a.accessCount + a.modifyCount))
      .slice(0, limit);
  },
});

/**
 * Get summary analytics for admin dashboard
 */
export const getAdminDashboard = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Get all users
    const users = await ctx.db.query("users").collect();
    const activeUsers = users.filter((u) => u.status === "active");

    // Get all conversations
    const conversations = await ctx.db.query("conversations").collect();

    // Filter by time periods
    const todayConvs = conversations.filter((c) => c.startTime >= oneDayAgo);
    const weekConvs = conversations.filter((c) => c.startTime >= oneWeekAgo);
    const monthConvs = conversations.filter((c) => c.startTime >= oneMonthAgo);

    // Get unique active users (made a call in last 30 days)
    const activeUserIds = new Set(
      monthConvs.map((c) => c.userId).filter(Boolean)
    );

    // Calculate average calls per active user
    const callsPerUser = activeUserIds.size > 0
      ? Math.round(monthConvs.length / activeUserIds.size)
      : 0;

    return {
      users: {
        total: users.length,
        active: activeUsers.length,
        activeInLast30Days: activeUserIds.size,
      },
      calls: {
        today: todayConvs.length,
        thisWeek: weekConvs.length,
        thisMonth: monthConvs.length,
        total: conversations.length,
      },
      engagement: {
        avgCallsPerActiveUser: callsPerUser,
      },
    };
  },
});

// ============================================================================
// USAGE TRACKING MUTATIONS (for billing/quotas)
// ============================================================================

/**
 * Track a usage event (internal - called by other functions)
 */
export const trackUsageInternal = internalMutation({
  args: {
    userId: v.id("users"),
    eventType: v.string(), // "voice_command", "api_call", etc.
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // For now, we rely on conversations table for usage tracking
    // In the future, could add a dedicated usageEvents table for more granular tracking

    // Update user's last activity
    const user = await ctx.db.get(args.userId);
    if (user) {
      await ctx.db.patch(args.userId, {
        lastLoginAt: Date.now(),
      });
    }
  },
});
