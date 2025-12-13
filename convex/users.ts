import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// PHONE NUMBER UTILITIES
// ============================================================================

/**
 * Normalize phone number to E.164 format
 * Examples: "(415) 555-1234" -> "+14155551234"
 *           "415-555-1234" -> "+14155551234"
 *           "+1 415 555 1234" -> "+14155551234"
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  let normalized = phone.replace(/[^\d+]/g, "");

  // If no + prefix, assume US number
  if (!normalized.startsWith("+")) {
    // Remove leading 1 if present (US country code)
    if (normalized.startsWith("1") && normalized.length === 11) {
      normalized = normalized.substring(1);
    }
    // Add +1 for US
    normalized = "+1" + normalized;
  }

  return normalized;
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================================================
// USER QUERIES
// ============================================================================

/**
 * Get user by their phone number (for Caller ID lookup)
 */
export const getUserByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const normalizedPhone = normalizePhone(args.phone);

    // Search for user with this phone in their verifiedPhones array
    const users = await ctx.db
      .query("users")
      .withIndex("by_phone")
      .collect();

    // Find user whose verifiedPhones includes this number
    const user = users.find((u) => u.verifiedPhones.includes(normalizedPhone));

    return user || null;
  },
});

/**
 * Internal version for use in actions/mutations
 */
export const getUserByPhoneInternal = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const normalizedPhone = normalizePhone(args.phone);

    const users = await ctx.db
      .query("users")
      .withIndex("by_phone")
      .collect();

    const user = users.find((u) => u.verifiedPhones.includes(normalizedPhone));

    return user || null;
  },
});

/**
 * Get user by email
 */
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
  },
});

/**
 * Get user by ID
 */
export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Get current user's profile (called from frontend with stored userId)
 */
export const getCurrentUser = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.userId) return null;
    return await ctx.db.get(args.userId);
  },
});

// ============================================================================
// USER MUTATIONS
// ============================================================================

/**
 * Create a new user (called after phone verification)
 */
export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedPhone = normalizePhone(args.phone);
    const normalizedEmail = args.email.toLowerCase();

    // Check if email already exists
    const existingEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existingEmail) {
      throw new Error("An account with this email already exists");
    }

    // Check if phone already exists
    const users = await ctx.db.query("users").collect();
    const existingPhone = users.find((u) =>
      u.verifiedPhones.includes(normalizedPhone)
    );

    if (existingPhone) {
      throw new Error("This phone number is already registered");
    }

    // Create user
    const userId = await ctx.db.insert("users", {
      email: normalizedEmail,
      name: args.name,
      verifiedPhones: [normalizedPhone],
      primaryPhone: normalizedPhone,
      status: "active",
      createdAt: Date.now(),
      tier: "free",
    });

    return { userId, phone: normalizedPhone };
  },
});

/**
 * Add a phone number to existing user
 */
export const addPhoneToUser = mutation({
  args: {
    userId: v.id("users"),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedPhone = normalizePhone(args.phone);

    // Check if phone already exists on any user
    const users = await ctx.db.query("users").collect();
    const existingPhone = users.find((u) =>
      u.verifiedPhones.includes(normalizedPhone)
    );

    if (existingPhone) {
      throw new Error("This phone number is already registered");
    }

    // Get current user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Add phone to user's verified phones
    await ctx.db.patch(args.userId, {
      verifiedPhones: [...user.verifiedPhones, normalizedPhone],
    });

    return { success: true, phone: normalizedPhone };
  },
});

/**
 * Remove a phone number from user
 */
export const removePhoneFromUser = mutation({
  args: {
    userId: v.id("users"),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedPhone = normalizePhone(args.phone);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Must keep at least one phone
    if (user.verifiedPhones.length <= 1) {
      throw new Error("Cannot remove last phone number");
    }

    const newPhones = user.verifiedPhones.filter((p) => p !== normalizedPhone);

    // If removing primary phone, set a new one
    let newPrimary = user.primaryPhone;
    if (user.primaryPhone === normalizedPhone) {
      newPrimary = newPhones[0];
    }

    await ctx.db.patch(args.userId, {
      verifiedPhones: newPhones,
      primaryPhone: newPrimary,
    });

    return { success: true };
  },
});

