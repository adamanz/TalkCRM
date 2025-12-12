import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// ============================================================================
// AI-POWERED SALESFORCE ASSISTANT
// Uses Claude to interpret natural language and execute Salesforce operations
// ============================================================================

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Salesforce schema context - tells Claude what's available
const SALESFORCE_SCHEMA_CONTEXT = `
You are a Salesforce assistant helping a sales rep via voice. You have access to these Salesforce objects and their key fields:

STANDARD OBJECTS:
- Account: Id, Name, Type, Industry, AnnualRevenue, Phone, Website, BillingCity, BillingState, OwnerId
- Contact: Id, Name, FirstName, LastName, Email, Phone, AccountId, Title, OwnerId
- Lead: Id, Name, FirstName, LastName, Email, Phone, Company, Status, LeadSource, OwnerId
- Opportunity: Id, Name, Amount, StageName, CloseDate, Probability, AccountId, OwnerId, IsClosed, IsWon
- Task: Id, Subject, Status, Priority, ActivityDate, WhoId (Contact/Lead), WhatId (Account/Opp), OwnerId, Description
- Case: Id, CaseNumber, Subject, Status, Priority, AccountId, ContactId, OwnerId

OPPORTUNITY STAGES (in order):
- Prospecting
- Qualification
- Needs Analysis
- Value Proposition
- Id. Decision Makers
- Perception Analysis
- Proposal/Price Quote
- Negotiation/Review
- Closed Won
- Closed Lost

LEAD STATUSES:
- Open - Not Contacted
- Working - Contacted
- Closed - Converted
- Closed - Not Converted

TASK STATUSES:
- Not Started
- In Progress
- Completed
- Waiting on someone else
- Deferred

You can perform these operations:
1. SEARCH - Find records by name or keyword
2. QUERY - Run SOQL queries for specific data
3. CREATE - Create new records (Tasks, Leads, etc.)
4. UPDATE - Update existing records (stage, status, amount, etc.)
5. LOG_CALL - Log a call activity

IMPORTANT RULES:
- Keep responses SHORT and conversational (this is voice, not text)
- When searching, use SOSL for name searches
- For "my pipeline" or "my opportunities", filter by OwnerId
- For "my tasks", filter by OwnerId
- Always confirm what you did after an action
- If you need clarification, ask a simple question
- Use natural, friendly language
`;

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ToolCall {
  name: string;
  input: Record<string, any>;
}

interface ParsedIntent {
  action: "search" | "query" | "create" | "update" | "log_call" | "clarify";
  objectType?: string;
  recordId?: string;
  searchTerm?: string;
  soql?: string;
  fields?: Record<string, any>;
  clarificationQuestion?: string;
  response: string;
}

/**
 * Main AI-powered Salesforce assistant
 * Takes natural language input and performs the appropriate Salesforce operation
 */
