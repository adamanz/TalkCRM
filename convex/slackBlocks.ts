// ============================================================================
// SLACK BLOCK KIT BUILDERS
// Rich message formatting for Slack using Block Kit
// https://api.slack.com/block-kit
// ============================================================================

// Type definitions for Block Kit elements
export interface TextObject {
  type: "plain_text" | "mrkdwn";
  text: string;
  emoji?: boolean;
}

export interface ButtonElement {
  type: "button";
  text: TextObject;
  action_id: string;
  value?: string;
  url?: string;
  style?: "primary" | "danger";
}

export interface SelectOption {
  text: TextObject;
  value: string;
}

export interface StaticSelectElement {
  type: "static_select";
  placeholder?: TextObject;
  action_id: string;
  options: SelectOption[];
  initial_option?: SelectOption;
}

export interface Block {
  type: string;
  block_id?: string;
  [key: string]: any;
}

// ============================================================================
// BLOCK BUILDERS
// ============================================================================

/**
 * Create a section block with text
 */
export function section(text: string, accessory?: ButtonElement | StaticSelectElement): Block {
  const block: Block = {
    type: "section",
    text: {
      type: "mrkdwn",
      text,
    },
  };
  if (accessory) {
    block.accessory = accessory;
  }
  return block;
}

/**
 * Create a section with fields (multi-column layout)
 */
export function sectionWithFields(fields: string[]): Block {
  return {
    type: "section",
    fields: fields.map(text => ({
      type: "mrkdwn",
      text,
    })),
  };
}

/**
 * Create a divider block
 */
export function divider(): Block {
  return { type: "divider" };
}

/**
 * Create a header block
 */
export function header(text: string): Block {
  return {
    type: "header",
    text: {
      type: "plain_text",
      text,
      emoji: true,
    },
  };
}

/**
 * Create a context block (small muted text)
 */
export function context(elements: string[]): Block {
  return {
    type: "context",
    elements: elements.map(text => ({
      type: "mrkdwn",
      text,
    })),
  };
}

/**
 * Create an actions block with buttons
 */
export function actions(elements: (ButtonElement | StaticSelectElement)[], blockId?: string): Block {
  const block: Block = {
    type: "actions",
    elements,
  };
  if (blockId) {
    block.block_id = blockId;
  }
  return block;
}

/**
 * Create a button element
 */
export function button(
  text: string,
  actionId: string,
  value?: string,
  options?: { style?: "primary" | "danger"; url?: string }
): ButtonElement {
  const btn: ButtonElement = {
    type: "button",
    text: {
      type: "plain_text",
      text,
      emoji: true,
    },
    action_id: actionId,
  };
  if (value) btn.value = value;
  if (options?.style) btn.style = options.style;
  if (options?.url) btn.url = options.url;
  return btn;
}

/**
 * Create a static select element
 */
export function staticSelect(
  actionId: string,
  options: { text: string; value: string }[],
  placeholder?: string,
  initialValue?: string
): StaticSelectElement {
  const selectOptions = options.map(opt => ({
    text: { type: "plain_text" as const, text: opt.text },
    value: opt.value,
  }));

  const element: StaticSelectElement = {
    type: "static_select",
    action_id: actionId,
    options: selectOptions,
  };

  if (placeholder) {
    element.placeholder = { type: "plain_text", text: placeholder };
  }

  if (initialValue) {
    const initial = selectOptions.find(o => o.value === initialValue);
    if (initial) element.initial_option = initial;
  }

  return element;
}

// ============================================================================
// CRM-SPECIFIC MESSAGE BUILDERS
// ============================================================================

/**
 * Format currency for display
 */
function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "N/A";
  return "$" + amount.toLocaleString();
}

/**
 * Format date for display
 */
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Build search results message
 */
