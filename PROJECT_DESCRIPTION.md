# TalkCRM

## The Problem

Sales reps spend **70% of their time NOT selling**. They're stuck updating Salesforce, searching for account info, logging calls, and managing tasks. This "CRM tax" costs companies millions in lost productivity and leads to poor data quality - because when updating CRM is a chore, reps don't do it.

The worst part? Sales is a **mobile profession**. Reps are driving between meetings, walking through airports, grabbing coffee with prospects. But CRM is trapped on a laptop. Every update waits until they're back at their desk - if they remember at all.

## The Solution

**TalkCRM is a voice-first AI assistant that lets sales reps interact with Salesforce completely hands-free.**

Just talk naturally:
- *"What's in my pipeline?"*
- *"Find the Acme account"*
- *"Update the NovaSpark deal to Closed Won"*
- *"Create a task to follow up with Elena tomorrow"*
- *"Log this call"*

No clicking. No typing. No laptop required. Your CRM, always one sentence away.

## How It Works

TalkCRM combines three powerful technologies:

1. **ElevenLabs Conversational AI** - Ultra-low-latency voice interface with natural turn-taking. Users speak naturally and hear responses instantly, creating a true conversational experience.

2. **Claude AI (Anthropic)** - Intelligent natural language understanding. A single AI assistant interprets user intent, plans the right Salesforce operations, and generates natural responses. No rigid commands - just conversation.

3. **Salesforce REST API** - Direct integration with your CRM. Search records, view pipeline, create tasks, update opportunities, log activities - all the core workflows sales reps need.

### Architecture

```
User (Voice) → ElevenLabs → Claude AI Assistant → Salesforce API
                   ↓
           Natural Voice Response ← Formatted Results
```

The magic is in the **unified AI assistant pattern**: instead of mapping voice commands to specific API endpoints, we send the user's natural language request to Claude, which figures out what Salesforce operations to perform. This means:

- No rigid command syntax to learn
- Handles ambiguity gracefully ("Update Acme" → "Which Acme account?")
- Confirms destructive actions before executing
- Provides contextual, conversational responses

## Key Features

- **Pipeline Overview** - Get your total pipeline value and key deals at a glance
- **Smart Search** - Find accounts, contacts, opportunities, or leads by name
- **Record Details** - Deep dive into any record with full context
- **Update Records** - Change deal stages, amounts, close dates with confirmation
- **Create Tasks** - Capture follow-ups while they're fresh
- **Log Activities** - Record calls and meetings to maintain history

## Tech Stack

| Component | Technology |
|-----------|------------|
| Voice Interface | ElevenLabs Conversational AI |
| AI Brain | Claude 3.5 Sonnet (Anthropic) |
| Backend | Convex (serverless functions + real-time database) |
| Frontend | React + TypeScript + Vite |
| CRM | Salesforce (REST API) |

---

## Deep Dive: Convex as the Backend Brain

Convex is the backbone of TalkCRM, handling everything from webhook endpoints to real-time data sync. Here's how we leveraged its capabilities:

### 1. HTTP Endpoints for Voice Integration

Convex's `httpRouter` powers all the webhook endpoints that ElevenLabs calls during conversations:

```typescript
// convex/http.ts
const http = httpRouter();

// Primary AI assistant endpoint - receives natural language from ElevenLabs
http.route({
  path: "/tools/assistant",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { message } = await request.json();
    // Call Claude AI action to interpret and execute
    const result = await ctx.runAction(api.ai.askSalesforce, { userMessage: message });
    return new Response(JSON.stringify(result));
  }),
});
```

This gives us **instant deployment** of serverless HTTP endpoints - no infrastructure to manage.

### 2. Actions for External API Orchestration

Convex **actions** handle all external API calls - both to Anthropic (Claude) and Salesforce:

```typescript
// convex/ai.ts - Claude interprets user intent
export const askSalesforce = action({
  args: { userMessage: v.string() },
  handler: async (ctx, args) => {
    // Call Claude API to understand intent
    const interpretation = await interpretWithClaude(apiKey, args.userMessage);

    // Execute the appropriate Salesforce action
    switch (interpretation.action) {
      case "search":
        return ctx.runAction(api.salesforce.searchRecords, {...});
      case "update":
        return ctx.runAction(api.salesforce.updateRecord, {...});
    }
  },
});
```

