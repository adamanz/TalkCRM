import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================================================
// SALESFORCE API HELPERS
// ============================================================================

interface SalesforceAuth {
  accessToken: string;
  instanceUrl: string;
}

async function getSalesforceAuth(ctx: any): Promise<SalesforceAuth> {
  // First check for direct token in environment (for demo/testing)
  const envToken = process.env.SALESFORCE_ACCESS_TOKEN;
  const envInstanceUrl = process.env.SALESFORCE_INSTANCE_URL;

  if (envToken && envInstanceUrl) {
    return { accessToken: envToken, instanceUrl: envInstanceUrl };
  }

  // Try username-password flow if credentials are set
  const username = process.env.SALESFORCE_USERNAME;
  const password = process.env.SALESFORCE_PASSWORD;
  const securityToken = process.env.SALESFORCE_SECURITY_TOKEN;
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

  if (username && password && clientId && clientSecret) {
    const loginUrl = process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com";
    const passwordWithToken = password + (securityToken || "");

    const response = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: clientId,
        client_secret: clientSecret,
        username: username,
        password: passwordWithToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce auth failed: ${error}`);
    }

    const data = await response.json();
    return { accessToken: data.access_token, instanceUrl: data.instance_url };
  }

  // Fall back to stored auth
  const auth = await ctx.runQuery(internal.salesforce.getStoredAuth);
  if (!auth) {
    throw new Error("Salesforce not connected. Please set SALESFORCE_ACCESS_TOKEN and SALESFORCE_INSTANCE_URL, or configure OAuth credentials.");
  }

  // Check if token is expired and refresh if needed
  if (auth.expiresAt < Date.now()) {
    const refreshed = await refreshSalesforceToken(auth.refreshToken);
    await ctx.runMutation(internal.salesforce.updateAuth, refreshed);
    return { accessToken: refreshed.accessToken, instanceUrl: refreshed.instanceUrl };
  }

  return { accessToken: auth.accessToken, instanceUrl: auth.instanceUrl };
}

async function refreshSalesforceToken(refreshToken: string) {
  const clientId = process.env.SALESFORCE_CLIENT_ID!;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET!;

  const response = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${await response.text()}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + 7200 * 1000, // 2 hours
  };
}

async function salesforceRequest(
  auth: SalesforceAuth,
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${auth.instanceUrl}/services/data/v59.0${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Salesforce API error: ${response.status} - ${error}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

// ============================================================================
// INTERNAL QUERIES/MUTATIONS FOR AUTH
// ============================================================================

export const getStoredAuth = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("salesforceAuth").first();
  },
});

export const updateAuth = internalMutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    instanceUrl: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("salesforceAuth").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("salesforceAuth", args);
    }
  },
});

// ============================================================================
// SALESFORCE ACTIONS (Called by ElevenLabs Server Tools)
// ============================================================================

/**
 * Search for records using SOQL
 * Example: "Find all open opportunities over $50,000"
 */
export const searchRecords = action({
  args: {
    query: v.string(), // Natural language query OR raw SOQL
    objectType: v.optional(v.string()), // Account, Contact, Opportunity, etc.
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx);

    // If it looks like SOQL, use it directly, otherwise build a query
    let soql = args.query;
    if (!soql.toUpperCase().startsWith("SELECT")) {
      // Build a basic search query
      const obj = args.objectType || "Account";
      const searchTerm = args.query;
      const limit = args.limit || 10;

      // Use SOSL for text search
      const soslQuery = `FIND {${searchTerm}} IN ALL FIELDS RETURNING ${obj}(Id, Name LIMIT ${limit})`;
      const searchResult = await salesforceRequest(
        auth,
        `/search/?q=${encodeURIComponent(soslQuery)}`
      );

      return {
        records: searchResult.searchRecords || [],
        totalSize: searchResult.searchRecords?.length || 0,
      };
    }

    // Execute raw SOQL
    const result = await salesforceRequest(auth, `/query/?q=${encodeURIComponent(soql)}`);
    return {
      records: result.records,
      totalSize: result.totalSize,
    };
  },
});

/**
 * Get a single record by ID
 * Example: "Tell me about the Acme account"
 */
export const getRecord = action({
  args: {
    recordId: v.string(),
    objectType: v.string(),
    fields: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx);

    let endpoint = `/sobjects/${args.objectType}/${args.recordId}`;
    if (args.fields && args.fields.length > 0) {
      endpoint += `?fields=${args.fields.join(",")}`;
    }

    return await salesforceRequest(auth, endpoint);
  },
});

/**
 * Create a new record
 * Example: "Create a task to follow up with John tomorrow"
 */
export const createRecord = action({
  args: {
    objectType: v.string(),
    fields: v.any(), // Record fields as object
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx);

    const result = await salesforceRequest(auth, `/sobjects/${args.objectType}`, {
      method: "POST",
      body: JSON.stringify(args.fields),
    });

    return {
      success: true,
      id: result.id,
      message: `Created new ${args.objectType} with ID ${result.id}`,
    };
  },
});

/**
 * Update an existing record
 * Example: "Update the Acme opportunity to Closed Won"
 */
export const updateRecord = action({
  args: {
    recordId: v.string(),
    objectType: v.string(),
    fields: v.any(), // Fields to update
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx);

    await salesforceRequest(auth, `/sobjects/${args.objectType}/${args.recordId}`, {
      method: "PATCH",
      body: JSON.stringify(args.fields),
    });

    return {
      success: true,
      message: `Updated ${args.objectType} ${args.recordId}`,
    };
  },
});

/**
 * Delete a record
 * Example: "Delete that duplicate contact"
 */
export const deleteRecord = action({
  args: {
    recordId: v.string(),
    objectType: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx);

    await salesforceRequest(auth, `/sobjects/${args.objectType}/${args.recordId}`, {
      method: "DELETE",
    });

    return {
      success: true,
      message: `Deleted ${args.objectType} ${args.recordId}`,
    };
  },
});

/**
 * Log a call activity
 * Example: "Log this call on the Johnson contact"
 */
export const logCall = action({
  args: {
    whoId: v.optional(v.string()), // Contact or Lead ID
    whatId: v.optional(v.string()), // Account, Opportunity, etc.
    subject: v.string(),
    description: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx);

    const task = {
      Subject: args.subject,
      Description: args.description || "",
      WhoId: args.whoId,
      WhatId: args.whatId,
      Status: "Completed",
      Priority: "Normal",
      TaskSubtype: "Call",
      CallDurationInSeconds: (args.durationMinutes || 5) * 60,
      ActivityDate: new Date().toISOString().split("T")[0],
    };

    const result = await salesforceRequest(auth, "/sobjects/Task", {
      method: "POST",
      body: JSON.stringify(task),
    });

    return {
      success: true,
      taskId: result.id,
      message: `Logged call activity with ID ${result.id}`,
    };
  },
});

/**
 * Get current user's tasks
 * Example: "What tasks do I have today?"
 */
export const getMyTasks = action({
  args: {
    status: v.optional(v.string()), // Open, Completed, etc.
    dueDate: v.optional(v.string()), // TODAY, THIS_WEEK, etc.
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx);

    let whereClause = "OwnerId = :userId";
    if (args.status === "open") {
      whereClause += " AND IsClosed = false";
    } else if (args.status === "completed") {
      whereClause += " AND IsClosed = true";
    }

    if (args.dueDate === "today") {
      whereClause += " AND ActivityDate = TODAY";
    } else if (args.dueDate === "this_week") {
      whereClause += " AND ActivityDate = THIS_WEEK";
    } else if (args.dueDate === "overdue") {
      whereClause += " AND ActivityDate < TODAY AND IsClosed = false";
    }

    // First get current user ID
    const userInfo = await salesforceRequest(auth, "/chatter/users/me");

    const soql = `SELECT Id, Subject, Status, Priority, ActivityDate, Who.Name, What.Name
                  FROM Task
                  WHERE OwnerId = '${userInfo.id}' ${args.status === "open" ? "AND IsClosed = false" : ""} ${args.dueDate === "today" ? "AND ActivityDate = TODAY" : ""}
                  ORDER BY ActivityDate ASC
                  LIMIT 20`;

    const result = await salesforceRequest(auth, `/query/?q=${encodeURIComponent(soql)}`);

    return {
      tasks: result.records.map((t: any) => ({
        id: t.Id,
        subject: t.Subject,
        status: t.Status,
        priority: t.Priority,
        dueDate: t.ActivityDate,
        relatedTo: t.What?.Name || t.Who?.Name || "None",
      })),
      count: result.totalSize,
    };
  },
});

/**
 * Get current user's opportunities/pipeline
 * Example: "What's in my pipeline this quarter?"
 */
export const getMyOpportunities = action({
  args: {
    stage: v.optional(v.string()), // Open, Closed Won, etc.
    closeDate: v.optional(v.string()), // THIS_QUARTER, THIS_MONTH, etc.
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx);

    // Get current user
    const userInfo = await salesforceRequest(auth, "/chatter/users/me");

    let whereClause = `OwnerId = '${userInfo.id}'`;
    if (args.stage === "open") {
      whereClause += " AND IsClosed = false";
    } else if (args.stage === "won") {
      whereClause += " AND IsWon = true";
    } else if (args.stage === "lost") {
      whereClause += " AND IsClosed = true AND IsWon = false";
    }

    if (args.closeDate === "this_quarter") {
      whereClause += " AND CloseDate = THIS_QUARTER";
    } else if (args.closeDate === "this_month") {
      whereClause += " AND CloseDate = THIS_MONTH";
    } else if (args.closeDate === "next_quarter") {
      whereClause += " AND CloseDate = NEXT_QUARTER";
    }

    const soql = `SELECT Id, Name, Amount, StageName, CloseDate, Account.Name, Probability
                  FROM Opportunity
                  WHERE ${whereClause}
                  ORDER BY CloseDate ASC
                  LIMIT 25`;

    const result = await salesforceRequest(auth, `/query/?q=${encodeURIComponent(soql)}`);

    const totalAmount = result.records.reduce((sum: number, o: any) => sum + (o.Amount || 0), 0);

    return {
      opportunities: result.records.map((o: any) => ({
        id: o.Id,
        name: o.Name,
        amount: o.Amount,
        stage: o.StageName,
        closeDate: o.CloseDate,
        accountName: o.Account?.Name,
        probability: o.Probability,
      })),
      count: result.totalSize,
      totalAmount,
      summary: `You have ${result.totalSize} opportunities totaling $${totalAmount.toLocaleString()}`,
    };
  },
});

/**
 * Describe an object's fields (for dynamic queries)
 */
export const describeObject = action({
  args: {
    objectType: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx);
    const result = await salesforceRequest(auth, `/sobjects/${args.objectType}/describe`);

    return {
      name: result.name,
      label: result.label,
      fields: result.fields.slice(0, 50).map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: !f.nillable && f.createable,
      })),
    };
  },
});
