import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================================================
  // USER MANAGEMENT (Multi-tenant support)
  // ============================================================================

  // Users table - each user has their own Salesforce connection
  users: defineTable({
    email: v.string(),
    name: v.string(),
    // Verified phone numbers that can authenticate via Caller ID
    verifiedPhones: v.array(v.string()), // E.164 format: ["+14155551234"]
    primaryPhone: v.optional(v.string()), // Main phone for SMS notifications
    // Account status
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("pending")),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
    // Subscription tier (for future use)
    tier: v.optional(v.union(v.literal("free"), v.literal("starter"), v.literal("pro"), v.literal("enterprise"))),
  })
    .index("by_email", ["email"])
    .index("by_phone", ["verifiedPhones"]), // Look up user by any verified phone

  // Phone verification codes (temporary, auto-expire)
  phoneVerifications: defineTable({
    phone: v.string(), // E.164 format
    code: v.string(), // 6-digit code
    userId: v.optional(v.id("users")), // If adding to existing user
    email: v.optional(v.string()), // If new signup
    name: v.optional(v.string()), // If new signup
    attempts: v.number(), // Track failed attempts (max 3)
    expiresAt: v.number(), // Auto-expire after 10 minutes
    createdAt: v.number(),
  })
    .index("by_phone", ["phone"])
    .index("by_expires", ["expiresAt"]),

  // ============================================================================
  // SALESFORCE AUTH (Now per-user)
  // ============================================================================

  // Store Salesforce OAuth credentials per user
  salesforceAuth: defineTable({
    userId: v.id("users"), // Link to user
    accessToken: v.string(),
    refreshToken: v.string(),
    instanceUrl: v.string(),
    expiresAt: v.number(),
    salesforceUserId: v.optional(v.string()), // Salesforce User ID for this connection
  }).index("by_user", ["userId"]),

  // ============================================================================
  // CONVERSATIONS (Now linked to users)
  // ============================================================================

  // Log all voice conversations
  conversations: defineTable({
    conversationId: v.string(), // ElevenLabs/Twilio Call SID
    userId: v.optional(v.id("users")), // Which user made this call
    callerPhone: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    durationSeconds: v.optional(v.number()), // Call duration
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("failed")),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    salesforceRecordsAccessed: v.array(v.string()), // Record IDs accessed
    salesforceRecordsModified: v.array(v.string()), // Record IDs created/updated
    // Recording reference
    recordingId: v.optional(v.id("recordings")),
  })
    .index("by_conversation_id", ["conversationId"])
    .index("by_user", ["userId"]),

  // Call recordings stored in Convex file storage
  recordings: defineTable({
    conversationId: v.string(), // Link to conversation
    userId: v.optional(v.id("users")),
    fileId: v.id("_storage"), // Convex file storage ID
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    durationSeconds: v.optional(v.number()),
    source: v.union(v.literal("twilio"), v.literal("elevenlabs"), v.literal("upload")),
    sourceUrl: v.optional(v.string()), // Original URL from provider
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"]),

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

  // Real-time agent activity feed for dashboard
  agentActivities: defineTable({
    type: v.union(
      v.literal("thinking"),
      v.literal("searching"),
      v.literal("found"),
      v.literal("creating"),
      v.literal("updating"),
      v.literal("success"),
      v.literal("error")
    ),
    message: v.string(), // Human-readable description
    toolName: v.optional(v.string()),
    recordId: v.optional(v.string()), // Salesforce record ID for navigation
    recordName: v.optional(v.string()), // Record name for display
    recordType: v.optional(v.string()), // Account, Contact, Opportunity, etc.
    conversationId: v.optional(v.string()),
    timestamp: v.number(),
    expiresAt: v.number(), // Auto-cleanup old activities
  }).index("by_timestamp", ["timestamp"])
    .index("by_expires", ["expiresAt"]),
});
