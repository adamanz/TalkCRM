import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// AI-POWERED SALESFORCE ASSISTANT
// Uses Claude to interpret natural language and execute Salesforce operations
// ============================================================================

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

CASE STATUSES:
- New
- Working
- Escalated
- Closed

CASE PRIORITIES:
- Low
- Medium
- High

CASE ORIGINS (how the case was reported):
- Phone
- Email
- Web

SOQL DATE LITERALS (use these directly in SOQL - Salesforce handles them):
- TODAY, YESTERDAY, TOMORROW
- THIS_WEEK, LAST_WEEK, NEXT_WEEK
- THIS_MONTH, LAST_MONTH, NEXT_MONTH
- THIS_QUARTER, LAST_QUARTER, NEXT_QUARTER
- THIS_YEAR, LAST_YEAR, NEXT_YEAR
- LAST_N_DAYS:n (e.g., LAST_N_DAYS:7 for last 7 days)
- NEXT_N_DAYS:n (e.g., NEXT_N_DAYS:30 for next 30 days)
- LAST_90_DAYS, NEXT_90_DAYS

Example SOQL with dates:
- SELECT Id, Name FROM Opportunity WHERE CloseDate = THIS_QUARTER AND OwnerId = CURRENT_USER
- SELECT Id, Subject FROM Task WHERE ActivityDate = TODAY AND OwnerId = CURRENT_USER
- SELECT Id, Name FROM Lead WHERE CreatedDate = LAST_N_DAYS:7 AND OwnerId = CURRENT_USER
- SELECT Id, Name FROM Account WHERE LastModifiedDate > LAST_WEEK

You can perform these operations:
1. SEARCH - Find records by name or keyword (use for "find X", "look up X")
2. QUERY - Run SOQL queries for ANY Salesforce data (use for "show me", "what are", "list my", etc.)
3. CREATE - Create new records (Tasks, Leads, Cases, etc.)
4. UPDATE - Update existing records (stage, status, amount, etc.)
5. LOG_CALL - Log a call activity

SOQL QUERY RULES (CRITICAL - READ CAREFULLY):
- You can query ANY standard Salesforce object with SOQL
- For user-specific queries ("my leads", "my accounts", etc.), ALWAYS use: OwnerId = CURRENT_USER
- CURRENT_USER is automatically replaced with the user's Salesforce ID - use it exactly as shown
- ALWAYS include useful fields in SELECT (Name, Status, Amount, etc. depending on object)
- Use SOQL date literals for time-based filters (TODAY, THIS_WEEK, LAST_N_DAYS:7, etc.)

MORE SOQL EXAMPLES:
- "my leads" → SELECT Id, Name, Company, Status, Email, Phone FROM Lead WHERE OwnerId = CURRENT_USER ORDER BY CreatedDate DESC LIMIT 25
- "accounts I own" → SELECT Id, Name, Industry, Phone FROM Account WHERE OwnerId = CURRENT_USER
- "contacts at Acme" → SELECT Id, Name, Email, Phone, Title FROM Contact WHERE Account.Name LIKE '%Acme%'

IMPORTANT RULES:
- Keep responses SHORT and conversational (this is voice/text, not email)
- For name searches, use action "search" with searchTerm
- For data queries, use action "query" with soql field containing full SOQL
- Always confirm what you did after an action
- Use natural, friendly language