export const askSalesforce = action({
  args: {
    userMessage: v.string(),
    conversationHistory: v.optional(v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    }))),
  },
  handler: async (ctx, args): Promise<{ response: string; data?: any; action?: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        response: "I'm having trouble connecting to my AI brain. Please check the configuration.",
      };
    }

    // Build conversation history
    const messages: ClaudeMessage[] = args.conversationHistory || [];
    messages.push({ role: "user", content: args.userMessage });

    // Call Claude to interpret the request
    const interpretation = await interpretWithClaude(apiKey, messages);

    // Execute the interpreted action
    try {
      switch (interpretation.action) {
        case "search":
          const searchResults = await ctx.runAction(api.salesforce.searchRecords, {
            query: interpretation.searchTerm || args.userMessage,
            objectType: interpretation.objectType,
            limit: 5,
          });
          return {
            response: formatSearchResponse(searchResults, interpretation.objectType),
            data: searchResults,
            action: "search",
          };

        case "query":
          // Handle special "my" queries FIRST - these need user context
          const msgLower = args.userMessage.toLowerCase();
          if (interpretation.objectType === "Opportunity" || msgLower.includes("pipeline") || msgLower.includes("my opportunit") || msgLower.includes("my deals")) {
            const oppResults = await ctx.runAction(api.salesforce.getMyOpportunities, {
              stage: "open",
            });
            return {
              response: oppResults.summary + ". " + formatOpportunities(oppResults.opportunities),
              data: oppResults,
              action: "query",
            };
          }
          if (interpretation.objectType === "Task" || msgLower.includes("my task") || msgLower.includes("my to-do") || msgLower.includes("my todo")) {
            const taskResults = await ctx.runAction(api.salesforce.getMyTasks, {
              status: "open",
            });
            return {
              response: formatTasks(taskResults.tasks),
              data: taskResults,
              action: "query",
            };
          }
          // For other SOQL queries (not user-specific)
          if (interpretation.soql && !interpretation.soql.includes("CURRENT_USER")) {
            const queryResults = await ctx.runAction(api.salesforce.searchRecords, {
              query: interpretation.soql,
            });
            return {
              response: formatQueryResponse(queryResults, interpretation.objectType),
              data: queryResults,
              action: "query",
            };
          }
          break;

        case "create":
          if (interpretation.objectType && interpretation.fields) {
            const createResult = await ctx.runAction(api.salesforce.createRecord, {
              objectType: interpretation.objectType,
              fields: interpretation.fields,
            });
            return {
              response: interpretation.response || `Done! I created a new ${interpretation.objectType}.`,
              data: createResult,
              action: "create",
            };
          }
          break;

        case "update":
          if (interpretation.recordId && interpretation.objectType && interpretation.fields) {
            const updateResult = await ctx.runAction(api.salesforce.updateRecord, {
              recordId: interpretation.recordId,
              objectType: interpretation.objectType,
              fields: interpretation.fields,
            });
            return {
              response: interpretation.response || `Got it! I updated that ${interpretation.objectType}.`,
              data: updateResult,
              action: "update",
            };
          }
          // If we need to find the record first
          if (interpretation.searchTerm && interpretation.objectType && interpretation.fields) {
            const findResult = await ctx.runAction(api.salesforce.searchRecords, {
              query: interpretation.searchTerm,
              objectType: interpretation.objectType,
              limit: 1,
            });
            if (findResult.records && findResult.records.length > 0) {
              const recordId = findResult.records[0].Id;
              const updateResult = await ctx.runAction(api.salesforce.updateRecord, {
                recordId,
                objectType: interpretation.objectType,
                fields: interpretation.fields,
              });
              return {
                response: interpretation.response || `Done! I updated ${findResult.records[0].Name}.`,
                data: updateResult,
                action: "update",
              };
            } else {
              return {
                response: `I couldn't find a ${interpretation.objectType} matching "${interpretation.searchTerm}". Can you give me more details?`,
              };
            }
          }
          break;

        case "log_call":
          const logResult = await ctx.runAction(api.salesforce.logCall, {
            subject: interpretation.fields?.Subject || "Voice Call via TalkCRM",
            description: interpretation.fields?.Description || args.userMessage,
            whoId: interpretation.fields?.WhoId,
            whatId: interpretation.fields?.WhatId,
          });
          return {
            response: interpretation.response || "I've logged this call in Salesforce.",
            data: logResult,
            action: "log_call",
          };

        case "clarify":
          return {
            response: interpretation.clarificationQuestion || interpretation.response,
          };
      }

      // Default response if no action matched
      return {
        response: interpretation.response || "I'm not sure how to help with that. Can you rephrase?",
      };

    } catch (error: any) {
      console.error("Salesforce action error:", error);
      return {
        response: `I ran into an issue: ${error.message}. Would you like me to try again?`,
      };
    }
  },
});

/**
 * Use Claude to interpret the user's natural language request
 */
