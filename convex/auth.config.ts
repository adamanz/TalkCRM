// WorkOS AuthKit configuration for Convex
// This configures JWT validation for WorkOS tokens

export default {
  providers: [
    {
      // For SSO tokens
      type: "customJwt" as const,
      issuer: "https://api.workos.com/",
      algorithm: "RS256" as const,
      applicationID: "convex",
      jwks: "https://api.workos.com/sso/jwks/client_01JQS0H68GH4Q0CGBWVAEX0PRY",
    },
    {
      // For User Management tokens
      type: "customJwt" as const,
      issuer: "https://api.workos.com/user_management/client_01JQS0H68GH4Q0CGBWVAEX0PRY",
      algorithm: "RS256" as const,
      jwks: "https://api.workos.com/sso/jwks/client_01JQS0H68GH4Q0CGBWVAEX0PRY",
    },
  ],
};