export function buildSearchResultsBlocks(
  query: string,
  results: any[],
  objectType?: string,
  instanceUrl?: string
): Block[] {
  const blocks: Block[] = [
    header(`🔍 Search Results for "${query}"`),
  ];

  if (!results || results.length === 0) {
    blocks.push(section(`No ${objectType || "records"} found matching your search.`));
    return blocks;
  }

  for (const record of results.slice(0, 5)) {
    const recordUrl = instanceUrl
      ? `${instanceUrl}/lightning/r/${record.attributes?.type || objectType}/${record.Id}/view`
      : null;

    // Build record display based on type
    const recordType = record.attributes?.type || objectType || "Record";
    let icon = "📄";
    let details: string[] = [];

    switch (recordType) {
      case "Account":
        icon = "🏢";
        details = [
          record.Industry ? `Industry: ${record.Industry}` : null,
          record.AnnualRevenue ? `Revenue: ${formatCurrency(record.AnnualRevenue)}` : null,
          record.BillingCity ? `Location: ${record.BillingCity}, ${record.BillingState || ""}` : null,
        ].filter(Boolean) as string[];
        break;

      case "Contact":
        icon = "👤";
        details = [
          record.Title ? `${record.Title}` : null,
          record.Email ? `📧 ${record.Email}` : null,
          record.Phone ? `📞 ${record.Phone}` : null,
        ].filter(Boolean) as string[];
        break;

      case "Lead":
        icon = "🎯";
        details = [
          record.Company ? `Company: ${record.Company}` : null,
          record.Status ? `Status: ${record.Status}` : null,
          record.Email ? `📧 ${record.Email}` : null,
        ].filter(Boolean) as string[];
        break;

      case "Opportunity":
        icon = "💰";
        details = [
          `Amount: ${formatCurrency(record.Amount)}`,
          `Stage: ${record.StageName || "Unknown"}`,
          record.CloseDate ? `Close: ${formatDate(record.CloseDate)}` : null,
        ].filter(Boolean) as string[];
        break;

      case "Task":
        icon = "✅";
        details = [
          record.Status ? `Status: ${record.Status}` : null,
          record.ActivityDate ? `Due: ${formatDate(record.ActivityDate)}` : null,
          record.Priority ? `Priority: ${record.Priority}` : null,
        ].filter(Boolean) as string[];
        break;

      default:
        // Generic record
        if (record.Status) details.push(`Status: ${record.Status}`);
        if (record.CreatedDate) details.push(`Created: ${formatDate(record.CreatedDate)}`);
    }

    // Add section for each record
    const recordText = `${icon} *${record.Name || record.Subject || "Unnamed"}*\n${recordType}${details.length > 0 ? " • " + details.join(" • ") : ""}`;

    blocks.push(
      section(
        recordText,
        recordUrl
          ? button("View", `view_record_${record.Id}`, record.Id, { url: recordUrl })
          : undefined
      )
    );
  }

  if (results.length > 5) {
    blocks.push(context([`Showing 5 of ${results.length} results`]));
  }

  // Add action buttons
  blocks.push(
    actions([
      button("Log Activity", "log_activity", query),
      button("New Search", "new_search", "", { style: "primary" }),
    ])
  );

  return blocks;
}

/**
 * Build pipeline/opportunities message
 */
export function buildPipelineBlocks(
  opportunities: any[],
  summary: { count: number; totalAmount: number; weightedAmount?: number },
  instanceUrl?: string
): Block[] {
  const blocks: Block[] = [
    header("📊 Your Pipeline"),
    sectionWithFields([
      `*Open Deals:* ${summary.count}`,
      `*Total Value:* ${formatCurrency(summary.totalAmount)}`,
    ]),
    divider(),
  ];

  if (!opportunities || opportunities.length === 0) {
    blocks.push(section("No open opportunities in your pipeline."));
    return blocks;
  }

  // Group by stage for summary
  const byStage = opportunities.reduce((acc: Record<string, any[]>, opp) => {
    const stage = opp.stage || opp.StageName || "Unknown";
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(opp);
    return acc;
  }, {});

  // Show top opportunities
  for (const opp of opportunities.slice(0, 5)) {
    const recordUrl = instanceUrl
      ? `${instanceUrl}/lightning/r/Opportunity/${opp.id || opp.Id}/view`
      : null;

    const oppText = `💰 *${opp.name || opp.Name}*\n${formatCurrency(opp.amount || opp.Amount)} • ${opp.stage || opp.StageName} • Close: ${formatDate(opp.closeDate || opp.CloseDate)}`;

    blocks.push(
      section(
        oppText,
        recordUrl
          ? button("View", `view_opp_${opp.id || opp.Id}`, opp.id || opp.Id, { url: recordUrl })
          : undefined
      )
    );
  }

  if (opportunities.length > 5) {
    blocks.push(context([`Showing 5 of ${opportunities.length} opportunities`]));
  }

  blocks.push(
    actions([
      button("View Full Pipeline", "view_pipeline", "", { style: "primary" }),
      button("Refresh", "refresh_pipeline"),
    ])
  );

  return blocks;
}

