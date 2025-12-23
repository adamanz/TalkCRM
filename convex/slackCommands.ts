import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  buildSearchResultsBlocks,
  buildPipelineBlocks,
  buildTasksBlocks,
  buildHelpBlocks,
  buildErrorBlocks,
  buildThinkingBlocks,
  section,
  context,
  actions,
  button,
  divider,
  header,
} from "./slackBlocks";

// ============================================================================
// SLACK SLASH COMMAND HANDLERS
// Handles /crm commands from Slack
// ============================================================================

interface SlackCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

/**
 * Parse command text into subcommand and arguments
 */
function parseCommand(text: string): { subcommand: string; args: string } {
  const trimmed = text.trim();
  const spaceIndex = trimmed.indexOf(" ");

  if (spaceIndex === -1) {
    return { subcommand: trimmed.toLowerCase(), args: "" };
  }

  return {
    subcommand: trimmed.substring(0, spaceIndex).toLowerCase(),
    args: trimmed.substring(spaceIndex + 1).trim(),
  };
}

/**
 * Main command handler - routes to specific handlers
 */
export const handleSlashCommand = internalAction({
  args: {
    teamId: v.string(),
    channelId: v.string(),
    userId: v.string(),         // Slack user ID
    userName: v.string(),
    command: v.string(),
    text: v.string(),
    responseUrl: v.string(),
    triggerId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("handleSlashCommand called:", { teamId: args.teamId, text: args.text, responseUrl: args.responseUrl });

    // Get installation for this team
    const installation = await ctx.runQuery(internal.slack.getInstallationByTeam, {
      teamId: args.teamId,
    });

    console.log("Installation found:", installation ? "yes" : "no");

    if (!installation) {
      await ctx.runAction(internal.slack.respondToCommand, {
        responseUrl: args.responseUrl,
        text: "TalkCRM is not set up for this workspace. Please install the app first.",
        blocks: buildErrorBlocks(
          "TalkCRM is not connected to this workspace.",
          "Visit talkcrm.com/settings to connect Slack."
        ),
      });
      return;
    }

    // Parse the command
    const { subcommand, args: cmdArgs } = parseCommand(args.text);

    // Route to appropriate handler
    try {
      switch (subcommand) {
        case "search":
        case "find":
        case "lookup":
          await handleSearch(ctx, installation, cmdArgs, args.responseUrl);
          break;

        case "pipeline":
        case "deals":
        case "opportunities":
          await handlePipeline(ctx, installation, cmdArgs, args.responseUrl);
          break;

        case "tasks":
        case "todo":
        case "todos":
          await handleTasks(ctx, installation, cmdArgs, args.responseUrl);
          break;

        case "log":
        case "note":
          await handleLog(ctx, installation, cmdArgs, args.responseUrl);
          break;

        case "help":
        case "":
          console.log("Calling handleHelp with responseUrl:", args.responseUrl);
          await handleHelp(args.responseUrl);
          console.log("handleHelp completed");
          break;

        default:
          // Try AI interpretation for unknown commands
          await ctx.runAction(internal.slackCommands.handleAIQuery, {
            installationId: installation._id,
            userId: installation.userId,
            query: args.text,
            responseUrl: args.responseUrl,
          });
          break;
      }
    } catch (error: any) {
      console.error("Slash command error:", error);
      await ctx.runAction(internal.slack.respondToCommand, {
        responseUrl: args.responseUrl,
        text: `Error: ${error.message}`,
        blocks: buildErrorBlocks(error.message, "Try /crm help for available commands."),
      });
    }
  },
});

/**
 * Handle /crm search <query>
 */
async function handleSearch(
  ctx: any,
  installation: any,
  query: string,
  responseUrl: string
) {
  if (!query) {
    await ctx.runAction(internal.slack.respondToCommand, {
      responseUrl,
      text: "Please provide a search query. Example: /crm search Acme Corp",
      blocks: buildErrorBlocks(
        "Missing search query",
        "Try: /crm search <company or contact name>"
      ),
    });
    return;
  }

  // Send immediate "thinking" response
  await ctx.runAction(internal.slack.respondToCommand, {
    responseUrl,
    text: `Searching for "${query}"...`,
    blocks: buildThinkingBlocks(`Searching for "${query}"`),
  });

  // Perform search using Salesforce
  const searchResults = await ctx.runAction(api.salesforce.searchRecords, {
    query,
    limit: 5,
    userId: installation.userId,
  });

  // Get Salesforce auth for record URLs
  let instanceUrl: string | undefined;
  try {
    const sfStatus = await ctx.runQuery(api.salesforce.getSalesforceStatus, {
      userId: installation.userId,
    });
    instanceUrl = sfStatus.instanceUrl;
  } catch (e) {
    console.log("Could not get Salesforce instance URL");
  }

  // Build and send results
  const blocks = buildSearchResultsBlocks(query, searchResults.records, undefined, instanceUrl);

  await ctx.runAction(internal.slack.respondToCommand, {
    responseUrl,
    text: `Found ${searchResults.totalSize} results for "${query}"`,
    blocks,
    responseType: "in_channel" as const,
  });
}

