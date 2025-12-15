# TalkCRM Post-Deployment Setup Guide

This guide walks you through setting up TalkCRM after deploying the Salesforce package.

**Time Required:** 10-15 minutes

---

## Step 1: Create the Connected App

The Connected App enables secure OAuth authentication between Salesforce and TalkCRM.

### 1.1 Navigate to App Manager
1. Click the **gear icon** → **Setup**
2. In Quick Find, search for **"App Manager"**
3. Click **New Connected App** (top right)

### 1.2 Fill in Basic Information
| Field | Value |
|-------|-------|
| Connected App Name | `TalkCRM` |
| API Name | `TalkCRM` |
| Contact Email | Your email address |

### 1.3 Configure OAuth Settings
1. Check **Enable OAuth Settings**
2. Enter Callback URL:
   ```
   https://gregarious-crocodile-506.convex.site/auth/salesforce/callback
   ```
3. Select OAuth Scopes (move to "Selected"):
   - `Access and manage your data (api)`
   - `Perform requests at any time (refresh_token, offline_access)`

4. Leave other settings as default
5. Click **Save**

### 1.4 Wait for Activation
⏳ **Important:** Salesforce needs 2-10 minutes to activate the Connected App. You'll see a warning message - this is normal.

### 1.5 Get Consumer Credentials
1. After waiting, click **Manage Consumer Details**
2. You may need to verify via email/authenticator
3. Copy and save:
   - **Consumer Key** (starts with `3MVG6...`)
   - **Consumer Secret**

---

## Step 2: Configure TalkCRM Backend

Set the OAuth credentials in your Convex deployment.

### Option A: Using CLI
```bash
# Navigate to your TalkCRM project
cd /path/to/TalkCRM

# Set the credentials
npx convex env set SALESFORCE_CLIENT_ID "your_consumer_key_here"
npx convex env set SALESFORCE_CLIENT_SECRET "your_consumer_secret_here"
```

### Option B: Using Convex Dashboard
1. Go to [dashboard.convex.dev](https://dashboard.convex.dev)
2. Select your TalkCRM project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - `SALESFORCE_CLIENT_ID` = your consumer key
   - `SALESFORCE_CLIENT_SECRET` = your consumer secret

---

## Step 3: Assign Permission Set

Users need the TalkCRM permission set to access the app.

### 3.1 Open Permission Sets
1. **Setup** → Quick Find → **"Permission Sets"**
2. Click **TalkCRM User**

### 3.2 Assign Users
1. Click **Manage Assignments**
2. Click **Add Assignment**
3. Select the users who should have access
4. Click **Assign** → **Done**

---

## Step 4: Verify Remote Site Settings

Ensure the API endpoint is whitelisted.

1. **Setup** → Quick Find → **"Remote Site Settings"**
2. Verify **TalkCRM_Convex** exists with:
   - URL: `https://gregarious-crocodile-506.convex.site`
   - Active: ✓

If missing, click **New Remote Site** and add it.

---

## Step 5: Verify CSP Trusted Sites

Ensure browser security policies allow TalkCRM.

1. **Setup** → Quick Find → **"CSP Trusted Sites"** (under Security)
2. Verify **TalkCRM_Convex** exists with:
   - URL: `https://gregarious-crocodile-506.convex.site`
   - Active: ✓
   - Context: All

If missing, click **New Trusted Site** and add it.

---

## Step 6: Launch TalkCRM

### 6.1 Open the App
1. Click the **App Launcher** (9-dot grid icon, top left)
2. Search for **"TalkCRM"**
3. Click **TalkCRM** to open

### 6.2 Complete Setup Wizard
The TalkCRM Setup tab will guide you through:

1. **Connect Salesforce** - Click the button to authorize TalkCRM
2. **Verify Phone** - Enter your phone number and verification code
3. **Ready!** - You'll see the TalkCRM phone number to call

---

## Step 7: Make Your First Call

1. Save the TalkCRM number: **+1 (646) 600-5041**
2. Call from your registered phone number
3. Try saying:
   - "What's in my pipeline?"
   - "Find the Acme account"
   - "Create a task to follow up tomorrow"

---

## Verification Checklist

Before going live, verify:

- [ ] Connected App created and activated (wait 10 min)
- [ ] Consumer Key/Secret set in Convex environment
- [ ] Permission Set assigned to users
- [ ] Remote Site Setting active
- [ ] CSP Trusted Site active
- [ ] At least one user completed the setup wizard
- [ ] Test call successful

---

## Troubleshooting

### "Unable to find authorization code" or OAuth fails
- **Cause:** Connected App not yet active
- **Fix:** Wait 10 minutes after creation, then try again

### "No 'Access-Control-Allow-Origin' header"
- **Cause:** CSP Trusted Site or Remote Site not configured
- **Fix:** Verify both are active in Setup

### Phone verification code not received
- **Cause:** Twilio not configured or credentials invalid
- **Fix:** Check Convex env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- **Dev Mode:** Code shows in yellow box on screen

### "TalkCRM" not appearing in App Launcher
- **Cause:** Permission Set not assigned
- **Fix:** Assign TalkCRM User permission set to your user

### Call not recognized / "Unknown caller"
- **Cause:** Phone number not verified
- **Fix:** Complete phone verification in TalkCRM Setup wizard

---

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `SALESFORCE_CLIENT_ID` | OAuth Consumer Key | ✅ |
| `SALESFORCE_CLIENT_SECRET` | OAuth Consumer Secret | ✅ |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | ✅ |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | ✅ |
| `TWILIO_PHONE_NUMBER` | Twilio Phone (E.164) | ✅ |
| `ELEVENLABS_API_KEY` | ElevenLabs API Key | ✅ |
| `ELEVENLABS_AGENT_ID` | ElevenLabs Agent ID | ✅ |

---

## Support

- **Documentation:** https://talkcrm.com/docs
- **Email:** support@talkcrm.com
- **Issues:** https://github.com/your-repo/issues

---

## Next Steps

After setup is complete:

1. **Add more users** - Assign permission set and have them complete setup
2. **Review analytics** - Check the TalkCRM web dashboard for usage stats
3. **Customize prompts** - Modify the ElevenLabs agent for your use case
4. **Enable recordings** - Configure Twilio to store call recordings
