# TalkCRM Setup Guide

Voice-powered Salesforce CRM agent - let sales reps call in and interact with their CRM data.

## Architecture Overview

```
Phone Call → Twilio → ElevenLabs Conversational AI → Convex HTTP Actions → Salesforce REST API
```

## What's Been Created

### ElevenLabs Agent
- **Agent ID**: `agent_0701kc80pzcvfnytxrbeaezmy4tg`
- **Name**: TalkCRM
- Pre-configured prompt for Salesforce interactions

### ElevenLabs Tools (7 webhook tools)
| Tool | ID | Purpose |
|------|-----|---------|
| search_salesforce | tool_3001kc80s35dfdmt55k3qf4t4hce | Search records |
| get_record | tool_0501kc80swvgfm6s4f5n9asjnbkb | Get record details |
| create_record | tool_0101kc80sznde6z87xfdv7q8n003 | Create new records |
| update_record | tool_3401kc80t1pgfr9vmtb87d0k4se1 | Update records |
| log_call | tool_1601kc80t3zbfx0ah1834fzr6jfp | Log call activities |
| get_my_tasks | tool_9301kc80t6gye70vbq5fm5g0sahb | Get user's tasks |
| get_my_pipeline | tool_3301kc80t8cqe158ahxtvsx0yn6e | Get user's opportunities |

### Convex Backend
- Schema for conversations and tool call logging
- Salesforce API integration layer
- HTTP endpoints for all tools
- Twilio webhook handler
- OAuth callback handler

## Setup Steps

### Step 1: Deploy Convex

```bash
# Run the dev command to configure project interactively
npx convex dev

# When prompted:
# - Create a new project or select existing
# - Note your deployment URL (e.g., https://your-project.convex.site)
```

### Step 2: Update Tool URLs

Once you have your Convex site URL, update all tool configs:

```bash
# Replace placeholder URL with your actual Convex URL
CONVEX_URL="https://your-project.convex.site"

# Update all tool configs
for file in tool_configs/*.json; do
  sed -i '' "s|\${CONVEX_SITE_URL}|$CONVEX_URL|g" "$file"
done

# Push updated tools to ElevenLabs
elevenlabs tools push
```

Or manually edit each file in `tool_configs/` to replace `${CONVEX_SITE_URL}`.

### Step 3: Create Salesforce Connected App

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
3. Save and note **Consumer Key** and **Consumer Secret**

### Step 4: Set Convex Environment Variables

```bash
npx convex env set SALESFORCE_CLIENT_ID "your_consumer_key"
npx convex env set SALESFORCE_CLIENT_SECRET "your_consumer_secret"
npx convex env set SALESFORCE_REDIRECT_URI "https://your-convex-url.convex.site/auth/salesforce/callback"
npx convex env set ELEVENLABS_API_KEY "your_elevenlabs_api_key"
npx convex env set ELEVENLABS_AGENT_ID "agent_0701kc80pzcvfnytxrbeaezmy4tg"
```

### Step 5: Link Tools to Agent

In the ElevenLabs dashboard or via CLI, add the tools to the TalkCRM agent:

```bash
# Update agent config to include tool IDs
# Edit agent_configs/TalkCRM.json and add tool_ids to the prompt section
```

Or in ElevenLabs Dashboard:
1. Go to Conversational AI → Agents → TalkCRM
2. Add each tool to the agent

### Step 6: Configure Twilio

1. Get a phone number from [Twilio Console](https://console.twilio.com)
2. Configure the phone number's Voice webhook:
   - **When a call comes in**: Webhook
   - **URL**: `https://your-convex-url.convex.site/webhooks/twilio/incoming`
   - **HTTP Method**: POST

### Step 7: Connect Salesforce

1. Start the frontend: `npm run dev`
2. Open http://localhost:5173
3. Click "Connect Salesforce" and authorize

### Step 8: Test!

Call your Twilio phone number and try:
- "Show me my pipeline"
- "What tasks do I have today?"
- "Find the Acme account"

## Project Structure

```
TalkCRM/
├── convex/
│   ├── schema.ts           # Database schema
│   ├── salesforce.ts       # Salesforce API integration
│   ├── conversations.ts    # Conversation logging
│   └── http.ts            # HTTP endpoints for tools & webhooks
├── agent_configs/
│   └── TalkCRM.json       # ElevenLabs agent config
├── tool_configs/
│   ├── search_salesforce.json
│   ├── get_record.json
│   ├── create_record.json
│   ├── update_record.json
│   ├── log_call.json
│   ├── get_my_tasks.json
│   └── get_my_pipeline.json
├── agents.json            # ElevenLabs agents registry
├── tools.json             # ElevenLabs tools registry
└── src/
    └── App.tsx            # Dashboard frontend
```

## Endpoints

### Tool Endpoints (called by ElevenLabs)
| Endpoint | Tool |
|----------|------|
| POST /tools/search | search_salesforce |
| POST /tools/get-record | get_record |
| POST /tools/create-record | create_record |
| POST /tools/update-record | update_record |
| POST /tools/log-call | log_call |
| POST /tools/my-tasks | get_my_tasks |
| POST /tools/my-pipeline | get_my_pipeline |

### Webhook Endpoints
| Endpoint | Purpose |
|----------|---------|
| POST /webhooks/twilio/incoming | Twilio call handler |
| POST /webhooks/elevenlabs/post-call | Call completion data |
| GET /auth/salesforce/callback | OAuth callback |

## Voice Commands

| Say This | What Happens |
|----------|--------------|
| "Show me my pipeline" | Lists open opportunities with amounts |
| "Find the Acme account" | Searches for accounts named Acme |
| "What tasks do I have today?" | Lists tasks due today |
| "Create a task to follow up with John tomorrow" | Creates a new task |
| "Update the Acme deal to Closed Won" | Updates opportunity stage |
| "Log this call on the Johnson contact" | Creates call activity |

## Troubleshooting

### Tools not working
1. Check tool URLs are correct: `cat tool_configs/search_salesforce.json`
2. Verify tools are pushed: `elevenlabs tools push`
3. Check Convex logs: `npx convex logs`

### "Salesforce not connected"
1. Complete OAuth flow via dashboard
2. Check `salesforceAuth` table in Convex

### Agent not responding
1. Verify `ELEVENLABS_AGENT_ID` env var is set
2. Check agent status: `elevenlabs agents status`