CLARIFICATION RULES:
- If you're unsure whether the user wants a Case (support issue) vs Task (to-do item), ASK!
- Cases are for customer support issues, problems, questions reported by customers
- Tasks are for personal to-dos, follow-ups, reminders
- When the request is ambiguous, use action "clarify" to ask a simple question
`;

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
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
    userId: v.optional(v.id("users")), // For per-user Salesforce auth lookup
  },
  handler: async (ctx, args): Promise<{ response: string; data?: any; action?: string; recordUrl?: string }> => {
    // #region agent log (debug-session)
    fetch('http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A',location:'convex/ai.ts:askSalesforce:entry',message:'askSalesforce entry',data:{hasUserId:!!args.userId,userMessageLen:args.userMessage?.length ?? null,msgLowerHasMyLead:(args.userMessage||'').toLowerCase().includes('my lead'),msgLowerHasPipeline:(args.userMessage||'').toLowerCase().includes('pipeline')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log

    // Fetch org metadata to get available custom objects for this user
    let customObjectsContext = "";
    if (args.userId) {
      try {
        const orgMetadata = await ctx.runQuery(internal.orgMetadata.getAvailableObjects, {
          userId: args.userId,
        });
        if (orgMetadata.customObjects && orgMetadata.customObjects.length > 0) {
          // Build rich context with field details
          const objectDescriptions = orgMetadata.customObjects.map((obj: any) => {
            let desc = `\n### ${obj.name} (${obj.label})`;
            if (obj.description) desc += `\n${obj.description}`;
            if (obj.recordCount !== undefined) desc += ` - ${obj.recordCount} records`;

            if (obj.keyFields && obj.keyFields.length > 0) {
              desc += `\nFields:`;
              for (const field of obj.keyFields.slice(0, 8)) {
                if (typeof field === "object") {
                  // Rich field metadata
                  let fieldDesc = `  - ${field.name} (${field.label}) [${field.type}]`;
                  if (field.picklistValues && field.picklistValues.length > 0) {
                    fieldDesc += ` values: ${field.picklistValues.slice(0, 5).join(", ")}`;
                  }
                  if (field.referenceTo) {
                    fieldDesc += ` → ${field.referenceTo}`;
                  }
                  desc += `\n${fieldDesc}`;
                } else {
                  // Simple field name
                  desc += `\n  - ${field}`;
                }
              }
            }

            if (obj.sampleFields && obj.sampleFields.length > 0) {
              desc += `\nCommonly used fields: ${obj.sampleFields.join(", ")}`;
            }

            return desc;
          }).join("\n");

          customObjectsContext = `\n\n## CUSTOM OBJECTS IN THIS ORG
${objectDescriptions}

IMPORTANT RULES FOR CUSTOM OBJECTS:
- Only query custom objects listed above
- Use the EXACT field API names (ending in __c)
- When querying messages/conversations, ALWAYS include the content field (e.g. sendblue__Message__c, Message__c, Content__c, Body, etc.)
- Include relevant fields like Direction, From, To, Status in your SELECT
- Always ORDER BY CreatedDate DESC for recent records
- Example for messages: SELECT Id, Name, sendblue__Message__c, sendblue__Direction__c, sendblue__From__c, CreatedDate FROM sendblue__Message__c ORDER BY CreatedDate DESC LIMIT 5
`;
          console.log(`Loaded ${orgMetadata.customObjects.length} custom objects with rich metadata`);
        }
      } catch (e) {
        console.error("Failed to load org metadata:", e);
      }
    }

    // Build conversation history
    const messages: ClaudeMessage[] = args.conversationHistory || [];
    messages.push({ role: "user", content: args.userMessage });

    // Call Claude to interpret the request
    // Limit context to last 10 messages for performance
    const recentMessages = messages.slice(-10);
    const interpretation = await interpretWithClaude(recentMessages, customObjectsContext);

    // #region agent log (debug-session)
    fetch('http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A',location:'convex/ai.ts:askSalesforce:interpretation',message:'askSalesforce interpretation summary',data:{action:(interpretation as any)?.action ?? null,objectType:(interpretation as any)?.objectType ?? null,hasSoql:!!(interpretation as any)?.soql,soqlLen:typeof (interpretation as any)?.soql==='string'?(interpretation as any).soql.length:null,soqlHasCURRENT_USER:typeof (interpretation as any)?.soql==='string'?(interpretation as any).soql.includes('CURRENT_USER'):null,soqlHasCurlyUserId:typeof (interpretation as any)?.soql==='string'?(/\{userId\}/.test((interpretation as any).soql)):null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log

    // Execute the interpreted action
    try {
      switch (interpretation.action) {
        case "search":
          const searchResults = await ctx.runAction(api.salesforce.searchRecords, {
            query: interpretation.searchTerm || args.userMessage,
            objectType: interpretation.objectType,
            limit: 5,
            userId: args.userId,
          });
          return {
            response: formatSearchResponse(searchResults, interpretation.objectType),
            data: searchResults,
            action: "search",
          };

        case "query":
          // Handle special "my" queries FIRST - these need user context
          const msgLower = args.userMessage.toLowerCase();
          const objTypeLower = (interpretation.objectType || "").toLowerCase();

          // My Opportunities / Pipeline / Deals
          if (objTypeLower === "opportunity" || msgLower.includes("pipeline") || msgLower.includes("my opportunit") || msgLower.includes("my deal")) {
            // #region agent log (debug-session)
            fetch('http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A',location:'convex/ai.ts:askSalesforce:route',message:'routing to getMyOpportunities',data:{objTypeLower,matchedByPipeline:msgLower.includes('pipeline'),matchedByMyDeal:msgLower.includes('my deal')},timestamp:Date.now()})}).catch(()=>{});
            // #endregion agent log
            const oppResults = await ctx.runAction(api.salesforce.getMyOpportunities, {
              stage: "open",
              userId: args.userId,
            });
            return {
              response: oppResults.summary + ". " + formatOpportunities(oppResults.opportunities),
              data: oppResults,
              action: "query",
            };
          }

          // My Tasks / To-dos
          if (objTypeLower === "task" || msgLower.includes("my task") || msgLower.includes("my to-do") || msgLower.includes("my todo")) {
            const taskResults = await ctx.runAction(api.salesforce.getMyTasks, {
              status: "open",
              userId: args.userId,
            });
            return {
              response: formatTasks(taskResults.tasks),
              data: taskResults,
              action: "query",
            };
          }

          // My Leads
          if (objTypeLower === "lead" || msgLower.includes("my lead")) {
            // #region agent log (debug-session)
            fetch('http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A',location:'convex/ai.ts:askSalesforce:route',message:'routing to getMyLeads',data:{objTypeLower,matchedByMyLead:msgLower.includes('my lead')},timestamp:Date.now()})}).catch(()=>{});
            // #endregion agent log
            const leadResults = await ctx.runAction(api.salesforce.getMyLeads, {
              status: "open",
              userId: args.userId,
            });
            return {
              response: leadResults.summary + ". " + formatLeads(leadResults.leads),
              data: leadResults,
              action: "query",
            };
          }

          // My Accounts
          if (objTypeLower === "account" || msgLower.includes("my account")) {
            const accountResults = await ctx.runAction(api.salesforce.getMyAccounts, {
              userId: args.userId,
            });
            const summary = `You have ${accountResults.count} account${accountResults.count !== 1 ? 's' : ''}`;
            return {
              response: summary + ". " + formatAccounts(accountResults.accounts),
              data: accountResults,
              action: "query",
            };
          }

          // For any SOQL queries (CURRENT_USER placeholder gets replaced in searchRecords)
          if (interpretation.soql) {
            // #region agent log (debug-session)
            fetch('http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B',location:'convex/ai.ts:askSalesforce:route',message:'routing to searchRecords with raw SOQL',data:{objTypeLower,soqlLen:typeof (interpretation as any)?.soql==='string'?(interpretation as any).soql.length:null,soqlHasCURRENT_USER:typeof (interpretation as any)?.soql==='string'?(interpretation as any).soql.includes('CURRENT_USER'):null,soqlHasCurlyUserId:typeof (interpretation as any)?.soql==='string'?(/\{userId\}/.test((interpretation as any).soql)):null},timestamp:Date.now()})}).catch(()=>{});
            // #endregion agent log
            const queryResults = await ctx.runAction(api.salesforce.searchRecords, {
              query: interpretation.soql,
              userId: args.userId,
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
            // Process date placeholders in fields
            const processedFields = processDatePlaceholders(interpretation.fields);

            // For Cases, try to link to Account if searchTerm provided
            if (interpretation.objectType === "Case" && interpretation.searchTerm && !processedFields.AccountId) {
              try {
                const accountSearch = await ctx.runAction(api.salesforce.searchRecords, {
                  query: interpretation.searchTerm,
                  objectType: "Account",
                  limit: 1,
                  userId: args.userId,
                });
                if (accountSearch.records && accountSearch.records.length > 0) {
                  processedFields.AccountId = accountSearch.records[0].Id;
                }
              } catch (e) {
                console.log("Could not find account to link case:", e);
              }
            }

            const createResult = await ctx.runAction(api.salesforce.createRecord, {
              objectType: interpretation.objectType,
              fields: processedFields,
              userId: args.userId,
            });
            return {
              response: interpretation.response || `Done! I created a new ${interpretation.objectType}.`,
              data: createResult,
              action: "create",
              recordUrl: createResult.recordUrl,
            };
          }
          break;

        case "update":
          if (interpretation.recordId && interpretation.objectType && interpretation.fields) {
            const updateResult = await ctx.runAction(api.salesforce.updateRecord, {
              recordId: interpretation.recordId,
              objectType: interpretation.objectType,
              fields: interpretation.fields,
              userId: args.userId,
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
              userId: args.userId,
            });
            if (findResult.records && findResult.records.length > 0) {
              const recordId = findResult.records[0].Id;
              const updateResult = await ctx.runAction(api.salesforce.updateRecord, {
                recordId,
                objectType: interpretation.objectType,
                fields: interpretation.fields,
                userId: args.userId,
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
            userId: args.userId,
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
      // #region agent log (debug-session)
      fetch('http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C',location:'convex/ai.ts:askSalesforce:error',message:'askSalesforce caught error',data:{errorMessageLen:typeof error?.message==='string'?error.message.length:null,errorHasCurlyUserId:typeof error?.message==='string'?(/\{userId\}/.test(error.message)):null,errorHasInvalidIdField:typeof error?.message==='string'?(/invalid ID field/i.test(error.message)):null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      return {
        response: `I ran into an issue: ${error.message}. Would you like me to try again?`,
      };
    }
  },
});

/**
 * Use Claude to interpret the user's natural language request
 */
async function interpretWithClaude(messages: ClaudeMessage[], customObjectsContext: string = ""): Promise<ParsedIntent> {
  const systemPrompt = `${SALESFORCE_SCHEMA_CONTEXT}${customObjectsContext}

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
- "Create a case for Acme - their website is down" → { "action": "create", "objectType": "Case", "fields": { "Subject": "Website is down", "Description": "Customer reported website is down", "Status": "New", "Priority": "High", "Origin": "Phone" }, "searchTerm": "Acme", "response": "Creating a high priority case for Acme about the website issue." }
- "Open a support case for billing problem" → { "action": "create", "objectType": "Case", "fields": { "Subject": "Billing problem", "Status": "New", "Priority": "Medium", "Origin": "Phone" }, "response": "Creating a support case for the billing problem." }
- "Log this call" → { "action": "log_call", "fields": { "Subject": "Voice call via TalkCRM" }, "response": "I'll log this call for you." }
- "Record an issue for customer" → { "action": "clarify", "clarificationQuestion": "Should I create a support case for a customer issue, or a task for your to-do list?", "response": "Should I create a support case for a customer issue, or a task for your to-do list?" }

ONLY respond with the JSON object, no other text.`;

  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages,
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "{}";

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

  const records = results.records;
  const count = results.totalSize;

  // Content fields to look for (in priority order)
  const contentFields = ["sendblue__Message__c", "Message__c", "Content__c", "Body", "Description", "Subject", "Name"];

  // Format each record fully (no truncation)
  const formattedRecords = records.map((r: any, index: number) => {
    // Find a content field
    let content = "";
    for (const field of contentFields) {
      if (r[field]) {
        content = String(r[field]);
        break;
      }
    }

    // Get metadata fields
    const direction = r.sendblue__Direction__c || r.Direction__c || "";
    const from = r.sendblue__From__c || r.From__c || "";
    const to = r.sendblue__To__c || r.To__c || "";
    const name = r.Name || r.Subject || "";
    const date = r.sendblue__Date_Sent_Received__c || r.CreatedDate || "";

    // Format timestamp if present
    let timeStr = "";
    if (date) {
      const d = new Date(date);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) {
        timeStr = `${diffMins}m ago`;
      } else if (diffHours < 24) {
        timeStr = `${diffHours}h ago`;
      } else if (diffDays < 7) {
        timeStr = `${diffDays}d ago`;
      } else {
        timeStr = d.toLocaleDateString();
      }
    }

    // Build the formatted line
    const num = index + 1;
    if (direction && from && content) {
      // Message format: "1. Inbound from +1234567890 (2h ago): Hey how are you"
      const timeNote = timeStr ? ` (${timeStr})` : "";
      return `${num}. ${direction} from ${from}${timeNote}: ${content}`;
    } else if (content) {
      const timeNote = timeStr ? ` (${timeStr})` : "";
      return `${num}. ${content}${timeNote}`;
    } else if (name) {
      const timeNote = timeStr ? ` (${timeStr})` : "";
      return `${num}. ${name}${timeNote}`;
    } else {
      return `${num}. Record ${r.Id?.slice(-6) || "unknown"}`;
    }
  });

  // Build the full response
  const header = `Found ${count} ${objectType || "record"}${count !== 1 ? "s" : ""}:`;
  return `${header}\n${formattedRecords.join("\n")}`;
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

function formatLeads(leads: any[]): string {
  if (!leads || leads.length === 0) {
    return "You don't have any leads right now.";
  }

  if (leads.length === 1) {
    const l = leads[0];
    return `${l.name} from ${l.company || "unknown company"}, status: ${l.status}.`;
  }

  if (leads.length <= 3) {
    return leads.map(l => `${l.name} from ${l.company || "unknown"}`).join(", ") + ".";
  }

  const top3 = leads.slice(0, 3);
  return `Including ${top3.map(l => l.name).join(", ")}. Plus ${leads.length - 3} more.`;
}

function formatAccounts(accounts: any[]): string {
  if (!accounts || accounts.length === 0) {
    return "You don't have any accounts assigned to you.";
  }

  if (accounts.length === 1) {
    const a = accounts[0];
    return `${a.name}${a.industry ? `, ${a.industry}` : ""}${a.type ? ` (${a.type})` : ""}.`;
  }

  if (accounts.length <= 3) {
    return accounts.map(a => a.name).join(", ") + ".";
  }

  const top3 = accounts.slice(0, 3);
  return `Including ${top3.map(a => a.name).join(", ")}. Plus ${accounts.length - 3} more.`;
}

/**
 * Process date placeholders like TOMORROW, TODAY, NEXT_WEEK
 */
function processDatePlaceholders(fields: Record<string, any>): Record<string, any> {
  const processed = { ...fields };
  const today = new Date();

  for (const [key, value] of Object.entries(processed)) {
    if (typeof value === "string") {
      const upperValue = value.toUpperCase();
      if (upperValue === "TODAY") {
        processed[key] = today.toISOString().split("T")[0];
      } else if (upperValue === "TOMORROW") {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        processed[key] = tomorrow.toISOString().split("T")[0];
      } else if (upperValue === "NEXT_WEEK" || upperValue === "NEXT WEEK") {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        processed[key] = nextWeek.toISOString().split("T")[0];
      } else if (upperValue === "END_OF_WEEK" || upperValue === "END OF WEEK" || upperValue === "THIS_WEEK") {
        const endOfWeek = new Date(today);
        const daysUntilFriday = (5 - today.getDay() + 7) % 7;
        endOfWeek.setDate(endOfWeek.getDate() + daysUntilFriday);
        processed[key] = endOfWeek.toISOString().split("T")[0];
      } else if (upperValue === "NEXT_MONTH" || upperValue === "NEXT MONTH") {
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        processed[key] = nextMonth.toISOString().split("T")[0];
      }
    }
  }

  return processed;
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