/**
 * Build tasks message
 */
export function buildTasksBlocks(tasks: any[], instanceUrl?: string): Block[] {
  const blocks: Block[] = [
    header("✅ Your Tasks"),
  ];

  if (!tasks || tasks.length === 0) {
    blocks.push(section("🎉 You're all caught up! No open tasks."));
    return blocks;
  }

  // Group by priority
  const highPriority = tasks.filter(t => t.priority === "High" || t.Priority === "High");
  const otherTasks = tasks.filter(t => t.priority !== "High" && t.Priority !== "High");

  if (highPriority.length > 0) {
    blocks.push(section(`*🔴 High Priority (${highPriority.length})*`));
    for (const task of highPriority.slice(0, 3)) {
      const dueDate = task.dueDate || task.ActivityDate;
      const isOverdue = dueDate && new Date(dueDate) < new Date();
      const dueDateText = dueDate ? formatDate(dueDate) : "No due date";
      const overdueEmoji = isOverdue ? "⚠️ " : "";

      blocks.push(
        section(`• ${task.subject || task.Subject}\n   ${overdueEmoji}Due: ${dueDateText}`)
      );
    }
  }

  if (otherTasks.length > 0 && blocks.length < 8) {
    blocks.push(divider());
    blocks.push(section(`*Other Tasks (${otherTasks.length})*`));
    for (const task of otherTasks.slice(0, 3)) {
      const dueDate = task.dueDate || task.ActivityDate;
      blocks.push(
        section(`• ${task.subject || task.Subject}\n   Due: ${dueDate ? formatDate(dueDate) : "No due date"}`)
      );
    }
  }

  blocks.push(
    actions([
      button("View All Tasks", "view_tasks", "", { style: "primary" }),
      button("Create Task", "create_task"),
    ])
  );

  return blocks;
}

/**
 * Build call summary notification
 */
export function buildCallSummaryBlocks(params: {
  summary: string;
  durationMinutes?: number;
  callerPhone?: string;
  recordsAccessed?: number;
  recordsModified?: number;
  sentiment?: string;
  successEvaluation?: {
    success: boolean;
    criteria?: Array<{ name: string; result: string }>;
  };
  salesforceRecordUrl?: string;
  conversationId?: string;
}): Block[] {
  const {
    summary,
    durationMinutes,
    callerPhone,
    recordsAccessed,
    recordsModified,
    sentiment,
    successEvaluation,
    salesforceRecordUrl,
    conversationId,
  } = params;

  // Build header with contact info
  const contactDisplay = callerPhone || "Unknown caller";
  const blocks: Block[] = [
    header(`📞 Call Completed`),
  ];

  // Build context line with metadata
  const contextItems: string[] = [];
  if (callerPhone) {
    contextItems.push(`📱 ${callerPhone}`);
  }
  if (durationMinutes !== undefined) {
    contextItems.push(`⏱️ ${durationMinutes} min`);
  }
  if (sentiment) {
    const sentimentEmoji = sentiment === "positive" ? "😊" : sentiment === "negative" ? "😞" : "😐";
    contextItems.push(`${sentimentEmoji} ${sentiment}`);
  }
  if (contextItems.length > 0) {
    blocks.push(context(contextItems));
  }

  blocks.push(divider());

  // Main summary
  blocks.push(section(`*Summary:*\n${summary}`));

  // Success evaluation if available
  if (successEvaluation) {
    const statusEmoji = successEvaluation.success ? "✅" : "⚠️";
    const statusText = successEvaluation.success ? "Successful" : "Needs Follow-up";
    blocks.push(
      section(`*Call Outcome:* ${statusEmoji} ${statusText}`)
    );

    if (successEvaluation.criteria && successEvaluation.criteria.length > 0) {
      const criteriaText = successEvaluation.criteria
        .slice(0, 3)
        .map((c) => `• ${c.name}: ${c.result}`)
        .join("\n");
      blocks.push(section(criteriaText));
    }
  }

  // Salesforce activity if any
  if ((recordsAccessed && recordsAccessed > 0) || (recordsModified && recordsModified > 0)) {
    blocks.push(divider());
    const sfFields: string[] = [];
    if (recordsAccessed && recordsAccessed > 0) {
      sfFields.push(`*Records Viewed:*\n${recordsAccessed}`);
    }
    if (recordsModified && recordsModified > 0) {
      sfFields.push(`*Records Updated:*\n${recordsModified}`);
    }
    blocks.push(sectionWithFields(sfFields));
  }

  // Action buttons
  const actionButtons: ButtonElement[] = [];
  actionButtons.push(button("📝 View Details", "view_call_details", conversationId || ""));

  if (salesforceRecordUrl) {
    actionButtons.push(button("🔗 View in Salesforce", "view_sf", conversationId, { url: salesforceRecordUrl }));
  }

  blocks.push(actions(actionButtons));

  return blocks;
}

