# WorkOS AuthKit Redirects Configuration

## Current Configuration Status

Based on your WorkOS dashboard settings, here are the recommended updates:

## ✅ Already Correct

- **Redirect URI Default**: `https://talkcrm.app/callback` ✓
- **App homepage URL**: `https://talkcrm.app/` ✓

## 🔧 Recommended Updates

### 1. Sign-in Endpoint
**Current**: Not configured  
**Recommended**: `https://talkcrm.app/`

**Why**: This endpoint is used when sign-in is initiated from outside your app (e.g., from an email link). Since you have a custom landing page that handles authentication, point it to your homepage.

### 2. Sign-up URL
**Current**: `https://tantalizing-nation-93.authkit.app/sign-up`  
**Recommended**: `https://talkcrm.app/`

**Why**: Your app has a custom landing page (`LandingPage.tsx`) with sign-up functionality. Users should be directed to your branded landing page instead of the WorkOS hosted page.

### 3. Sign-out Redirect
**Current**: Not shown in your config  
**Recommended**: `https://talkcrm.app/`

**Why**: Your code already redirects to "/" after sign-out (see `src/lib/auth-client.ts`), so this should match your homepage.

### 4. User Invitation URL
**Current**: `https://tantalizing-nation-93.authkit.app/invite`  
**Recommended**: Keep WorkOS hosted OR set to `https://talkcrm.app/`

**Why**: 
- **Option A (Keep WorkOS)**: WorkOS hosted invitation pages are well-designed and handle the invitation flow automatically. This is recommended if you want minimal maintenance.
- **Option B (Custom)**: If you want a fully branded experience, you can create a custom invitation page at `https://talkcrm.app/invite` that accepts the invitation token and redirects to WorkOS.

### 5. Password Reset URL
**Current**: `https://tantalizing-nation-93.authkit.app/reset-password`  
**Recommended**: Keep WorkOS hosted OR set to `https://talkcrm.app/reset-password`

**Why**:
- **Option A (Keep WorkOS)**: WorkOS hosted password reset pages handle the flow securely. This is recommended for security and simplicity.
- **Option B (Custom)**: If you want a fully branded experience, you can create a custom password reset page that accepts the token and redirects to WorkOS.

## Summary of Changes

Update these in your WorkOS Dashboard:

1. **Sign-in endpoint**: `https://talkcrm.app/`
2. **Sign-up URL**: `https://talkcrm.app/`
3. **Sign-out redirect**: `https://talkcrm.app/`
4. **User invitation URL**: Keep as-is (WorkOS hosted) OR customize
5. **Password reset URL**: Keep as-is (WorkOS hosted) OR customize

## Admin Portal Redirects

The Admin Portal redirects (Logo URI, SSO success URI, etc.) can remain as "No redirect" unless you have specific requirements for those flows.

## Implementation Notes

- Your app already handles the callback at `/callback` correctly
- The landing page (`LandingPage.tsx`) handles both login and signup flows
- Sign-out already redirects to "/" in the code
- All redirects should use `https://talkcrm.app/` (not `http://` or without protocol)



