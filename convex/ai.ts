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

PHONE NUMBER LOOKUPS (CRITICAL):
- Phone numbers in SMS/messaging objects are stored in E.164 format: +1XXXXXXXXXX (e.g., +18185881911)
- When searching for a Lead/Contact by phone number from a conversation:
  1. First check if the object has a direct lookup field to Lead/Contact (e.g., sendblue__Lead__c)
  2. Query using the phone field AND return the lookup relationship data
  3. Use relationship notation to get related record details (e.g., sendblue__Lead__r.Name)
- Phone format normalization: Users may say "818-558-1911" but the field stores "+18185881911"
  - Strip formatting: remove spaces, dashes, parentheses
  - Add country code if missing: assume +1 for US numbers
  - Store format: +1XXXXXXXXXX

LOOKUP RELATIONSHIP QUERIES:
- When a field has "referenceTo" and "relationshipName", you can traverse the relationship
- Example: sendblue__Lead__c (reference to Lead, relationshipName: sendblue__Lead__r)
  - To get the related Lead's name: SELECT sendblue__Lead__r.Name FROM sendblue__Conversation__c
  - To check if a lead exists for a phone: SELECT Id, sendblue__Lead__c, sendblue__Lead__r.Name FROM sendblue__Conversation__c WHERE sendblue__Contact_Number__c = '+18185881911'
- Always use the relationshipName (ending in __r) to access parent record fields
- If sendblue__Lead__c is null, there is NO lead associated with that conversation

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
- Use SOQL date literals for time-based filters (TODAY, THIS_WEEK, LAST_N_DAYS:7, etc.)

DEFAULT QUERIES - use minimal fields for quick responses:
- "my leads" → SELECT Id, Name, Company, Status FROM Lead WHERE OwnerId = CURRENT_USER ORDER BY CreatedDate DESC LIMIT 10
- "last payment" → SELECT Id, Name, CreatedDate FROM Payment__c ORDER BY CreatedDate DESC LIMIT 1

