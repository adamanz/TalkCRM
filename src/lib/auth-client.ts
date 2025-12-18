import { useAuthActions } from "@convex-dev/auth/react";

// Google sign-in helper hook
export const useSignInWithGoogle = () => {
  const { signIn } = useAuthActions();

  return async () => {
    await signIn("google", { redirectTo: window.location.origin });
  };
};

// Sign out helper hook
export const useHandleSignOut = () => {
  const { signOut } = useAuthActions();

  return async () => {
    await signOut();
    // Clear any legacy local storage items
    localStorage.removeItem("talkcrm_userId");
    localStorage.removeItem("talkcrm_onboarding_complete");
    window.location.href = "/";
  };
};
