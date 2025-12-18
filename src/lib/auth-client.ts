import { createAuthClient } from "better-auth/react";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";

// Create the auth client for Better Auth + Convex
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [
    crossDomainClient(),
    convexClient(),
  ],
});

// Export typed hooks and utilities
export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
} = authClient;

// Google sign-in helper
export const signInWithGoogle = async () => {
  return await signIn.social({
    provider: "google",
    callbackURL: import.meta.env.VITE_SITE_URL || window.location.origin,
  });
};

// Sign out helper
export const handleSignOut = async () => {
  await signOut();
  // Clear any legacy local storage items
  localStorage.removeItem("talkcrm_userId");
  localStorage.removeItem("talkcrm_onboarding_complete");
  window.location.href = "/";
};