/**
 * Build deal alert notification
 */
export function buildDealAlertBlocks(
  dealName: string,
  accountName: string,
  amount: number,
  stage: string,
  ownerName: string,
  changeType: "closed_won" | "closed_lost" | "stage_change",
  previousStage?: string,
  recordUrl?: string
): Block[] {
  let headerText: string;
  let headerEmoji: string;

  switch (changeType) {
    case "closed_won":
      headerEmoji = "🎉";
      headerText = "Deal Won!";
      break;
    case "closed_lost":
      headerEmoji = "😔";
      headerText = "Deal Lost";
      break;
    case "stage_change":
      headerEmoji = "📈";
      headerText = "Deal Stage Changed";
      break;
  }

  const blocks: Block[] = [
    header(`${headerEmoji} ${headerText}`),
    sectionWithFields([
      `*Deal:* ${dealName}`,
      `*Account:* ${accountName}`,
      `*Amount:* ${formatCurrency(amount)}`,
      `*Owner:* ${ownerName}`,
    ]),
  ];

  if (changeType === "stage_change" && previousStage) {
    blocks.push(section(`Stage: ${previousStage} → *${stage}*`));
  } else {
    blocks.push(section(`*Stage:* ${stage}`));
  }

  if (recordUrl) {
    blocks.push(
      actions([
        button("View Deal", "view_deal", "", { url: recordUrl, style: "primary" }),
      ])
    );
  }

  return blocks;
}

/**
 * Build help message
 */
export function buildHelpBlocks(): Block[] {
  return [
    header("🤖 TalkCRM Slack Commands"),
    divider(),
    section("*Available Commands:*"),
    section(
      "`/crm search <query>`\nSearch for contacts, accounts, or deals\n_Example: `/crm search Acme Corp`_"
    ),
    section(
      "`/crm pipeline`\nView your open opportunities\n_Example: `/crm pipeline`_"
    ),
    section(
      "`/crm tasks`\nView your pending tasks\n_Example: `/crm tasks`_"
    ),
    section(
      "`/crm log <record> <note>`\nLog a note to a Salesforce record\n_Example: `/crm log Acme Discussed pricing`_"
    ),
    divider(),
    section("*AI-Powered Queries:*\nMention @TalkCRM with any question about your CRM data.\n_Example: @TalkCRM What deals are closing this month?_"),
    context(["Powered by TalkCRM • Need help? Contact support@talkcrm.com"]),
  ];
}

/**
 * Build error message
 */
export function buildErrorBlocks(errorMessage: string, suggestion?: string): Block[] {
  const blocks: Block[] = [
    section(`❌ *Error*\n${errorMessage}`),
  ];

  if (suggestion) {
    blocks.push(context([suggestion]));
  }

  blocks.push(
    actions([
      button("Try Again", "retry_action"),
      button("Get Help", "show_help"),
    ])
  );

  return blocks;
}

/**
 * Build loading/thinking message
 */
export function buildThinkingBlocks(action?: string): Block[] {
  return [
    section(`⏳ ${action || "Working on it"}...`),
  ];
}