/**
 * Handle /crm pipeline
 */
async function handlePipeline(
  ctx: any,
  installation: any,
  args: string,
  responseUrl: string
) {
  // Send immediate response
  await ctx.runAction(internal.slack.respondToCommand, {
    responseUrl,
    text: "Loading your pipeline...",
    blocks: buildThinkingBlocks("Loading your pipeline"),
  });

  // Parse optional filters
  let stage: string | undefined;
  let closeDate: string | undefined;

  const argsLower = args.toLowerCase();
  if (argsLower.includes("won")) {
    stage = "won";
  } else if (argsLower.includes("lost")) {
    stage = "lost";
  } else {
    stage = "open";
  }

  if (argsLower.includes("this month")) {
    closeDate = "this_month";
  } else if (argsLower.includes("this quarter")) {
    closeDate = "this_quarter";
  } else if (argsLower.includes("next quarter")) {
    closeDate = "next_quarter";
  }

  // Fetch opportunities
  const oppResults = await ctx.runAction(api.salesforce.getMyOpportunities, {
    stage,
    closeDate,
    userId: installation.userId,
  });

  // Get Salesforce instance URL
  let instanceUrl: string | undefined;
  try {
    const sfStatus = await ctx.runQuery(api.salesforce.getSalesforceStatus, {
      userId: installation.userId,
    });
    instanceUrl = sfStatus.instanceUrl;
  } catch (e) {
    console.log("Could not get Salesforce instance URL");
  }

  // Build and send response
  const blocks = buildPipelineBlocks(
    oppResults.opportunities,
    {
      count: oppResults.count,
      totalAmount: oppResults.totalAmount,
    },
    instanceUrl
  );

  await ctx.runAction(internal.slack.respondToCommand, {
    responseUrl,
    text: oppResults.summary,
    blocks,
    responseType: "in_channel" as const,
  });
}

/**
 * Handle /crm tasks
 */
async function handleTasks(
  ctx: any,
  installation: any,
  args: string,
  responseUrl: string
) {
  // Send immediate response
  await ctx.runAction(internal.slack.respondToCommand, {
    responseUrl,
    text: "Loading your tasks...",
    blocks: buildThinkingBlocks("Loading your tasks"),
  });

  // Parse optional filters
  let status: string | undefined;
  let dueDate: string | undefined;

  const argsLower = args.toLowerCase();
  if (argsLower.includes("completed") || argsLower.includes("done")) {
    status = "completed";
  } else {
    status = "open";
  }

  if (argsLower.includes("today")) {
    dueDate = "today";
  } else if (argsLower.includes("this week")) {
    dueDate = "this_week";
  } else if (argsLower.includes("overdue")) {
    dueDate = "overdue";
  }

  // Fetch tasks
  const taskResults = await ctx.runAction(api.salesforce.getMyTasks, {
    status,
    dueDate,
    userId: installation.userId,
  });

  // Get Salesforce instance URL
  let instanceUrl: string | undefined;
  try {
    const sfStatus = await ctx.runQuery(api.salesforce.getSalesforceStatus, {
      userId: installation.userId,
    });
    instanceUrl = sfStatus.instanceUrl;
  } catch (e) {
    console.log("Could not get Salesforce instance URL");
  }

  // Build and send response
  const blocks = buildTasksBlocks(taskResults.tasks, instanceUrl);

  await ctx.runAction(internal.slack.respondToCommand, {
    responseUrl,
    text: `You have ${taskResults.count} tasks`,
    blocks,
    responseType: "in_channel" as const,
  });
}

/**
 * Handle /crm log <record> <note>
 */