/**
 * Update user's last login timestamp
 */
export const updateLastLogin = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastLoginAt: Date.now(),
    });
  },
});

// ============================================================================
// PHONE VERIFICATION
// ============================================================================

/**
 * Start phone verification - create code and prepare for SMS
 * Returns the code (to be sent via Twilio)
 */
export const startPhoneVerification = mutation({
  args: {
    phone: v.string(),
    userId: v.optional(v.id("users")), // If adding to existing user
    email: v.optional(v.string()), // If new signup
    name: v.optional(v.string()), // If new signup
  },
  handler: async (ctx, args) => {
    const normalizedPhone = normalizePhone(args.phone);
    const code = generateVerificationCode();

    // Delete any existing verification for this phone
    const existing = await ctx.db
      .query("phoneVerifications")
      .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
      .collect();

    for (const v of existing) {
      await ctx.db.delete(v._id);
    }

    // Create new verification record
    const verificationId = await ctx.db.insert("phoneVerifications", {
      phone: normalizedPhone,
      code,
      userId: args.userId,
      email: args.email?.toLowerCase(),
      name: args.name,
      attempts: 0,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      createdAt: Date.now(),
    });

    return {
      verificationId,
      phone: normalizedPhone,
      code, // In production, don't return this - send via SMS
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
  },
});

/**
 * Verify phone code and create/update user
 */
export const verifyPhoneCode = mutation({
  args: {
    phone: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedPhone = normalizePhone(args.phone);

    // Find verification record
    const verification = await ctx.db
      .query("phoneVerifications")
      .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
      .first();

    if (!verification) {
      throw new Error("No verification pending for this phone number");
    }

    // Check expiration
    if (Date.now() > verification.expiresAt) {
      await ctx.db.delete(verification._id);
      throw new Error("Verification code has expired. Please request a new one.");
    }

    // Check attempts
    if (verification.attempts >= 3) {
      await ctx.db.delete(verification._id);
      throw new Error("Too many failed attempts. Please request a new code.");
    }

    // Check code
    if (verification.code !== args.code) {
      await ctx.db.patch(verification._id, {
        attempts: verification.attempts + 1,
      });
      throw new Error("Invalid verification code");
    }

    // Code is valid! Handle user creation or update
    let userId: Id<"users">;

    if (verification.userId) {
      // Adding phone to existing user
      const user = await ctx.db.get(verification.userId);
      if (!user) {
        throw new Error("User not found");
      }

      await ctx.db.patch(verification.userId, {
        verifiedPhones: [...user.verifiedPhones, normalizedPhone],
      });
      userId = verification.userId;
    } else if (verification.email && verification.name) {
      // Creating new user
      userId = await ctx.db.insert("users", {
        email: verification.email,
        name: verification.name,
        verifiedPhones: [normalizedPhone],
        primaryPhone: normalizedPhone,
        status: "active",
        createdAt: Date.now(),
        tier: "free",
      });
    } else {
      throw new Error("Invalid verification state");
    }

    // Delete verification record
    await ctx.db.delete(verification._id);

    // Get updated user
    const user = await ctx.db.get(userId);

    return {
      success: true,
      userId,
      user,
    };
  },
});

/**
 * Clean up expired verifications (run periodically)
 */
export const cleanupExpiredVerifications = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("phoneVerifications")
      .withIndex("by_expires")
      .filter((q) => q.lt(q.field("expiresAt"), Date.now()))
      .collect();

    for (const v of expired) {
      await ctx.db.delete(v._id);
    }

    return { deleted: expired.length };
  },
});

// ============================================================================
// USER STATS (for dashboard)
// ============================================================================

/**
 * Get user's conversation stats
 */
export const getUserStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const todayCalls = conversations.filter((c) => c.startTime >= todayMs);

    const totalRecordsAccessed = conversations.reduce(
      (sum, c) => sum + c.salesforceRecordsAccessed.length,
      0
    );
    const totalRecordsModified = conversations.reduce(
      (sum, c) => sum + c.salesforceRecordsModified.length,
      0
    );

    return {
      totalCalls: conversations.length,
      todayCalls: todayCalls.length,
      totalRecordsAccessed,
      totalRecordsModified,
    };
  },
});
