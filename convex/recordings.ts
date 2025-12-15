import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get recording by conversation ID
 */
export const getByConversation = query({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const recording = await ctx.db
      .query("recordings")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (!recording) return null;

    // Get the file URL
    const url = await ctx.storage.getUrl(recording.fileId);
    return { ...recording, url };
  },
});

/**
 * Get all recordings for a user
 */
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const recordings = await ctx.db
      .query("recordings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);

    // Get URLs for all recordings
    const withUrls = await Promise.all(
      recordings.map(async (recording) => {
        const url = await ctx.storage.getUrl(recording.fileId);
        return { ...recording, url };
      })
    );

    return withUrls;
  },
});

/**
 * Get recording by ID
 */
export const get = query({
  args: { id: v.id("recordings") },
  handler: async (ctx, args) => {
    const recording = await ctx.db.get(args.id);
    if (!recording) return null;

    const url = await ctx.storage.getUrl(recording.fileId);
    return { ...recording, url };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Generate upload URL for direct browser upload
 */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create recording record after file upload
 */
export const create = mutation({
  args: {
    conversationId: v.string(),
    userId: v.optional(v.id("users")),
    fileId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    durationSeconds: v.optional(v.number()),
    source: v.union(v.literal("twilio"), v.literal("elevenlabs"), v.literal("upload")),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recordingId = await ctx.db.insert("recordings", {
      ...args,
      createdAt: Date.now(),
    });

    // Update the conversation with the recording ID
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (conversation) {
      await ctx.db.patch(conversation._id, {
        recordingId,
        durationSeconds: args.durationSeconds,
      });
    }

    return recordingId;
  },
});

/**
 * Internal mutation to create recording (used by actions)
 */
export const createInternal = internalMutation({
  args: {
    conversationId: v.string(),
    userId: v.optional(v.id("users")),
    fileId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    durationSeconds: v.optional(v.number()),
    source: v.union(v.literal("twilio"), v.literal("elevenlabs"), v.literal("upload")),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recordingId = await ctx.db.insert("recordings", {
      ...args,
      createdAt: Date.now(),
    });

    // Update the conversation with the recording ID
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (conversation) {
      await ctx.db.patch(conversation._id, {
        recordingId,
        durationSeconds: args.durationSeconds,
      });
    }

    return recordingId;
  },
});

/**
 * Delete a recording
 */
export const remove = mutation({
  args: { id: v.id("recordings") },
  handler: async (ctx, args) => {
    const recording = await ctx.db.get(args.id);
    if (!recording) throw new Error("Recording not found");

    // Delete the file from storage
    await ctx.storage.delete(recording.fileId);

    // Update the conversation to remove reference
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) => q.eq("conversationId", recording.conversationId))
      .first();

    if (conversation && conversation.recordingId === args.id) {
      await ctx.db.patch(conversation._id, { recordingId: undefined });
    }

    // Delete the recording record
    await ctx.db.delete(args.id);
  },
});

// ============================================================================
// ACTIONS (External API calls)
// ============================================================================

/**
 * Fetch and store recording from Twilio
 */
export const fetchFromTwilio = action({
  args: {
    conversationId: v.string(),
    recordingUrl: v.string(),
    userId: v.optional(v.id("users")),
    durationSeconds: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    recordingId: v.optional(v.id("recordings")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; recordingId?: Id<"recordings">; error?: string }> => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.error("Twilio credentials not configured for recording fetch");
      return { success: false, error: "Twilio not configured" };
    }

    try {
      // Fetch the recording from Twilio (add .mp3 extension for audio format)
      const recordingUrlWithFormat = args.recordingUrl.endsWith(".mp3")
        ? args.recordingUrl
        : `${args.recordingUrl}.mp3`;

      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const response = await fetch(recordingUrlWithFormat, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch recording: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Upload to Convex storage
      const fileId = await ctx.storage.store(new Blob([arrayBuffer], { type: "audio/mpeg" }));

      // Create recording record
      const recordingId = await ctx.runMutation(internal.recordings.createInternal, {
        conversationId: args.conversationId,
        userId: args.userId,
        fileId,
        fileName: `call_${args.conversationId}.mp3`,
        mimeType: "audio/mpeg",
        sizeBytes: arrayBuffer.byteLength,
        durationSeconds: args.durationSeconds,
        source: "twilio",
        sourceUrl: args.recordingUrl,
      });

      return { success: true, recordingId };
    } catch (error: any) {
      console.error("Failed to fetch Twilio recording:", error);
      return { success: false, error: error.message };
    }
  },
});

/**
 * Fetch and store recording from ElevenLabs (if available)
 */
export const fetchFromElevenLabs = action({
  args: {
    conversationId: v.string(),
    audioUrl: v.string(),
    userId: v.optional(v.id("users")),
    durationSeconds: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    recordingId: v.optional(v.id("recordings")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; recordingId?: Id<"recordings">; error?: string }> => {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["xi-api-key"] = apiKey;
      }

      const response = await fetch(args.audioUrl, { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch recording: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const contentType = response.headers.get("content-type") || "audio/mpeg";

      // Upload to Convex storage
      const fileId = await ctx.storage.store(new Blob([arrayBuffer], { type: contentType }));

      // Create recording record
      const recordingId = await ctx.runMutation(internal.recordings.createInternal, {
        conversationId: args.conversationId,
        userId: args.userId,
        fileId,
        fileName: `call_${args.conversationId}.${contentType.includes("wav") ? "wav" : "mp3"}`,
        mimeType: contentType,
        sizeBytes: arrayBuffer.byteLength,
        durationSeconds: args.durationSeconds,
        source: "elevenlabs",
        sourceUrl: args.audioUrl,
      });

      return { success: true, recordingId };
    } catch (error: any) {
      console.error("Failed to fetch ElevenLabs recording:", error);
      return { success: false, error: error.message };
    }
  },
});