async function handleLog(
  ctx: any,
  installation: any,
  args: string,
  responseUrl: string
) {
  // Parse: first word is record name/id, rest is the note
  const parts = args.split(/\s+/);
  if (parts.length < 2) {
    await ctx.runAction(internal.slack.respondToCommand, {
      responseUrl,
      text: "Please provide a record name and note. Example: /crm log Acme Discussed pricing with John",
      blocks: buildErrorBlocks(
        "Missing record or note",
        "Format: /crm log <record name> <note>"
      ),
    });
    return;
  }

  const recordSearch = parts[0];
  const note = parts.slice(1).join(" ");

  // Send immediate response
  await ctx.runAction(internal.slack.respondToCommand, {
    responseUrl,
    text: `Logging note to ${recordSearch}...`,
    blocks: buildThinkingBlocks(`Logging note to ${recordSearch}`),
  });

  // Search for the record first
  const searchResults = await ctx.runAction(api.salesforce.searchRecords, {
    query: recordSearch,
    limit: 1,
    userId: installation.userId,
  });

  if (!searchResults.records || searchResults.records.length === 0) {
    await ctx.runAction(internal.slack.respondToCommand, {
      responseUrl,
      text: `Could not find a record matching "${recordSearch}"`,
      blocks: buildErrorBlocks(
        `No record found matching "${recordSearch}"`,
        "Try searching with /crm search first"
      ),
    });
    return;
  }

  const record = searchResults.records[0];
  const recordType = record.attributes?.type || "Record";

  // Determine whatId vs whoId based on object type
  let whoId: string | undefined;
  let whatId: string | undefined;

  if (recordType === "Contact" || recordType === "Lead") {
    whoId = record.Id;
  } else {
    whatId = record.Id;
  }

  // Log the call/activity
  const logResult = await ctx.runAction(api.salesforce.logCall, {
    subject: `Note from Slack`,
    description: note,
    whoId,
    whatId,
    userId: installation.userId,
  });

  // Get Salesforce instance URL
  let instanceUrl: string | undefined;
  try {
    const sfStatus = await ctx.runQuery(api.salesforce.getSalesforceStatus, {
      userId: installation.userId,
    });
    instanceUrl = sfStatus.instanceUrl;
  } catch (e) {
    console.log("Could not get Salesforce instance URL");
  }

  const recordUrl = instanceUrl
    ? `${instanceUrl}/lightning/r/Task/${logResult.taskId}/view`
    : undefined;

  // Send success response
  await ctx.runAction(internal.slack.respondToCommand, {
    responseUrl,
    text: `Logged note to ${record.Name}`,
    blocks: [
      header("✅ Activity Logged"),
      section(`*${record.Name}* (${recordType})`),
      section(`📝 ${note}`),
      context([`Task ID: ${logResult.taskId}`]),
      ...(recordUrl
        ? [actions([button("View in Salesforce", "view_task", logResult.taskId, { url: recordUrl })])]
        : []),
    ],
    responseType: "in_channel" as const,
  });
}

/**
 * Handle /crm help
 */
async function handleHelp(responseUrl: string) {
  console.log("handleHelp: posting to", responseUrl);
  try {
    const response = await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "TalkCRM Slack Commands",
        blocks: buildHelpBlocks(),
        response_type: "ephemeral",
      }),
    });
    console.log("handleHelp: response status", response.status, response.ok);
  } catch (error: any) {
    console.error("handleHelp error:", error.message);
  }
}

/**
 * Handle AI-powered queries (for unknown commands or @mentions)
 */
export const handleAIQuery = internalAction({
  args: {
    installationId: v.optional(v.id("slackInstallations")),
    userId: v.optional(v.id("users")),
    query: v.string(),
    responseUrl: v.optional(v.string()),
    channelId: v.optional(v.string()),
    threadTs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get user ID from installation if not provided
    let userId = args.userId;
    let installation: any = null;

    if (args.installationId) {
      installation = await ctx.runQuery(internal.slack.getInstallationById, {
        installationId: args.installationId,
      });
      userId = installation?.userId;
    } else if (userId) {
      installation = await ctx.runQuery(internal.slack.getInstallationForUser, {
        userId,
      });
    }

    if (!userId) {
      const errorText = "Could not determine user for this request.";
      if (args.responseUrl) {
        await ctx.runAction(internal.slack.respondToCommand, {
          responseUrl: args.responseUrl,
          text: errorText,
          blocks: buildErrorBlocks(errorText),
        });
      }
      return;
    }

    // Send thinking indicator
    if (args.responseUrl) {
      await ctx.runAction(internal.slack.respondToCommand, {
        responseUrl: args.responseUrl,
        text: "Thinking...",
        blocks: buildThinkingBlocks("Analyzing your request"),
      });
    } else if (installation && args.channelId) {
      // Send to channel directly
      await ctx.runAction(internal.slack.sendMessage, {
        installationId: installation._id,
        channelId: args.channelId,
        text: "Thinking...",
        blocks: buildThinkingBlocks("Analyzing your request"),
        threadTs: args.threadTs,
      });
    }

    // Call AI assistant
    const aiResult = await ctx.runAction(api.ai.askSalesforce, {
      userMessage: args.query,
      userId: userId,
    });

    // Get Salesforce instance URL for any record links
    let instanceUrl: string | undefined;
    try {
      const sfStatus = await ctx.runQuery(api.salesforce.getSalesforceStatus, {
        userId: userId,
      });
      instanceUrl = sfStatus.instanceUrl;
    } catch (e) {
      console.log("Could not get Salesforce instance URL");
    }

    // Build response blocks based on the AI result
    const blocks = buildAIResponseBlocks(aiResult, instanceUrl);

    // Send response
    if (args.responseUrl) {
      await ctx.runAction(internal.slack.respondToCommand, {
        responseUrl: args.responseUrl,
        text: aiResult.response,
        blocks,
        responseType: "in_channel" as const,
      });
    } else if (installation && args.channelId) {
      await ctx.runAction(internal.slack.sendMessage, {
        installationId: installation._id,
        channelId: args.channelId,
        text: aiResult.response,
        blocks,
        threadTs: args.threadTs,
      });
    }
  },
});