async function interpretWithClaude(apiKey: string, messages: ClaudeMessage[]): Promise<ParsedIntent> {
  const systemPrompt = `${SALESFORCE_SCHEMA_CONTEXT}

Based on the user's message, determine what Salesforce action to take. Respond with a JSON object:

{
  "action": "search" | "query" | "create" | "update" | "log_call" | "clarify",
  "objectType": "Account" | "Contact" | "Lead" | "Opportunity" | "Task" | "Case" (if applicable),
  "recordId": "18-char Salesforce ID" (if updating a specific record),
  "searchTerm": "what to search for" (if searching),
  "soql": "SELECT ... FROM ..." (if running a specific query),
  "fields": { "FieldName": "value" } (if creating/updating),
  "clarificationQuestion": "question to ask user" (if action is clarify),
  "response": "what to say to the user (keep it SHORT for voice)"
}

Examples:
- "Show me my pipeline" → { "action": "query", "objectType": "Opportunity", "response": "Let me get your opportunities..." }
- "Find Acme" → { "action": "search", "searchTerm": "Acme", "objectType": "Account", "response": "Searching for Acme..." }
- "Update Acme deal to Negotiation" → { "action": "update", "objectType": "Opportunity", "searchTerm": "Acme", "fields": { "StageName": "Negotiation/Review" }, "response": "I'll update the Acme opportunity to Negotiation." }
- "Create a task to call John tomorrow" → { "action": "create", "objectType": "Task", "fields": { "Subject": "Call John", "ActivityDate": "TOMORROW", "Status": "Not Started" }, "response": "Creating a task to call John tomorrow." }
- "Log this call" → { "action": "log_call", "fields": { "Subject": "Voice call via TalkCRM" }, "response": "I'll log this call for you." }

ONLY respond with the JSON object, no other text.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5-20251101",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Claude API error:", error);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || "{}";

  try {
    // Extract JSON from the response (handle potential markdown code blocks)
    let jsonStr = content;
    if (content.includes("```")) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) jsonStr = match[1];
    }
    return JSON.parse(jsonStr.trim());
  } catch (e) {
    console.error("Failed to parse Claude response:", content);
    return {
      action: "clarify",
      response: "I didn't quite catch that. Could you say it another way?",
    };
  }
}

// ============================================================================
// RESPONSE FORMATTERS (Keep responses short for voice!)
// ============================================================================

function formatSearchResponse(results: { records: any[]; totalSize: number }, objectType?: string): string {
  if (!results.records || results.records.length === 0) {
    return `I didn't find any ${objectType || "records"} matching that.`;
  }

  if (results.records.length === 1) {
    const r = results.records[0];
    return `I found ${r.Name}. Would you like more details?`;
  }

  const names = results.records.slice(0, 3).map((r: any) => r.Name).join(", ");
  const moreText = results.totalSize > 3 ? ` and ${results.totalSize - 3} more` : "";
  return `I found ${results.totalSize} results: ${names}${moreText}. Which one?`;
}

function formatQueryResponse(results: { records: any[]; totalSize: number }, objectType?: string): string {
  if (!results.records || results.records.length === 0) {
    return `No ${objectType || "records"} found.`;
  }
  return `Found ${results.totalSize} ${objectType || "records"}.`;
}

function formatOpportunities(opps: any[]): string {
  if (!opps || opps.length === 0) {
    return "You don't have any open opportunities.";
  }

  if (opps.length <= 3) {
    return opps.map(o => `${o.name} at ${o.stage}, ${o.amount ? "$" + o.amount.toLocaleString() : "no amount"}`).join(". ");
  }

  const top3 = opps.slice(0, 3);
  return `Your top opportunities are: ${top3.map(o => o.name).join(", ")}. Plus ${opps.length - 3} more.`;
}

function formatTasks(tasks: any[]): string {
  if (!tasks || tasks.length === 0) {
    return "You don't have any open tasks. Nice work!";
  }

  if (tasks.length === 1) {
    return `You have one task: ${tasks[0].subject}, due ${tasks[0].dueDate || "no date"}.`;
  }

  const count = tasks.length;
  const urgent = tasks.filter((t: any) => t.priority === "High").length;
  const subjects = tasks.slice(0, 2).map((t: any) => t.subject).join(" and ");

  let response = `You have ${count} tasks`;
  if (urgent > 0) response += `, ${urgent} high priority`;
  response += `. Including ${subjects}.`;

  return response;
}

/**
 * Simpler endpoint for basic search (used by ElevenLabs tool)
 */
export const quickSearch = action({
  args: {
    query: v.string(),
    objectType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ response: string; records: any[]; count: number }> => {
    const results = await ctx.runAction(api.salesforce.searchRecords, {
      query: args.query,
      objectType: args.objectType,
      limit: 5,
    }) as { records: any[]; totalSize: number };

    return {
      response: formatSearchResponse(results, args.objectType),
      records: results.records,
      count: results.totalSize,
    };
  },
});
