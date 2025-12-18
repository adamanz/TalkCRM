import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";
import { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

// Site URL for redirects
const siteUrl = process.env.SITE_URL || "http://localhost:5173";

// Create the Better Auth component client for Convex
export const authComponent = createClient<DataModel>(components.betterAuth);

// Create the Better Auth instance (used in HTTP handlers)
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),

    // Social providers - Google OAuth
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },

    // Email/Password auth disabled - only Google SSO
    emailAndPassword: {
      enabled: false,
    },

    // Better Auth plugins for Convex integration
    plugins: [
      convex({ authConfig }),
      crossDomain({ siteUrl }),
    ],
  });
};

// Helper query to get the current authenticated user
export const getAuthUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx);
  },
});