/**
 * Handle @mention events
 */
export const handleAppMention = internalAction({
  args: {
    teamId: v.string(),
    channelId: v.string(),
    userId: v.string(),      // Slack user ID
    text: v.string(),        // Full message text
    ts: v.string(),          // Message timestamp
    threadTs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get installation
    const installation = await ctx.runQuery(internal.slack.getInstallationByTeam, {
      teamId: args.teamId,
    });

    if (!installation) {
      console.log("No installation found for team:", args.teamId);
      return;
    }

    // Remove the @mention from the text
    const query = args.text.replace(/<@[A-Z0-9]+>/g, "").trim();

    if (!query) {
      // Just a mention with no text - send help
      await ctx.runAction(internal.slack.sendMessage, {
        installationId: installation._id,
        channelId: args.channelId,
        text: "Hi! I can help you with your CRM data. Try asking me something like:\n• What deals are closing this month?\n• Show me my tasks\n• Search for Acme Corp",
        threadTs: args.threadTs || args.ts,
      });
      return;
    }

    // Process the AI query
    await ctx.runAction(internal.slackCommands.handleAIQuery, {
      installationId: installation._id,
      query,
      channelId: args.channelId,
      threadTs: args.threadTs || args.ts,
    });
  },
});

/**
 * Build response blocks from AI result
 */
function buildAIResponseBlocks(aiResult: any, instanceUrl?: string): any[] {
  const blocks: any[] = [];

  // Main response text
  blocks.push(section(aiResult.response));

  // If there's data, format it based on action type
  if (aiResult.data) {
    blocks.push(divider());

    switch (aiResult.action) {
      case "search":
        if (aiResult.data.records?.length > 0) {
          for (const record of aiResult.data.records.slice(0, 3)) {
            const recordType = record.attributes?.type || "Record";
            const recordUrl = instanceUrl
              ? `${instanceUrl}/lightning/r/${recordType}/${record.Id}/view`
              : undefined;

            blocks.push(
              section(
                `• *${record.Name || record.Subject}* (${recordType})`,
                recordUrl ? button("View", `view_${record.Id}`, record.Id, { url: recordUrl }) : undefined
              )
            );
          }
        }
        break;

      case "query":
        if (aiResult.data.opportunities?.length > 0) {
          // Pipeline data
          const opps = aiResult.data.opportunities.slice(0, 3);
          for (const opp of opps) {
            const amount = opp.amount ? `$${opp.amount.toLocaleString()}` : "N/A";
            blocks.push(section(`• *${opp.name}* - ${amount} (${opp.stage})`));
          }
        } else if (aiResult.data.tasks?.length > 0) {
          // Tasks data
          const tasks = aiResult.data.tasks.slice(0, 3);
          for (const task of tasks) {
            blocks.push(section(`• ${task.subject} (Due: ${task.dueDate || "No date"})`));
          }
        } else if (aiResult.data.leads?.length > 0) {
          // Leads data
          const leads = aiResult.data.leads.slice(0, 3);
          for (const lead of leads) {
            blocks.push(section(`• *${lead.name}* from ${lead.company || "Unknown"}`));
          }
        } else if (aiResult.data.records?.length > 0) {
          // Generic records
          for (const record of aiResult.data.records.slice(0, 3)) {
            blocks.push(section(`• *${record.Name || record.Subject || "Record"}*`));
          }
        }
        break;

      case "create":
        if (aiResult.recordUrl) {
          blocks.push(
            actions([
              button("View in Salesforce", "view_created", aiResult.data?.id, {
                url: aiResult.recordUrl,
                style: "primary",
              }),
            ])
          );
        }
        break;

      case "update":
        blocks.push(context(["Record updated successfully"]));
        break;
    }
  }

  // Add follow-up suggestion if present
  if (aiResult.followUp) {
    blocks.push(divider());
    blocks.push(context([`💡 ${aiResult.followUp}`]));
  }

  return blocks;
}