```typescript
// convex/salesforce.ts - Salesforce API wrapper
export const searchRecords = action({
  args: { query: v.string(), objectType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx);
    const result = await salesforceRequest(auth, `/search/?q=${query}`);
    return { records: result.searchRecords };
  },
});
```

### 3. Real-Time Database for Conversation Tracking

Convex's schema-enforced database tracks every conversation and tool call:

```typescript
// convex/schema.ts
export default defineSchema({
  // Track voice conversations
  conversations: defineTable({
    conversationId: v.string(),
    callerPhone: v.optional(v.string()),
    startTime: v.number(),
    transcript: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("completed")),
  }).index("by_conversation_id", ["conversationId"]),

  // Audit trail of every tool call
  toolCalls: defineTable({
    conversationId: v.string(),
    toolName: v.string(),
    input: v.string(),
    output: v.string(),
    success: v.boolean(),
    durationMs: v.number(),
  }),

  // Real-time activity feed for dashboard
  agentActivities: defineTable({
    type: v.union(v.literal("thinking"), v.literal("searching"), v.literal("found")),
    message: v.string(),
    recordId: v.optional(v.string()),
  }),
});
```

The **real-time subscriptions** let our React frontend show live agent activity as calls happen.

### 4. Secure Environment Variables

Convex environment variables securely store all credentials:
- `ANTHROPIC_API_KEY` - Claude API access
- `SALESFORCE_ACCESS_TOKEN` - Salesforce authentication
- `SALESFORCE_INSTANCE_URL` - Org endpoint

No secrets in code, easy rotation via `npx convex env set`.

### 5. Internal Functions for Clean Architecture

We use Convex's `internal` functions to separate public APIs from implementation details:

```typescript
// Internal mutation - only callable from other Convex functions
export const logActivityInternal = internalMutation({
  args: { type: v.string(), message: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentActivities", {
      ...args,
      timestamp: Date.now(),
    });
  },
});
```

### Why Convex for This Project?

| Challenge | Convex Solution |
|-----------|-----------------|
| ElevenLabs needs HTTP endpoints | `httpRouter` with instant deployment |
| Claude + Salesforce are external APIs | Actions with full fetch/async support |
| Need real-time dashboard updates | Built-in subscriptions + React hooks |
| Secure credential management | Environment variables via CLI |
| Audit trail for compliance | Schema-enforced database with indexes |
| Zero DevOps requirement | Fully managed, auto-scaling infrastructure |

Convex let us focus on the **product** instead of the plumbing - no servers to configure, no databases to provision, no webhook infrastructure to maintain.

## What Makes This Different

**Voice-first, not voice-added.** We didn't bolt voice onto an existing CRM app. We designed from scratch for the 70% of a sales rep's day when they're not at a desk.

**AI-native architecture.** One intelligent assistant that understands context, not a decision tree of voice commands. Say it however you want - the AI figures it out.

**Real Salesforce integration.** Not a demo with mock data. Live connection to your actual CRM with your actual pipeline.

## Use Cases

- **Driving between meetings** - Check pipeline, prep for next call
- **Walking into a building** - Quick lookup on the contact you're meeting
- **Post-meeting capture** - Log the call and create follow-up tasks immediately
- **End of day** - Update deal stages without opening your laptop
- **Morning commute** - Review tasks and priorities for the day

## Impact

- **Time saved**: 5-10 minutes per CRM interaction → hours per week
- **Data quality**: Updates happen in the moment, not "later" (never)
- **Rep happiness**: Less admin, more selling
- **Pipeline visibility**: Managers get real-time accuracy

## Demo

Try these commands:
1. "What's in my pipeline?"
2. "Tell me about NovaSpark"
3. "What tasks do I have?"
4. "Update the NovaSpark deal to Closed Won"
5. "Create a task to send Elena a thank you email tomorrow"

---

*Built for the ElevenLabs AI Hackathon 2024*

*TalkCRM - Your CRM, always one sentence away.*