DETAIL QUERIES - when user asks "more info", "more fields", "tell me more", "details":
- Include ALL available fields from the object's field list
- "more info about payment" → SELECT Id, Name, CreatedDate, Payment_Amount__c, Payment_Date__c, Payment_Method__c, Notes__c, Related_Account__c FROM Payment__c WHERE Id = 'xxx'
- "show me all fields" → Include every field listed for that object in the CUSTOM OBJECTS section

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
  followUp?: string; // Suggested next action for the user
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
  handler: async (ctx, args): Promise<{ response: string; data?: any; action?: string; recordUrl?: string; followUp?: string }> => {
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
                    // Include relationship name for traversing lookups
                    if ((field as any).relationshipName) {
                      fieldDesc += ` (use ${(field as any).relationshipName} for related fields)`;
                    }
                  }
                  // Flag phone/contact number fields for lookup guidance
                  if (field.name.toLowerCase().includes('phone') || field.name.toLowerCase().includes('contact_number')) {
                    fieldDesc += ` [PHONE - E.164 format]`;
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

CRITICAL RULES FOR CUSTOM OBJECTS:
1. ONLY use fields that are EXPLICITLY listed above for each object - if a field isn't in the list, it DOES NOT EXIST
2. NEVER guess or assume field names - common mistakes:
   - "Amount__c" is WRONG - the actual field might be "Payment_Amount__c" or "Invoice_Amount__c"
   - "Date__c" is WRONG - look for "Payment_Date__c", "Due_Date__c", etc.
   - Always use the EXACT full field name from the Fields list above
3. Field names are case-sensitive and must end in __c for custom fields
4. When constructing SOQL, ONLY SELECT fields that are shown in the object's Fields list
5. Always include CreatedDate and ORDER BY CreatedDate DESC for recent records
6. For messages/conversations, look for content fields like sendblue__Message__c, Message__c, Content__c
7. If you're unsure about a field name, use ONLY the basic fields: Id, Name, CreatedDate

PHONE/LEAD LOOKUP PATTERNS (use these when asked about leads/contacts for a phone number):
- "Is there a lead for +18185881911?" → Query the Conversation object by phone, check the Lead lookup:
  SELECT Id, sendblue__Lead__c, sendblue__Lead__r.Name, sendblue__Lead__r.Company FROM sendblue__Conversation__c WHERE sendblue__Contact_Number__c = '+18185881911' LIMIT 1
- If sendblue__Lead__c is NULL in the result, respond "No lead is linked to this conversation"
- If sendblue__Lead__c has a value, respond with the lead details from sendblue__Lead__r fields
- NEVER just return all leads - always filter by the specific phone number first
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
    let interpretation: ParsedIntent;
    try {
      interpretation = await interpretWithClaude(recentMessages, customObjectsContext);
    } catch (error: any) {
      console.error("Error interpreting request with Claude:", error);
      return {
        response: error.message || "I'm having trouble understanding that right now. Could you try rephrasing?",
      };
    }

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
            response: appendFollowUp(formatSearchResponse(searchResults, interpretation.objectType), interpretation.followUp),
            data: searchResults,
            action: "search",
            followUp: interpretation.followUp,
          };

        case "query":
          // Handle special "my" queries FIRST - these need user context
          const msgLower = args.userMessage.toLowerCase();
          const objTypeLower = (interpretation.objectType || "").toLowerCase();

          // My Opportunities / Pipeline / Deals - BUT only if no specific SOQL query
          if ((objTypeLower === "opportunity" || msgLower.includes("pipeline") || msgLower.includes("my opportunit") || msgLower.includes("my deal")) && !interpretation.soql) {
            // #region agent log (debug-session)
            fetch('http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A',location:'convex/ai.ts:askSalesforce:route',message:'routing to getMyOpportunities',data:{objTypeLower,matchedByPipeline:msgLower.includes('pipeline'),matchedByMyDeal:msgLower.includes('my deal')},timestamp:Date.now()})}).catch(()=>{});
            // #endregion agent log
            const oppResults = await ctx.runAction(api.salesforce.getMyOpportunities, {
              stage: "open",
              userId: args.userId,
            });
            return {
              response: appendFollowUp(oppResults.summary + ". " + formatOpportunities(oppResults.opportunities), interpretation.followUp),
              data: oppResults,
              action: "query",
              followUp: interpretation.followUp,
            };
          }

          // My Tasks / To-dos - BUT only if no specific SOQL query
          if ((objTypeLower === "task" || msgLower.includes("my task") || msgLower.includes("my to-do") || msgLower.includes("my todo")) && !interpretation.soql) {
            const taskResults = await ctx.runAction(api.salesforce.getMyTasks, {
              status: "open",
              userId: args.userId,
            });
            return {
              response: appendFollowUp(formatTasks(taskResults.tasks), interpretation.followUp),
              data: taskResults,
              action: "query",
              followUp: interpretation.followUp,
            };
          }

          // My Leads - BUT only if no specific SOQL query was generated
          // If Claude generated SOQL (e.g., for phone lookup), let it execute instead
          if ((objTypeLower === "lead" || msgLower.includes("my lead")) && !interpretation.soql) {
            // #region agent log (debug-session)
            fetch('http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A',location:'convex/ai.ts:askSalesforce:route',message:'routing to getMyLeads',data:{objTypeLower,matchedByMyLead:msgLower.includes('my lead')},timestamp:Date.now()})}).catch(()=>{});
            // #endregion agent log
            const leadResults = await ctx.runAction(api.salesforce.getMyLeads, {
              status: "open",
              userId: args.userId,
            });
            return {
              response: appendFollowUp(leadResults.summary + ". " + formatLeads(leadResults.leads), interpretation.followUp),
              data: leadResults,
              action: "query",
              followUp: interpretation.followUp,
            };
          }

          // My Accounts - BUT only if no specific SOQL query
          if ((objTypeLower === "account" || msgLower.includes("my account")) && !interpretation.soql) {
            const accountResults = await ctx.runAction(api.salesforce.getMyAccounts, {
              userId: args.userId,
            });
            const summary = `You have ${accountResults.count} account${accountResults.count !== 1 ? 's' : ''}`;
            return {
              response: appendFollowUp(summary + ". " + formatAccounts(accountResults.accounts), interpretation.followUp),
              data: accountResults,
              action: "query",
              followUp: interpretation.followUp,
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
              response: appendFollowUp(formatQueryResponse(queryResults, interpretation.objectType), interpretation.followUp),
              data: queryResults,
              action: "query",
              followUp: interpretation.followUp,
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
              response: appendFollowUp(interpretation.response || `Done! I created a new ${interpretation.objectType}.`, interpretation.followUp),
              data: createResult,
              action: "create",
              recordUrl: createResult.recordUrl,
              followUp: interpretation.followUp,
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
              response: appendFollowUp(interpretation.response || `Got it! I updated that ${interpretation.objectType}.`, interpretation.followUp),
              data: updateResult,
              action: "update",
              followUp: interpretation.followUp,
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
                response: appendFollowUp(interpretation.response || `Done! I updated ${findResult.records[0].Name}.`, interpretation.followUp),
                data: updateResult,
                action: "update",
                followUp: interpretation.followUp,
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
            response: appendFollowUp(interpretation.response || "I've logged this call in Salesforce.", interpretation.followUp),
            data: logResult,
            action: "log_call",
            followUp: interpretation.followUp,
          };

        case "clarify":
          // No follow-up for clarification questions
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
  "response": "what to say to the user (keep it SHORT for voice)",
  "followUp": "a helpful next action suggestion (optional, keep SHORT)"
}

