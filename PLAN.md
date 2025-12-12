# TalkCRM Implementation Plan

> Voice-powered Salesforce for sales reps - call in, talk to your CRM, get back to selling.

## Architecture Overview (LLM-Powered)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TALKCRM ARCHITECTURE (v2)                            │
│                         Claude-Powered Intelligence                          │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐         ┌─────────────────────┐         ┌──────────────┐
    │  Sales Rep  │────────▶│      Twilio         │────────▶│  ElevenLabs  │
    │  (Phone)    │         │  (Phone Number)     │         │  Agent       │
    │             │◀────────│                     │◀────────│  (Claude)    │
    └─────────────┘         └─────────────────────┘         └──────┬───────┘
                                                                   │
                            ONE Smart Tool: salesforce_assistant   │
                                                                   ▼
    ┌─────────────┐         ┌─────────────────────────────────────────────────┐
    │  Dashboard  │◀───────▶│                   CONVEX                        │
    │  (React)    │         │                                                 │
    │             │         │  ┌─────────────────────────────────────────┐   │
    │  - Anam     │         │  │  /tools/assistant  (HTTP Action)        │   │
    │    Avatar   │         │  │                                         │   │
    │  - Live     │         │  │  1. Receive natural language request    │   │
    │    Updates  │         │  │  2. Call Claude API with SF context     │   │
    │             │         │  │  3. Claude interprets → generates SOQL  │   │
    │             │         │  │  4. Execute against Salesforce          │   │
    │             │         │  │  5. Return voice-friendly response      │   │
    │             │         │  └─────────────────────────────────────────┘   │
    └─────────────┘         └──────────────────────┼──────────────────────────┘
                                                   │
                                                   ▼
                            ┌─────────────────────────────────────────────────┐
                            │                 Salesforce REST API             │
                            │   Query (SOQL) │ Search (SOSL) │ Create/Update  │
                            └─────────────────────────────────────────────────┘
```

## Key Design Decision: Claude in Convex

Instead of 7 separate tools, we use ONE intelligent tool powered by Claude:

| Old Approach | New Approach |
|--------------|--------------|
| 7 specific tools (search, create, update...) | 1 smart tool: `salesforce_assistant` |
| ElevenLabs decides which tool | Claude interprets the request |
| Limited to predefined operations | Natural language understanding |
| User must phrase things "correctly" | Flexible interpretation |

**How it works:**
1. User says: "Move the Acme deal to closed won"
2. ElevenLabs agent sends to `salesforce_assistant` tool
3. Convex receives natural language message
4. Convex calls Claude with Salesforce schema context
5. Claude interprets: `{ action: "update", searchTerm: "Acme", objectType: "Opportunity", fields: { StageName: "Closed Won" } }`
6. Convex executes: Search for Acme → Update record → Return confirmation
7. Response flows back through ElevenLabs as speech

## Sponsor Integration

| Sponsor | Component | Prize Track |
|---------|-----------|-------------|
| **ElevenLabs** | Conversational AI Agent + Voice | Main Track |
| **Convex** | Real-time backend, HTTP actions, subscriptions | Best Convex (NY) |
| **Anam** | Visual avatar on dashboard, lip-synced | Best Anam (NY) |
| **Twilio** | Phone number for inbound calls | (Supporting) |

---

## Phase 1: Core Infrastructure (DONE)

### 1.1 Convex Backend ✅
- [x] Schema defined (conversations, toolCalls, salesforceAuth)
- [x] HTTP endpoints for all 7 tools
- [x] Salesforce API integration module
- [x] Conversation logging

### 1.2 ElevenLabs Agent ✅
- [x] Agent created: `agent_0701kc80pzcvfnytxrbeaezmy4tg`
- [x] 7 webhook tools defined
- [x] Voice/persona configured

---

## Phase 2: Tool Wiring (IN PROGRESS)

### 2.1 Fix Tool Configurations

The tools need proper schemas and URLs pointing to Convex:

| Tool | Endpoint | Status |
|------|----------|--------|
| `search_salesforce` | `/tools/search` | ✅ Working |
| `get_record` | `/tools/get-record` | ⚠️ Needs schema |
| `create_record` | `/tools/create-record` | ⚠️ Needs schema |
| `update_record` | `/tools/update-record` | ⚠️ Needs schema |
| `log_call` | `/tools/log-call` | ✅ Working |
| `get_my_tasks` | `/tools/my-tasks` | ✅ Working |
| `get_my_pipeline` | `/tools/my-pipeline` | ✅ Working |

### 2.2 Tool Schema Fixes Required

**get_record.json:**
```json
{
  "request_body_schema": {
    "type": "object",
    "required": ["record_id", "object_type"],
    "properties": {
      "record_id": {
        "type": "string",
        "description": "Salesforce record ID (18-character)"
      },
      "object_type": {
        "type": "string",
        "description": "Object type: Account, Contact, Opportunity, Lead, Case"
      }
    }
  }
}
```

**create_record.json:**
```json
{
  "request_body_schema": {
    "type": "object",
    "required": ["object_type"],
    "properties": {
      "object_type": {
        "type": "string",
        "description": "Object to create: Account, Contact, Opportunity, Lead, Task, Case"
      },
      "name": {
        "type": "string",
        "description": "Name of the record"
      },
      "company": {
        "type": "string",
        "description": "Company name (for Leads)"
      },
      "email": {
        "type": "string",
        "description": "Email address"
      },
      "phone": {
        "type": "string",
        "description": "Phone number"
      },
      "description": {
        "type": "string",
        "description": "Description or notes"
      }
    }
  }
}
```

**update_record.json:**
```json
{
  "request_body_schema": {
    "type": "object",
    "required": ["record_id", "object_type"],
    "properties": {
      "record_id": {
        "type": "string",
        "description": "Salesforce record ID to update"
      },
      "object_type": {
        "type": "string",
        "description": "Object type: Account, Contact, Opportunity, Lead, Case"
      },
      "stage_name": {
        "type": "string",
        "description": "New stage (for Opportunities)"
      },
      "status": {
        "type": "string",
        "description": "New status (for Leads, Cases, Tasks)"
      },
      "amount": {
        "type": "number",
        "description": "Deal amount (for Opportunities)"
      }
    }
  }
}
```

### 2.3 Link Tools to Agent

After fixing schemas, push tools and link to agent:
```bash
elevenlabs tools push tool_configs/get_record.json
elevenlabs tools push tool_configs/create_record.json
elevenlabs tools push tool_configs/update_record.json
elevenlabs agents add-tool --agent-id agent_0701kc80pzcvfnytxrbeaezmy4tg --tool-id <tool_id>
```

---

## Phase 3: Salesforce Connection

### 3.1 Salesforce Connected App Setup

1. **Create Connected App in Salesforce:**
   - Setup → App Manager → New Connected App
   - Enable OAuth Settings
   - Callback URL: `https://gregarious-crocodile-506.convex.site/auth/salesforce/callback`
   - Scopes: `api`, `refresh_token`, `offline_access`

