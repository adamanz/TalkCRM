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

  // Store per-org Connected App credentials (for multi-tenant OAuth)
  orgCredentials: defineTable({
    instanceUrl: v.string(), // e.g., https://mycompany.my.salesforce.com
    consumerKey: v.string(),
    consumerSecret: v.string(), // Encrypted/stored securely
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_instance", ["instanceUrl"]),

  // Store org metadata (available objects, custom fields, etc.) for AI context
  orgMetadata: defineTable({
    instanceUrl: v.string(), // e.g., https://mycompany.my.salesforce.com
    // Standard objects available in this org (subset that are commonly used)
    standardObjects: v.array(v.object({
      name: v.string(),      // API name: Account, Contact, Opportunity, etc.
      label: v.string(),     // Human label: Account, Contact, Opportunity
      queryable: v.boolean(), // Can be queried via SOQL
    })),
    // Custom objects in this org (ending in __c) with rich metadata
    customObjects: v.array(v.object({
      name: v.string(),      // API name: MyCustomObject__c
      label: v.string(),     // Human label: My Custom Object
      queryable: v.boolean(),
      // Rich metadata from Describe API
      description: v.optional(v.string()), // Object description from Salesforce
      // keyFields can be simple strings (old format) or rich objects (new format)
      keyFields: v.optional(v.array(
        v.union(
          v.string(), // Old format: just field names
          v.object({  // New format: rich field metadata
            name: v.string(),
            label: v.string(),
            type: v.string(),
            helpText: v.optional(v.string()),
            picklistValues: v.optional(v.array(v.string())),
            referenceTo: v.optional(v.string()),
          })
        )
      )),
      // Sample record data for AI context (anonymized field names + values)
      sampleFields: v.optional(v.array(v.string())), // Fields that are commonly populated
      recordCount: v.optional(v.number()), // Approximate record count
    })),
    // Last time metadata was synced
    lastSyncedAt: v.number(),
    // Sync status
    syncStatus: v.union(v.literal("pending"), v.literal("syncing"), v.literal("complete"), v.literal("error")),
    syncError: v.optional(v.string()),
  }).index("by_instance", ["instanceUrl"]),

  // ============================================================================
  // CONVERSATIONS (Now linked to users)
  // ============================================================================

  // Log all voice conversations
  conversations: defineTable({
    conversationId: v.string(), // Twilio Call SID
    elevenlabsConversationId: v.optional(v.string()), // ElevenLabs conversation ID (different from Twilio)
    elevenlabsAgentId: v.optional(v.string()), // ElevenLabs agent ID
    userId: v.optional(v.id("users")), // Which user made this call
    callerPhone: v.optional(v.string()),
    calledNumber: v.optional(v.string()), // Destination phone number
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
    // ElevenLabs Analytics
    costCents: v.optional(v.number()), // Call cost in cents
    // Success Evaluation from ElevenLabs
    successEvaluation: v.optional(v.object({
      success: v.boolean(),
      criteriaResults: v.optional(v.array(v.object({
        criterionId: v.string(),
        name: v.string(),
        result: v.string(), // "success", "failure", "unknown"
        rationale: v.optional(v.string()),
      }))),
    })),
    // Data Collection - extracted structured data from conversation
    dataCollection: v.optional(v.any()), // Flexible JSON for extracted data
    // Dynamic variables that were passed to ElevenLabs
    dynamicVariables: v.optional(v.any()),
    // Sentiment/mood analysis
    sentiment: v.optional(v.string()), // positive, negative, neutral
    // Turn count
    turnCount: v.optional(v.number()),
  })
    .index("by_conversation_id", ["conversationId"])
    .index("by_elevenlabs_id", ["elevenlabsConversationId"])
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

  // ============================================================================
  // DEAL COACHING SESSIONS
  // ============================================================================

  // Store coaching sessions for deal practice with AI personas
  coachingSessions: defineTable({
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
    status: v.string(), // "active", "completed"
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    interactions: v.array(v.object({
      timestamp: v.number(),
      userMessage: v.string(),
      assistantMessage: v.string(),
    })),
    score: v.optional(v.number()),
    feedback: v.optional(v.string()),
    strengths: v.optional(v.array(v.string())),
    improvements: v.optional(v.array(v.string())),
    systemPrompt: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_opportunity", ["opportunityId"]),

  // ============================================================================
  // TEXT MESSAGING (AI-powered SMS/iMessage via SendBlue)
  // ============================================================================

  // Text conversation threads between users and TalkCRM
  textConversations: defineTable({
    userId: v.id("users"),
    userPhone: v.string(), // User's phone number (E.164)
    sendblueNumber: v.string(), // TalkCRM's SendBlue number they're texting
    lastMessageAt: v.number(),
    messageCount: v.number(),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_phone", ["userPhone"])
    .index("by_last_message", ["lastMessageAt"]),

  // Individual text messages for conversation history and AI context
  textMessages: defineTable({
    conversationId: v.id("textConversations"),
    userId: v.id("users"),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    content: v.string(),
    mediaUrl: v.optional(v.string()), // For MMS
    timestamp: v.number(),
    // SendBlue tracking
    messageHandle: v.optional(v.string()), // SendBlue message ID
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
    // AI metadata
    aiProcessed: v.optional(v.boolean()), // Was this processed by AI?
    salesforceAction: v.optional(v.string()), // What SF action was taken
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_message_handle", ["messageHandle"]),

  // ============================================================================
  // AI AGENT SESSIONS (Per-user chat context)
  // ============================================================================

  // Agent chat sessions - maintains context across interactions per user
  agentSessions: defineTable({
    userId: v.id("users"),
    // Session metadata
    title: v.optional(v.string()), // Auto-generated or user-defined title
    channel: v.union(
      v.literal("web"),      // Web chat interface
      v.literal("voice"),    // Voice call (links to conversation)
      v.literal("sms"),      // SMS (links to textConversation)
      v.literal("api")       // Direct API access
    ),
    // Link to source conversation if applicable
    sourceConversationId: v.optional(v.string()), // voice conversationId
    sourceTextConversationId: v.optional(v.id("textConversations")),
    // Session state
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("expired")),
    // Context summary - compressed context for long sessions
    contextSummary: v.optional(v.string()),
    // Salesforce context cached for this session
    salesforceContext: v.optional(v.object({
      recentRecords: v.optional(v.array(v.object({
        id: v.string(),
        type: v.string(),
        name: v.string(),
      }))),
      userInfo: v.optional(v.object({
        salesforceUserId: v.string(),
        userName: v.string(),
      })),
    })),
    // Timestamps
    createdAt: v.number(),
    lastMessageAt: v.number(),
    expiresAt: v.optional(v.number()), // Auto-expire inactive sessions
    // Stats
    messageCount: v.number(),
    tokenCount: v.optional(v.number()), // Track token usage
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "status"])
    .index("by_last_message", ["lastMessageAt"])
    .index("by_expires", ["expiresAt"]),

  // Individual messages in agent sessions
  agentMessages: defineTable({
    sessionId: v.id("agentSessions"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    timestamp: v.number(),
    // Token tracking for context management
    tokenCount: v.optional(v.number()),
    // Tool/action metadata
    toolCalls: v.optional(v.array(v.object({
      toolName: v.string(),
      input: v.any(),
      output: v.optional(v.any()),
      success: v.boolean(),
    }))),
    // Salesforce records referenced in this message
    referencedRecords: v.optional(v.array(v.object({
      id: v.string(),
      type: v.string(),
      name: v.string(),
    }))),
    // For context pruning - mark messages as summarized
    summarized: v.optional(v.boolean()),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"]),
});
