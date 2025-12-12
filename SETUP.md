# TalkCRM Setup Guide

Voice-powered Salesforce CRM agent - let sales reps call in and interact with their CRM data.

## Architecture Overview

```
Phone Call → Twilio → ElevenLabs Conversational AI → Convex HTTP Actions → Salesforce REST API
```

## Prerequisites

- [Convex](https://convex.dev) account
- [ElevenLabs](https://elevenlabs.io) account (with Conversational AI access)
- [Twilio](https://twilio.com) account with a phone number
- [Salesforce](https://salesforce.com) org with a Connected App

## Step 1: Salesforce Connected App

1. Go to **Setup → App Manager → New Connected App**
2. Configure:
   - **Connected App Name**: TalkCRM
   - **API Name**: TalkCRM
   - **Contact Email**: your email
   - **Enable OAuth Settings**: ✓
   - **Callback URL**: `https://YOUR_CONVEX_URL/auth/salesforce/callback`
   - **Selected OAuth Scopes**:
     - `api` (Access and manage your data)
     - `refresh_token` (Perform requests at any time)
     - `chatter_api` (Access Chatter API)
3. Save and note the **Consumer Key** and **Consumer Secret**

## Step 2: Deploy Convex

```bash
# Install dependencies
npm install

# Login to Convex
npx convex login

# Deploy to Convex
npx convex dev
```

Note your Convex deployment URL (e.g., `https://your-deployment.convex.site`)

## Step 3: Set Convex Environment Variables

```bash
npx convex env set SALESFORCE_CLIENT_ID "your_client_id"
npx convex env set SALESFORCE_CLIENT_SECRET "your_client_secret"
npx convex env set SALESFORCE_REDIRECT_URI "https://your-deployment.convex.site/auth/salesforce/callback"
npx convex env set ELEVENLABS_API_KEY "your_elevenlabs_key"
npx convex env set ELEVENLABS_AGENT_ID "your_agent_id"  # Set after creating agent
```

## Step 4: Create ElevenLabs Agent

### Option A: Using ElevenLabs CLI (Recommended)

1. Install the CLI:
   ```bash
   npm install -g @elevenlabs/cli
   ```

2. Set your API key:
   ```bash
   export ELEVENLABS_API_KEY=your_api_key
   ```

3. Update `elevenlabs/agent.yaml` with your Convex URL:
   - Replace `{{CONVEX_URL}}` with your actual Convex site URL

4. Deploy the agent:
   ```bash
   cd elevenlabs
   elevenlabs agents push
   ```

5. Note the Agent ID and set it in Convex:
   ```bash
   npx convex env set ELEVENLABS_AGENT_ID "your_agent_id"
   ```

### Option B: Using ElevenLabs Dashboard

1. Go to [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)
2. Create a new agent
3. Configure the prompt from `elevenlabs/agent.yaml`
4. Add server tools manually (see tool definitions in the YAML)
5. Note the Agent ID

## Step 5: Configure Twilio

1. Get a phone number from [Twilio Console](https://console.twilio.com)

2. Configure the phone number's Voice webhook:
   - **When a call comes in**: Webhook
   - **URL**: `https://your-deployment.convex.site/webhooks/twilio/incoming`
   - **HTTP Method**: POST

3. Set Convex environment variables:
   ```bash
   npx convex env set TWILIO_ACCOUNT_SID "your_account_sid"
   npx convex env set TWILIO_AUTH_TOKEN "your_auth_token"
   npx convex env set TWILIO_PHONE_NUMBER "+15551234567"
   ```

## Step 6: Connect Salesforce

1. Start the frontend:
   ```bash
   npm run dev
   ```

2. Open `http://localhost:5173`

3. Click "Connect Salesforce" and authorize the app

## Step 7: Test It!

1. Call your Twilio phone number
2. Say "Show me my pipeline" or "What tasks do I have today?"
3. The AI will query Salesforce and respond

## Troubleshooting

### "Salesforce not connected" error
- Ensure you've completed the OAuth flow by clicking "Connect Salesforce"
- Check that `salesforceAuth` table has a record in Convex Dashboard

### Tools not working
- Verify Convex HTTP routes are deployed: check `/webhooks/*` endpoints
- Check Convex logs for errors: `npx convex logs`
- Ensure ElevenLabs agent has the correct webhook URLs

### Call connects but no response
- Verify `ELEVENLABS_AGENT_ID` is set correctly
- Check ElevenLabs dashboard for conversation logs
- Ensure Twilio webhook URL is correct

## Server Tool Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/tools/search` | Search Salesforce records (SOQL/SOSL) |
| `/tools/get-record` | Get single record by ID |
| `/tools/create-record` | Create new record |
| `/tools/update-record` | Update existing record |
| `/tools/log-call` | Log call activity |
| `/tools/my-tasks` | Get current user's tasks |
| `/tools/my-pipeline` | Get current user's opportunities |

## Webhook Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/webhooks/twilio/incoming` | Handle incoming Twilio calls |
| `/webhooks/elevenlabs/post-call` | Receive call completion data |
| `/auth/salesforce/callback` | OAuth callback for Salesforce |

## Voice Commands Examples

| Say This | What Happens |
|----------|--------------|
| "Show me my pipeline" | Lists your open opportunities with amounts |
| "Find the Acme account" | Searches for accounts named Acme |
| "What tasks do I have today?" | Lists your tasks due today |
| "Create a task to follow up with John tomorrow" | Creates a new task |
| "Update the Acme deal to Closed Won" | Updates opportunity stage |
| "Log this call on the Johnson contact" | Creates a call activity record |
