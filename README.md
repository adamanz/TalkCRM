# TalkCRM

> Voice-powered Salesforce for sales reps. Call in, talk to your CRM, get back to selling.

Sales reps spend 5.5 hours per week on CRM data entry. TalkCRM lets them do it hands-free in 30 seconds from their car.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TALKCRM ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────┐                                      ┌──────────────┐
     │  Sales Rep   │                                      │  Dashboard   │
     │  (Phone)     │                                      │  (React)     │
     └──────┬───────┘                                      └──────┬───────┘
            │                                                     │
            │ Call                                                │ Real-time
            ▼                                                     │ Updates
     ┌──────────────┐                                             │
     │    Twilio    │                                             │
     │  (Phone #)   │                                             │
     └──────┬───────┘                                             │
            │                                                     │
            │ WebSocket                                           │
            ▼                                                     │
     ┌──────────────┐         Webhook Tools                       │
     │  ElevenLabs  │ ─────────────────────────────┐              │
     │  Conv. AI    │                              │              │
     │  Agent       │                              ▼              ▼
     └──────────────┘                        ┌─────────────────────────┐
                                             │        CONVEX           │
                                             │  ┌─────────────────┐    │
                                             │  │  HTTP Actions   │    │
                                             │  │  /tools/*       │    │
                                             │  └────────┬────────┘    │
                                             │           │             │
                                             │  ┌────────▼────────┐    │
                                             │  │   Mutations     │    │
                                             │  │   & Queries     │    │
                                             │  └────────┬────────┘    │
                                             └───────────┼─────────────┘
                                                         │
                                                         ▼
                                             ┌─────────────────────────┐
                                             │      Salesforce         │
                                             │      REST API           │
                                             │  ┌─────────────────┐    │
                                             │  │ SOQL/SOSL Query │    │
                                             │  │ Create Record   │    │
                                             │  │ Update Record   │    │
                                             │  └─────────────────┘    │
                                             └─────────────────────────┘
```

## Call Flow

```
1. Sales rep calls Twilio number
2. Twilio connects to ElevenLabs Conversational AI via WebSocket
3. Rep speaks: "Update the Acme deal to Closed Won"
4. ElevenLabs agent calls webhook tool → Convex HTTP endpoint
5. Convex queries/updates Salesforce via REST API
6. Response flows back → Agent speaks result to rep
7. Dashboard updates in real-time via Convex subscriptions
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Voice AI | ElevenLabs Conversational AI | Natural language voice agent |
| Backend | Convex | Real-time database, HTTP actions, subscriptions |
| CRM | Salesforce | Customer data storage |
| Phone | Twilio | Phone number and voice connectivity |
| Frontend | React + Vite | Dashboard UI |
| Styling | Tailwind CSS | UI components |

## Tools

The ElevenLabs agent has access to these Salesforce tools:

| Tool | Description |
|------|-------------|
| `search_salesforce` | Find accounts, contacts, opportunities, leads |
| `get_record` | Get full details of a specific record |
| `create_record` | Create new accounts, contacts, leads, tasks |
| `update_record` | Update record fields (stage, status, amount) |
| `log_call` | Log call activity to Salesforce |
| `get_my_tasks` | View open tasks and to-dos |
| `get_my_pipeline` | View opportunities and pipeline summary |

## Setup

### Prerequisites

- Node.js 18+
- Convex account
- ElevenLabs account with Conversational AI access
- Twilio account with phone number
- Salesforce org (Developer Edition works)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Convex

```bash
npx convex dev
```

Set environment variables in Convex dashboard:

```bash
npx convex env set SALESFORCE_ACCESS_TOKEN "your_token"
npx convex env set SALESFORCE_INSTANCE_URL "https://yourorg.my.salesforce.com"
npx convex env set ANTHROPIC_API_KEY "your_key"  # For AI assistant
```

### 3. Configure ElevenLabs

Push tools to ElevenLabs:

```bash
elevenlabs tools push
```

Push agent configuration:

```bash
elevenlabs agents push
```

### 4. Configure Twilio

Set your Twilio phone number webhook to point to ElevenLabs:
- Connect directly to ElevenLabs Conversational AI WebSocket
- Agent ID: `agent_0701kc80pzcvfnytxrbeaezmy4tg`

### 5. Run Dashboard

```bash
npm run dev
```

## Development

```bash
# Start Convex dev server (watches for changes)
npx convex dev

# Start React dashboard
npm run dev

# Push tool changes to ElevenLabs
elevenlabs tools push

# Push agent changes to ElevenLabs
elevenlabs agents push
```

## Project Structure

```
TalkCRM/
├── convex/
│   ├── http.ts           # HTTP endpoints for ElevenLabs tools
│   ├── salesforce.ts     # Salesforce API integration
│   ├── conversations.ts  # Conversation logging
│   └── ai.ts             # AI-powered assistant
├── tool_configs/         # ElevenLabs tool definitions
├── agent_configs/        # ElevenLabs agent configuration
├── src/                  # React dashboard
└── PLAN.md              # Implementation roadmap
```

## Demo Commands

Test these voice commands:

1. **"What's in my pipeline?"** → Shows opportunities and total value
2. **"Find the Acme account"** → Searches Salesforce
3. **"Update Acme deal to Closed Won"** → Updates opportunity stage
4. **"Create a task to call John tomorrow"** → Creates task
5. **"Log this call"** → Logs call activity

## License

MIT