2. **Set Convex Environment Variables:**
   ```bash
   npx convex env set SALESFORCE_CLIENT_ID "your_consumer_key"
   npx convex env set SALESFORCE_CLIENT_SECRET "your_consumer_secret"
   npx convex env set SALESFORCE_REDIRECT_URI "https://gregarious-crocodile-506.convex.site/auth/salesforce/callback"
   ```

3. **For Demo (Quick Option):** Use a Salesforce access token directly:
   ```bash
   npx convex env set SALESFORCE_ACCESS_TOKEN "your_session_token"
   npx convex env set SALESFORCE_INSTANCE_URL "https://yourorg.my.salesforce.com"
   ```

### 3.2 Test Salesforce Connection

```bash
# Test search endpoint
curl -X POST https://gregarious-crocodile-506.convex.site/tools/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Acme", "object_type": "Account"}'
```

---

## Phase 4: Twilio Phone Integration

### 4.1 Twilio Setup

1. **Get a Twilio Phone Number**
   - Buy a number with Voice capability
   - Note the number for demo

2. **Configure Webhook**
   - Voice webhook URL: `https://gregarious-crocodile-506.convex.site/webhooks/twilio/incoming`
   - Method: POST

3. **Set ElevenLabs Agent ID in Convex:**
   ```bash
   npx convex env set ELEVENLABS_AGENT_ID "agent_0701kc80pzcvfnytxrbeaezmy4tg"
   ```

### 4.2 How the Call Flow Works

```
1. Rep calls Twilio number
2. Twilio POSTs to /webhooks/twilio/incoming
3. Convex returns TwiML connecting to ElevenLabs WebSocket
4. ElevenLabs agent speaks with rep
5. Agent calls webhook tools as needed
6. Convex processes tool calls, hits Salesforce
7. Results returned to agent → spoken to rep
```

---

## Phase 5: Dashboard + Anam Avatar

### 5.1 Dashboard Features

- **Conversation List:** Real-time via Convex subscriptions
- **Active Call Indicator:** Shows when call is in progress
- **Tool Call Stream:** Live feed of Salesforce operations
- **Salesforce Record Preview:** Show records being accessed

### 5.2 Anam Avatar Integration

1. **Sign up at anam.ai** and get API key

2. **Install Anam SDK:**
   ```bash
   npm install @anam-ai/anam-react
   ```

3. **Add Avatar Component:**
   ```tsx
   import { AnamAvatar } from '@anam-ai/anam-react';

   // In dashboard
   <AnamAvatar
     apiKey={ANAM_API_KEY}
     personaId="your-persona"
     onSpeechStart={() => {}}
     onSpeechEnd={() => {}}
   />
   ```

4. **Sync with ElevenLabs Audio:**
   - Stream ElevenLabs TTS output to Anam for lip-sync
   - Or use Anam's built-in TTS (simpler)

