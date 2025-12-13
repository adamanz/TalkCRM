import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Activity types for the real-time feed
const activityType = v.union(
  v.literal("thinking"),
  v.literal("searching"),
  v.literal("found"),
  v.literal("creating"),
  v.literal("updating"),
  v.literal("success"),
  v.literal("error")
);

// ============================================================================
// MUTATIONS (For logging activities)
// ============================================================================

/**
 * Log a new agent activity - called from HTTP endpoints
 */
export const logActivity = mutation({
  args: {
    type: activityType,
    message: v.string(),
    toolName: v.optional(v.string()),
    recordId: v.optional(v.string()),
    recordName: v.optional(v.string()),
    recordType: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  returns: v.id("agentActivities"),
  handler: async (ctx, args) => {
    const now = Date.now();
    // Activities expire after 5 minutes
    const expiresAt = now + 5 * 60 * 1000;

    return await ctx.db.insert("agentActivities", {
      ...args,
      timestamp: now,
      expiresAt,
    });
  },
});

/**
 * Internal mutation for logging from HTTP actions
 */
export const logActivityInternal = internalMutation({
  args: {
    type: activityType,
    message: v.string(),
    toolName: v.optional(v.string()),
    recordId: v.optional(v.string()),
    recordName: v.optional(v.string()),
    recordType: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  returns: v.id("agentActivities"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000;

    return await ctx.db.insert("agentActivities", {
      ...args,
      timestamp: now,
      expiresAt,
    });
  },
});

/**
 * Clear old activities (can be called periodically)
 */
export const clearExpiredActivities = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("agentActivities")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .collect();

    for (const activity of expired) {
      await ctx.db.delete(activity._id);
    }

    return expired.length;
  },
});

// ============================================================================
// QUERIES (For dashboard subscription)
// ============================================================================

/**
 * Get recent activities for real-time feed
 * Dashboard subscribes to this for live updates
 */
export const getRecentActivities = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("agentActivities"),
      _creationTime: v.number(),
      type: activityType,
      message: v.string(),
      toolName: v.optional(v.string()),
      recordId: v.optional(v.string()),
      recordName: v.optional(v.string()),
      recordType: v.optional(v.string()),
      conversationId: v.optional(v.string()),
      timestamp: v.number(),
      expiresAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query("agentActivities")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 20);

    return activities;
  },
});

/**
 * Get the latest activity (for showing current status)
 */
export const getLatestActivity = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("agentActivities"),
      _creationTime: v.number(),
      type: activityType,
      message: v.string(),
      toolName: v.optional(v.string()),
      recordId: v.optional(v.string()),
      recordName: v.optional(v.string()),
      recordType: v.optional(v.string()),
      conversationId: v.optional(v.string()),
      timestamp: v.number(),
      expiresAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const activity = await ctx.db
      .query("agentActivities")
      .withIndex("by_timestamp")
      .order("desc")
      .first();

    return activity;
  },
});
