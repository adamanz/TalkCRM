import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      profile(googleProfile) {
        // Map Google profile to Convex user fields
        return {
          id: googleProfile.sub,
          email: googleProfile.email,
          name: googleProfile.name,
          image: googleProfile.picture,
        };
      },
    }),
  ],
});
