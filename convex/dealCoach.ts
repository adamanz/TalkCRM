import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

// ============================================================================
// COACHING SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new coaching session (internal - called from anam.ts)
 */
export const createCoachingSession = internalMutation({
  args: {
    opportunityId: v.string(),
    opportunityName: v.string(),
    personaType: v.string(),
    personaName: v.string(),
    userId: v.optional(v.id("users")),
    dealContext: v.object({
      amount: v.optional(v.number()),
      stage: v.optional(v.string()),
      closeDate: v.optional(v.string()),
      accountName: v.optional(v.string()),
      industry: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("coachingSessions", {
      opportunityId: args.opportunityId,
      opportunityName: args.opportunityName,
      personaType: args.personaType,
      personaName: args.personaName,
      userId: args.userId,
      dealContext: args.dealContext,
      status: "active",
      startedAt: Date.now(),
      interactions: [],
      score: undefined,
      feedback: undefined,
    });

    return sessionId;
  },
});

/**
 * Get a coaching session by ID (internal)
 */
export const getCoachingSession = internalQuery({
  args: {
    sessionId: v.id("coachingSessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

/**
 * Get a coaching session by ID (public - for frontend)
 */
export const getSession = query({
  args: {
    sessionId: v.id("coachingSessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

/**
 * Log an interaction during the coaching session
 */
export const logCoachingInteraction = internalMutation({
  args: {
    sessionId: v.id("coachingSessions"),
    userMessage: v.string(),
    assistantMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const interaction = {
      timestamp: Date.now(),
      userMessage: args.userMessage,
      assistantMessage: args.assistantMessage,
    };

    await ctx.db.patch(args.sessionId, {
      interactions: [...(session.interactions || []), interaction],
    });
  },
});

/**
 * End a coaching session and generate feedback
 */
export const endSession = mutation({
  args: {
    sessionId: v.id("coachingSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      endedAt: Date.now(),
    });

    return {
      sessionId: args.sessionId,
      duration: Date.now() - session.startedAt,
      interactionCount: session.interactions?.length || 0,
    };
  },
});

/**
 * Save feedback and score for a session
 */
export const saveSessionFeedback = internalMutation({
  args: {
    sessionId: v.id("coachingSessions"),
    score: v.number(),
    feedback: v.string(),
    strengths: v.array(v.string()),
    improvements: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      score: args.score,
      feedback: args.feedback,
      strengths: args.strengths,
      improvements: args.improvements,
    });
  },
});

/**
 * Get all coaching sessions for a user
 */
export const getUserSessions = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("coachingSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 20);

    return sessions.map((s) => ({
      id: s._id,
      opportunityName: s.opportunityName,
      personaType: s.personaType,
      personaName: s.personaName,
      status: s.status,
      score: s.score,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      interactionCount: s.interactions?.length || 0,
    }));
  },
});

/**
 * Get coaching sessions for a specific opportunity
 */
export const getOpportunitySessions = query({
  args: {
    opportunityId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("coachingSessions")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .order("desc")
      .take(args.limit || 10);

    return sessions;
  },
});

/**
 * Get coaching statistics for a user
 */
export const getUserCoachingStats = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("coachingSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const completedSessions = sessions.filter((s) => s.status === "completed");
    const scoredSessions = completedSessions.filter((s) => s.score !== null);

    const totalPracticeTime = completedSessions.reduce((acc, s) => {
      if (s.endedAt && s.startedAt) {
        return acc + (s.endedAt - s.startedAt);
      }
      return acc;
    }, 0);

    const averageScore = scoredSessions.length > 0
      ? scoredSessions.reduce((acc, s) => acc + (s.score || 0), 0) / scoredSessions.length
      : null;

    // Count sessions by persona type
    const sessionsByPersona = sessions.reduce((acc, s) => {
      acc[s.personaType] = (acc[s.personaType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      totalPracticeTimeMs: totalPracticeTime,
      totalPracticeTimeMinutes: Math.round(totalPracticeTime / 1000 / 60),
      averageScore,
      sessionsByPersona,
      recentSessions: sessions.slice(0, 5).map((s) => ({
        id: s._id,
        opportunityName: s.opportunityName,
        personaType: s.personaType,
        score: s.score,
        startedAt: s.startedAt,
      })),
    };
  },
});

// ============================================================================
// DEAL-SPECIFIC COACHING HELPERS
// ============================================================================

/**
 * Get recommended personas for a deal based on its stage
 */
export const getRecommendedPersonas = query({
  args: {
    stage: v.string(),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const recommendations: { personaType: string; reason: string; priority: number }[] = [];

    // Early stages - focus on champions and technical
    if (["Prospecting", "Qualification", "Needs Analysis"].includes(args.stage)) {
      recommendations.push({
        personaType: "friendly_champion",
        reason: "Build internal support early in the deal",
        priority: 1,
      });
      recommendations.push({
        personaType: "technical_evaluator",
        reason: "Technical validation is often an early blocker",
        priority: 2,
      });
    }

    // Mid stages - focus on value and technical
    if (["Value Proposition", "Id. Decision Makers", "Proposal/Price Quote"].includes(args.stage)) {
      recommendations.push({
        personaType: "skeptical_cfo",
        reason: "Prepare for executive-level ROI discussions",
        priority: 1,
      });
      recommendations.push({
        personaType: "technical_evaluator",
        reason: "Ensure technical concerns are addressed",
        priority: 2,
      });
    }

    // Late stages - focus on procurement and closing objections
    if (["Negotiation/Review", "Closed Won", "Closed Lost"].includes(args.stage)) {
      recommendations.push({
        personaType: "procurement_gatekeeper",
        reason: "Prepare for procurement negotiations",
        priority: 1,
      });
      recommendations.push({
        personaType: "skeptical_cfo",
        reason: "Final executive sign-off preparation",
        priority: 2,
      });
    }

    // High-value deals always benefit from CFO practice
    if (args.amount && args.amount > 100000) {
      const hasCfo = recommendations.some((r) => r.personaType === "skeptical_cfo");
      if (!hasCfo) {
        recommendations.push({
          personaType: "skeptical_cfo",
          reason: "High-value deal - CFO approval likely required",
          priority: 1,
        });
      }
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  },
});

/**
 * Get coaching tips based on deal characteristics
 */
export const getDealCoachingTips = query({
  args: {
    opportunityId: v.string(),
    stage: v.string(),
    amount: v.optional(v.number()),
    daysToClose: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const tips: { category: string; tip: string }[] = [];

    // Stage-specific tips
    if (args.stage === "Negotiation/Review") {
      tips.push({
        category: "Negotiation",
        tip: "Practice handling discount requests without giving away value. Focus on trading, not conceding.",
      });
      tips.push({
        category: "Urgency",
        tip: "Prepare responses for 'we need more time' objections with concrete reasons for timeline.",
      });
    }

    // Amount-specific tips
    if (args.amount && args.amount > 50000) {
      tips.push({
        category: "Stakeholders",
        tip: "For deals this size, expect multi-threaded evaluation. Practice your CFO pitch.",
      });
    }

    // Timeline-specific tips
    if (args.daysToClose && args.daysToClose < 14) {
      tips.push({
        category: "Closing",
        tip: "With close date approaching, practice handling last-minute objections and procurement delays.",
      });
    }

    // Generic tips
    tips.push({
      category: "Discovery",
      tip: "Always tie back to the specific pain points discovered in your conversations.",
    });

    return tips;
  },
});