### 5.3 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  TalkCRM Dashboard                              [Call: Active] │
├─────────────────────┬───────────────────────────────────────┤
│                     │  Recent Conversations                 │
│   ┌───────────┐    │  ────────────────────────────────────  │
│   │           │    │  📞 Call with +1234... (2 min ago)     │
│   │   ANAM    │    │     → Searched "Acme"                  │
│   │  AVATAR   │    │     → Updated Opportunity stage        │
│   │           │    │                                        │
│   └───────────┘    │  📞 Call with +1234... (1 hour ago)    │
│                     │     → Created new Lead                 │
│   "How can I help  │     → Logged call activity             │
│    you today?"     │                                        │
│                     ├───────────────────────────────────────┤
│                     │  Live Tool Calls                       │
│                     │  ────────────────────────────────────  │
│                     │  🔍 search_salesforce: "Acme"          │
│                     │  ✅ Found 3 records                    │
│                     │                                        │
└─────────────────────┴───────────────────────────────────────┘
```

---

## Phase 6: Demo Polish

### 6.1 Sample Salesforce Data

Create test data in Salesforce:
- **Accounts:** Acme Corp, Globex Inc, Initech
- **Contacts:** John Smith (Acme), Jane Doe (Globex)
- **Opportunities:** Acme Deal ($50k, Negotiation), Globex Renewal ($25k, Proposal)
- **Tasks:** Follow up with John, Send proposal to Jane

### 6.2 Demo Script Commands

Test these voice commands:
1. "What's in my pipeline?" → get_my_pipeline
2. "Show me my tasks for today" → get_my_tasks
3. "Find the Acme account" → search_salesforce
4. "Update the Acme deal to Closed Won" → update_record
5. "Create a task to call John tomorrow" → create_record
6. "Log this call" → log_call

### 6.3 Error Handling

Add friendly error responses in agent prompt:
- "I couldn't find that record. Can you give me more details?"
- "I wasn't able to update that. Let me try again."
- "I'm having trouble connecting to Salesforce. One moment..."

---

## Implementation Checklist

### Must Have (Core Demo)
- [ ] Fix get_record, create_record, update_record tool schemas
- [ ] Push tools to ElevenLabs and link to agent
- [ ] Set Salesforce credentials in Convex
- [ ] Configure Twilio webhook
- [ ] Test end-to-end phone call flow
- [ ] Basic dashboard showing conversations

### Should Have (Winning Edge)
- [ ] Anam avatar on dashboard
- [ ] Real-time tool call visualization
- [ ] Conversation transcript streaming
- [ ] Salesforce record cards in dashboard

### Nice to Have (Bonus Points)
- [ ] AI call prep (briefing before meetings)
- [ ] Deal coach suggestions
- [ ] Voice-triggered shortcuts ("quick log")

---

## Environment Variables Summary

### Convex (.env.local)
```
CONVEX_DEPLOYMENT=dev:gregarious-crocodile-506
```

### Convex Dashboard (Environment Variables)
```
SALESFORCE_CLIENT_ID=<from connected app>
SALESFORCE_CLIENT_SECRET=<from connected app>
SALESFORCE_REDIRECT_URI=https://gregarious-crocodile-506.convex.site/auth/salesforce/callback
SALESFORCE_ACCESS_TOKEN=<optional: direct token for demo>
SALESFORCE_INSTANCE_URL=https://yourorg.my.salesforce.com
ELEVENLABS_AGENT_ID=agent_0701kc80pzcvfnytxrbeaezmy4tg
ANAM_API_KEY=<from anam.ai>
```

### ElevenLabs
- Agent ID: `agent_0701kc80pzcvfnytxrbeaezmy4tg`
- All tool webhook URLs point to: `https://gregarious-crocodile-506.convex.site/tools/*`

---

## Quick Start Commands

```bash
# 1. Start Convex dev server
cd /Users/adamanz/TalkCRM
npx convex dev

# 2. Start React dashboard
npm run dev

# 3. Fix and push tools
elevenlabs tools push tool_configs/get_record.json
elevenlabs tools push tool_configs/create_record.json
elevenlabs tools push tool_configs/update_record.json

# 4. Set Salesforce env vars
npx convex env set SALESFORCE_INSTANCE_URL "https://yourorg.my.salesforce.com"
npx convex env set SALESFORCE_ACCESS_TOKEN "your_token"

# 5. Test a tool endpoint
curl -X POST https://gregarious-crocodile-506.convex.site/tools/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Acme"}'

# 6. Call the Twilio number and test!
```

---

## Timeline Estimate

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 2 | Fix tool schemas, push to ElevenLabs | HIGH |
| Phase 3 | Salesforce connection | HIGH |
| Phase 4 | Twilio webhook | HIGH |
| Phase 5 | Dashboard + Anam | MEDIUM |
| Phase 6 | Demo polish | LOW |

**Critical Path:** Phase 2 → Phase 3 → Phase 4 → Test Call

Once you can make a phone call and successfully query Salesforce, everything else is polish.
