# WorkOS AuthKit Configuration

This document outlines how to configure WorkOS AuthKit email templates and hosted pages to include links to the TalkCRM homepage.

## Homepage URL

**App Homepage:** https://talkcrm.app/

## Email Templates Configuration

WorkOS AuthKit sends various email templates to users (e.g., magic link emails, password reset emails, etc.). To add links to the homepage in these emails:

1. Log in to the [WorkOS Dashboard](https://dashboard.workos.com/)
2. Navigate to **User Management** → **Email Templates**
3. For each email template (Magic Link, Password Reset, etc.):
   - Edit the template
   - Add a link to the homepage: `https://talkcrm.app/`
   - Recommended placement: Add a footer section with "Visit [TalkCRM](https://talkcrm.app/) to learn more" or similar

### Example Email Template Footer

```html
<p style="margin-top: 20px; font-size: 12px; color: #666;">
  Visit <a href="https://talkcrm.app/" style="color: #3b82f6;">TalkCRM</a> to learn more about our voice-powered Salesforce assistant.
</p>
```

## Hosted Pages Configuration

WorkOS AuthKit provides hosted authentication pages. To add links to the homepage:

1. Log in to the [WorkOS Dashboard](https://dashboard.workos.com/)
2. Navigate to **User Management** → **Branding** or **Hosted Pages**
3. Configure the following:
   - **Logo Link:** Set to `https://talkcrm.app/`
   - **Footer Links:** Add a link to "Home" pointing to `https://talkcrm.app/`
   - **Custom CSS/HTML:** Add a "Back to Home" link if needed

### Recommended Settings

- **Logo:** Make the logo clickable and link to `https://talkcrm.app/`
- **Footer:** Include "© TalkCRM - [Visit Homepage](https://talkcrm.app/)"
- **Error Pages:** Add a "Return to Homepage" link on error pages

## Current Implementation

The custom `LoginPage` component (`src/components/LoginPage.tsx`) already includes:
- Clickable logo linking to `https://talkcrm.app/`
- Footer with homepage link

## Verification

After updating WorkOS dashboard settings:
1. Test email templates by triggering a magic link or password reset
2. Verify hosted pages display the homepage link correctly
3. Ensure all links point to `https://talkcrm.app/`