FOLLOW-UP SUGGESTIONS:
- After every successful action, suggest a relevant next step the user might want to take
- Keep follow-ups SHORT (under 10 words) and actionable
- Make them contextually relevant to what was just done
- Examples: "Want to add a follow-up task?", "Should I update the amount?", "Need contact details?"
- Don't include followUp for clarify actions

Examples:
- "Show me my pipeline" → { "action": "query", "objectType": "Opportunity", "response": "Let me get your opportunities...", "followUp": "Want details on any of these?" }
- "Find Acme" → { "action": "search", "searchTerm": "Acme", "objectType": "Account", "response": "Searching for Acme...", "followUp": "Need to see their contacts?" }
- "Update Acme deal to Negotiation" → { "action": "update", "objectType": "Opportunity", "searchTerm": "Acme", "fields": { "StageName": "Negotiation/Review" }, "response": "I'll update the Acme opportunity to Negotiation.", "followUp": "Should I create a follow-up task?" }
- "Create a task to call John tomorrow" → { "action": "create", "objectType": "Task", "fields": { "Subject": "Call John", "ActivityDate": "TOMORROW", "Status": "Not Started" }, "response": "Creating a task to call John tomorrow.", "followUp": "Want to add notes or details?" }
- "Create a case for Acme - their website is down" → { "action": "create", "objectType": "Case", "fields": { "Subject": "Website is down", "Description": "Customer reported website is down", "Status": "New", "Priority": "High", "Origin": "Phone" }, "searchTerm": "Acme", "response": "Creating a high priority case for Acme about the website issue.", "followUp": "Need to assign it to someone?" }
- "Create a case for Adam Smith - pressure issues with chamber" → { "action": "create", "objectType": "Case", "fields": { "Subject": "Chamber pressure issues", "Description": "Customer reporting pressure issues with their chamber", "Status": "New", "Priority": "High", "Origin": "Phone" }, "searchTerm": "Adam Smith", "response": "Creating a case for Adam Smith about chamber pressure issues.", "followUp": "Should I link it to an account?" }
- "Open a support case for billing problem" → { "action": "create", "objectType": "Case", "fields": { "Subject": "Billing problem", "Status": "New", "Priority": "Medium", "Origin": "Phone" }, "response": "Creating a support case for the billing problem.", "followUp": "Want to link it to an account?" }

