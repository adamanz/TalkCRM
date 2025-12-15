# TalkCRM Salesforce Package

Voice-first CRM assistant that lets you manage Salesforce by phone.

## Features

- **Voice Commands**: Update Salesforce records, create tasks, and query data using natural language
- **Secure OAuth**: Uses Salesforce OAuth 2.0 for secure authentication
- **Phone Verification**: Two-factor authentication via SMS

## Installation

### Prerequisites

1. Salesforce org (Developer, Sandbox, or Production)
2. System Administrator access
3. Salesforce CLI (sf) installed

### Step 1: Deploy the Package

```bash
# Navigate to package directory
cd salesforce-package

# Authenticate to your org
sf org login web -a MyOrg

# Deploy the package
sf project deploy start --target-org MyOrg
```

### Step 2: Create Connected App (Required for OAuth)

Since Connected Apps can't be deployed with credentials, create one manually:

1. Go to **Setup > App Manager > New Connected App**
2. Fill in:
   - **Connected App Name**: `TalkCRM`
   - **API Name**: `TalkCRM`
   - **Contact Email**: Your email
3. Enable OAuth Settings:
   - **Enable OAuth Settings**: ✓
   - **Callback URL**: `https://gregarious-crocodile-506.convex.site/auth/salesforce/callback`
   - **Selected OAuth Scopes**:
     - `Access and manage your data (api)`
     - `Perform requests at any time (refresh_token, offline_access)`
4. Click **Save** and wait 2-10 minutes for activation
5. Click **Manage Consumer Details** and copy the **Consumer Key** and **Consumer Secret**

### Step 3: Configure TalkCRM Backend

Set these environment variables in your Convex deployment:

```bash
npx convex env set SALESFORCE_CLIENT_ID "your_consumer_key"
npx convex env set SALESFORCE_CLIENT_SECRET "your_consumer_secret"
```

### Step 4: Assign Permission Set

1. Go to **Setup > Permission Sets**
2. Find **"TalkCRM User"**
3. Click **Manage Assignments > Add Assignment**
4. Select users who should access TalkCRM

### Step 5: Launch TalkCRM

1. Open the **App Launcher** (9-dot grid icon)
2. Search for **"TalkCRM"**
3. Follow the setup wizard to connect your account

## Package Contents

| Component | Type | Description |
|-----------|------|-------------|
| talkCrmSetup | LWC | Setup wizard component |
| TalkCrmController | Apex | API communication controller |
| TalkCrmControllerTest | Apex Test | Test coverage for controller |
| TalkCRM_User | Permission Set | User access permissions |
| TalkCRM_Setup | Tab | Custom tab for setup wizard |
| TalkCRM | App | Lightning App |
| TalkCRM_Convex | Remote Site | API endpoint whitelist |
| TalkCRM_Convex (CSP) | CSP Trusted Site | Browser security policy |

## Troubleshooting

### "Unable to find authorization code"
- Wait 10 minutes after creating the Connected App
- Verify the callback URL matches exactly

### "No 'Access-Control-Allow-Origin' header"
- Ensure the CSP Trusted Site and Remote Site are both deployed
- Try clearing browser cache

### Phone verification code not received
- Check Twilio credentials in Convex environment variables
- In dev mode, the code appears in the UI (yellow box)

## Support

- Documentation: https://talkcrm.com/docs
- Email: support@talkcrm.com

## Version History

- **1.0.0** - Initial release with OAuth flow and phone verification
