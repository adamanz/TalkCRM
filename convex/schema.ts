import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Store Salesforce OAuth credentials
  salesforceAuth: defineTable({
    accessToken: v.string(),
    refreshToken: v.string(),
    instanceUrl: v.string(),
    expiresAt: v.number(),
    userId: v.optional(v.string()), // Salesforce User ID
  }),

  // Log all voice conversations
  conversations: defineTable({
    conversationId: v.string(), // ElevenLabs conversation ID
    callerPhone: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("failed")),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    salesforceRecordsAccessed: v.array(v.string()), // Record IDs accessed
    salesforceRecordsModified: v.array(v.string()), // Record IDs created/updated
  }).index("by_conversation_id", ["conversationId"]),

  // Log individual tool calls for debugging/audit
  toolCalls: defineTable({
    conversationId: v.string(),
    toolName: v.string(),
    input: v.string(), // JSON stringified
    output: v.string(), // JSON stringified
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    durationMs: v.number(),
    timestamp: v.number(),
  }).index("by_conversation", ["conversationId"]),
});
