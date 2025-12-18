import { useAuth } from "@workos-inc/authkit-react";

// WorkOS sign-in helper hook
export const useSignInWithGoogle = () => {
  const { signIn } = useAuth();

  return async () => {
    try {
      // WorkOS AuthKit handles the OAuth flow automatically
      // This will redirect to WorkOS hosted UI which supports Google
      await signIn();
    } catch (error: any) {
      console.error("WorkOS sign-in error:", error);
      throw error;
    }
  };
};

// Sign out helper hook
export const useHandleSignOut = () => {
  const { signOut } = useAuth();

  return async () => {
    await signOut();
    // Clear any legacy local storage items
    localStorage.removeItem("talkcrm_userId");
    localStorage.removeItem("talkcrm_onboarding_complete");
    window.location.href = "/";
  };
};
