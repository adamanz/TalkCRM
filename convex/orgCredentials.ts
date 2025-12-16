import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Get org credentials by instance URL
 */
export const getByInstance = internalQuery({
  args: { instanceUrl: v.string() },
  handler: async (ctx, args) => {
    // Try exact match first
    let creds = await ctx.db
      .query("orgCredentials")
      .withIndex("by_instance", (q) => q.eq("instanceUrl", args.instanceUrl))
      .first();

    if (creds) return creds;

    // Try with lightning.force.com -> my.salesforce.com conversion
    const altUrl = args.instanceUrl.replace(".lightning.force.com", ".my.salesforce.com");
    if (altUrl !== args.instanceUrl) {
      creds = await ctx.db
        .query("orgCredentials")
        .withIndex("by_instance", (q) => q.eq("instanceUrl", altUrl))
        .first();
    }

    return creds;
  },
});

/**
 * Create new org credentials
 */
export const create = internalMutation({
  args: {
    instanceUrl: v.string(),
    consumerKey: v.string(),
    consumerSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("orgCredentials", {
      instanceUrl: args.instanceUrl,
      consumerKey: args.consumerKey,
      consumerSecret: args.consumerSecret,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update existing org credentials
 */
export const update = internalMutation({
  args: {
    id: v.id("orgCredentials"),
    consumerKey: v.string(),
    consumerSecret: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      consumerKey: args.consumerKey,
      consumerSecret: args.consumerSecret,
      updatedAt: Date.now(),
    });
  },
});