IMPORTANT FOR CASES: When a customer name is mentioned (e.g., "case for John Smith", "case for Acme"), ALWAYS include "searchTerm" with the customer/company name so we can link it to their Account/Lead.
- "Log this call" → { "action": "log_call", "fields": { "Subject": "Voice call via TalkCRM" }, "response": "I'll log this call for you.", "followUp": "Should I create a follow-up task?" }
- "Record an issue for customer" → { "action": "clarify", "clarificationQuestion": "Should I create a support case for a customer issue, or a task for your to-do list?", "response": "Should I create a support case for a customer issue, or a task for your to-do list?" }

ONLY respond with the JSON object, no other text.`;

  try {
    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY is not configured");
      throw new Error("AI service is not configured. Please contact support.");
    }

    const client = new Anthropic({ apiKey });

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
  } catch (error: any) {
    console.error("Error calling Claude API:", error);
    // Return a safe fallback response
    return {
      action: "clarify",
      response: error.message || "I'm having trouble processing that right now. Please try again.",
    };
  }
}

// ============================================================================
// RESPONSE FORMATTERS (Keep responses short for voice!)
// ============================================================================

/**
 * Append a follow-up suggestion to a response
 * Keeps it conversational and short for voice/text
 */
function appendFollowUp(response: string, followUp?: string): string {
  if (!followUp) return response;
  // Add the follow-up on a new line or with a separator
  return `${response}\n\n${followUp}`;
}

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

  // Fields to skip when displaying (system fields)
  const skipFields = ["attributes", "Id", "OwnerId", "CreatedById", "LastModifiedById", "SystemModstamp"];

  // Field label mappings for common fields
  const fieldLabels: Record<string, string> = {
    "Name": "Name",
    "CreatedDate": "Created",
    "Payment_Amount__c": "Amount",
    "Payment_Date__c": "Date",
    "Payment_Method__c": "Method",
    "Payment_Reference_Number__c": "Reference",
    "Related_Account__c": "Account",
    "Related_Opportunity__c": "Opportunity",
    "Invoice_Amount__c": "Amount",
    "Due_Date__c": "Due Date",
    "Status__c": "Status",
    "Description": "Description",
    "Notes__c": "Notes",
  };

  // Format each record with all available fields
  const formattedRecords = records.map((r: any, index: number) => {
    const num = index + 1;
    const name = r.Name || r.Subject || `Record ${index + 1}`;

    // Format timestamp
    let timeStr = "";
    const date = r.CreatedDate;
    if (date) {
      const d = new Date(date);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffHours < 24) {
        timeStr = `${diffHours}h ago`;
      } else if (diffDays < 7) {
        timeStr = `${diffDays}d ago`;
      } else {
        timeStr = d.toLocaleDateString();
      }
    }

    // Collect all non-empty fields
    const fieldValues: string[] = [];
    for (const [key, value] of Object.entries(r)) {
      if (skipFields.includes(key) || value === null || value === undefined || value === "") continue;
      if (key === "Name" || key === "Subject" || key === "CreatedDate") continue; // Already shown in header

      // Format the value
      let displayValue = String(value);

      // Format currency fields
      if (key.includes("Amount") || key.includes("Price") || key.includes("Total")) {
        const numVal = parseFloat(displayValue);
        if (!isNaN(numVal)) {
          displayValue = "$" + numVal.toLocaleString();
        }
      }

      // Format date fields
      if (key.includes("Date") && displayValue.includes("T")) {
        displayValue = new Date(displayValue).toLocaleDateString();
      }

      // Get friendly label
      const label = fieldLabels[key] || key.replace(/__c$/, "").replace(/_/g, " ");
      fieldValues.push(`${label}: ${displayValue}`);
    }

    // Build the output
    const header = `${num}. **${name}**${timeStr ? ` (${timeStr})` : ""}`;
    if (fieldValues.length > 0) {
      return `${header}\n   ${fieldValues.join("\n   ")}`;
    }
    return header;
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
