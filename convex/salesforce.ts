import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Check if a user has Salesforce connected
 */
export const getSalesforceStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await ctx.db
      .query("salesforceAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!auth) {
      return { connected: false };
    }

    return {
      connected: true,
      instanceUrl: auth.instanceUrl,
      expiresAt: auth.expiresAt,
      isExpired: auth.expiresAt < Date.now(),
    };
  },
});

// ============================================================================
// SALESFORCE API HELPERS
// ============================================================================

interface SalesforceAuth {
  accessToken: string;
  instanceUrl: string;
}

interface GetAuthOptions {
  userId?: string;           // Direct user ID
  conversationId?: string;   // Look up user from conversation
}

interface OrgCredentials {
  consumerKey: string;
  consumerSecret: string;
}

async function getSalesforceAuth(ctx: any, options?: GetAuthOptions): Promise<SalesforceAuth> {
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

  // Resolve userId from options
  let userId = options?.userId;

  // If conversationId provided, look up the userId from the conversation
  if (!userId && options?.conversationId) {
    userId = await ctx.runQuery(internal.salesforce.getUserIdFromConversation, {
      conversationId: options.conversationId,
    });
  }

  // If we have a userId, get their specific auth
  if (userId) {
    const userAuth = await ctx.runQuery(internal.salesforce.getAuthForUser, {
      userId,
    });

    if (userAuth) {
      // Check if token is expired or expiring soon (5 min buffer) and refresh if needed
      const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
      if (userAuth.expiresAt < Date.now() + REFRESH_BUFFER_MS) {
        try {
          // Look up per-org credentials for this instance
          let orgCreds: OrgCredentials | undefined;
          if (userAuth.instanceUrl) {
            const normalizedUrl = userAuth.instanceUrl.replace(/\/$/, "").replace(".lightning.force.com", ".my.salesforce.com");
            const orgCredRecord = await ctx.runQuery(internal.orgCredentials.getByInstance, {
              instanceUrl: normalizedUrl,
            });
            if (orgCredRecord) {
              orgCreds = {
                consumerKey: orgCredRecord.consumerKey,
                consumerSecret: orgCredRecord.consumerSecret,
              };
              console.log(`Found org credentials for ${normalizedUrl}`);
            } else {
              console.log(`No org credentials found for ${normalizedUrl}, falling back to env vars`);
            }
          }

          const refreshed = await refreshSalesforceToken(userAuth.refreshToken, userAuth.instanceUrl, orgCreds);
          await ctx.runMutation(internal.salesforce.updateAuthForUser, {
            userId,
            ...refreshed,
          });
          console.log(`Refreshed Salesforce token for user ${userId}`);
          return { accessToken: refreshed.accessToken, instanceUrl: refreshed.instanceUrl };
        } catch (refreshError: any) {
          // If refresh fails, clear the bad auth so user is prompted to re-connect
          console.error(`Token refresh failed for user ${userId}:`, refreshError.message);
          if (refreshError.message.includes("app_not_found") ||
              refreshError.message.includes("invalid_grant") ||
              refreshError.message.includes("expired") ||
              refreshError.message.includes("No OAuth credentials")) {
            await ctx.runMutation(internal.salesforce.clearAuthForUser, { userId });
            throw new Error("Salesforce session expired. Please reconnect your Salesforce account.");
          }
          throw refreshError;
        }
      }
      return { accessToken: userAuth.accessToken, instanceUrl: userAuth.instanceUrl };
    }
  }

  // Fall back to stored auth (legacy/demo mode)
  const auth = await ctx.runQuery(internal.salesforce.getStoredAuth);
  if (!auth) {
    throw new Error("Salesforce not connected. Please set SALESFORCE_ACCESS_TOKEN and SALESFORCE_INSTANCE_URL, or configure OAuth credentials.");
  }

  // Check if token is expired or expiring soon (5 min buffer) and refresh if needed
  const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
  if (auth.expiresAt < Date.now() + REFRESH_BUFFER_MS) {
    try {
      // Look up per-org credentials for this instance (legacy auth may also be per-org)
      let orgCreds: OrgCredentials | undefined;
      if (auth.instanceUrl) {
        const normalizedUrl = auth.instanceUrl.replace(/\/$/, "").replace(".lightning.force.com", ".my.salesforce.com");
        const orgCredRecord = await ctx.runQuery(internal.orgCredentials.getByInstance, {
          instanceUrl: normalizedUrl,
        });
        if (orgCredRecord) {
          orgCreds = {
            consumerKey: orgCredRecord.consumerKey,
            consumerSecret: orgCredRecord.consumerSecret,
          };
          console.log(`Found org credentials for legacy auth: ${normalizedUrl}`);
        }
      }

      const refreshed = await refreshSalesforceToken(auth.refreshToken, auth.instanceUrl, orgCreds);
      await ctx.runMutation(internal.salesforce.updateAuth, refreshed);
      console.log("Refreshed Salesforce token (legacy auth)");
      return { accessToken: refreshed.accessToken, instanceUrl: refreshed.instanceUrl };
    } catch (refreshError: any) {
      console.error("Token refresh failed (legacy auth):", refreshError.message);
      throw new Error("Salesforce session expired. Please reconnect your Salesforce account.");
    }
  }

  return { accessToken: auth.accessToken, instanceUrl: auth.instanceUrl };
}

async function refreshSalesforceToken(
  refreshToken: string,
  instanceUrl?: string,
  orgCredentials?: OrgCredentials
) {
  // Use per-org credentials if provided, otherwise fall back to env vars
  const clientId = orgCredentials?.consumerKey || process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = orgCredentials?.consumerSecret || process.env.SALESFORCE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      `No OAuth credentials available for token refresh. ` +
      `Instance: ${instanceUrl || 'unknown'}. ` +
      `Please ensure org credentials are configured.`
    );
  }

  // Use the instance's token endpoint if available, otherwise default
  const tokenUrl = instanceUrl
    ? `${instanceUrl}/services/oauth2/token`
    : "https://login.salesforce.com/services/oauth2/token";

  console.log(`Refreshing Salesforce token for ${instanceUrl || 'default'} using ${orgCredentials ? 'org credentials' : 'env vars'}`);

  const response = await fetch(tokenUrl, {
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
    const errorText = await response.text();
    console.error(`Token refresh failed: ${response.status} - ${errorText}`);
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const data = await response.json();
  console.log(`Token refresh successful for ${instanceUrl || 'default'}`);

  return {
    accessToken: data.access_token,
    instanceUrl: data.instance_url || instanceUrl,
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

/**
 * Get Salesforce auth for a specific user (multi-tenant)
 */
export const getAuthForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("salesforceAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * Get userId from a conversation (for tool calls that pass conversation_id)
 */
export const getUserIdFromConversation = internalQuery({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) => q.eq("conversationId", args.conversationId))
      .first();
    return conversation?.userId ?? null;
  },
});

export const updateAuth = internalMutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    instanceUrl: v.string(),
    expiresAt: v.number(),
    userId: v.optional(v.id("users")), // Optional for legacy/demo mode
    salesforceUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // For demo mode without users, use a placeholder userId
    // In production, require userId
    const existing = await ctx.db.query("salesforceAuth").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        instanceUrl: args.instanceUrl,
        expiresAt: args.expiresAt,
        salesforceUserId: args.salesforceUserId,
      });
    } else {
      // For new records, we need a userId - use a placeholder if not provided
      // This maintains backward compatibility with the hackathon demo
      if (!args.userId) {
        throw new Error("userId is required for new Salesforce auth records");
      }
      await ctx.db.insert("salesforceAuth", {
        userId: args.userId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        instanceUrl: args.instanceUrl,
        expiresAt: args.expiresAt,
        salesforceUserId: args.salesforceUserId,
      });
    }
  },
});

/**
 * Update Salesforce auth for a specific user (multi-tenant package flow)
 */
export const updateAuthForUser = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.string(),
    instanceUrl: v.string(),
    expiresAt: v.number(),
    salesforceUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find existing auth for this user
    const existing = await ctx.db
      .query("salesforceAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing auth
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        instanceUrl: args.instanceUrl,
        expiresAt: args.expiresAt,
        salesforceUserId: args.salesforceUserId,
      });
    } else {
      // Create new auth for this user
      await ctx.db.insert("salesforceAuth", {
        userId: args.userId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        instanceUrl: args.instanceUrl,
        expiresAt: args.expiresAt,
        salesforceUserId: args.salesforceUserId,
      });
    }
  },
});

/**
 * Clear Salesforce auth for a user (when refresh fails or token is revoked)
 */
export const clearAuthForUser = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("salesforceAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      console.log(`Cleared Salesforce auth for user ${args.userId}`);
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
    conversationId: v.optional(v.string()), // For user context
    userId: v.optional(v.string()), // Direct user ID for auth lookup
  },
  handler: async (ctx, args) => {
    // #region agent log (debug-session)
    fetch('http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B',location:'convex/salesforce.ts:searchRecords:entry',message:'searchRecords entry',data:{hasUserId:!!args.userId,hasConversationId:!!args.conversationId,queryLen:args.query?.length ?? null,queryLooksSelect:(args.query||'').toUpperCase().startsWith('SELECT'),queryHasCURRENT_USER:(args.query||'').includes('CURRENT_USER'),queryHasCurlyUserId:(/\{userId\}/.test(args.query||''))},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log

    const auth = await getSalesforceAuth(ctx, { conversationId: args.conversationId, userId: args.userId });

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

    // Replace user ID placeholders with actual Salesforce user ID
    // Supports: CURRENT_USER, {userId}, {currentUser}, {me}, :userId
    const userPlaceholderPattern = /['"]?CURRENT_USER['"]?|\{userId\}|\{currentUser\}|\{me\}|:userId/gi;
    const hadUserPlaceholder = userPlaceholderPattern.test(soql);

    if (hadUserPlaceholder) {
      const userInfo = await salesforceRequest(auth, "/chatter/users/me");
      // Reset regex lastIndex after test()
      soql = soql.replace(/['"]?CURRENT_USER['"]?|\{userId\}|\{currentUser\}|\{me\}|:userId/gi, `'${userInfo.id}'`);
      console.log(`Replaced user placeholder with Salesforce user ID: ${userInfo.id}`);
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
    conversationId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx, { conversationId: args.conversationId, userId: args.userId });

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
    conversationId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx, { conversationId: args.conversationId, userId: args.userId });

    const result = await salesforceRequest(auth, `/sobjects/${args.objectType}`, {
      method: "POST",
      body: JSON.stringify(args.fields),
    });

    // Build the record URL for Lightning Experience
    const recordUrl = `${auth.instanceUrl}/lightning/r/${args.objectType}/${result.id}/view`;

    return {
      success: true,
      id: result.id,
      recordUrl,
      instanceUrl: auth.instanceUrl,
      objectType: args.objectType,
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
    conversationId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx, { conversationId: args.conversationId, userId: args.userId });

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
    conversationId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx, { conversationId: args.conversationId, userId: args.userId });

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
    conversationId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx, { conversationId: args.conversationId, userId: args.userId });

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
    conversationId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx, { conversationId: args.conversationId, userId: args.userId });

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
    conversationId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx, { conversationId: args.conversationId, userId: args.userId });

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
 * Get current user's accounts
 * Example: "Show me my accounts"
 */
export const getMyAccounts = action({
  args: {
    industry: v.optional(v.string()),
    limit: v.optional(v.number()),
    conversationId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx, { conversationId: args.conversationId, userId: args.userId });

    // Get current Salesforce user
    const userInfo = await salesforceRequest(auth, "/chatter/users/me");

    let whereClause = `OwnerId = '${userInfo.id}'`;
    if (args.industry) {
      whereClause += ` AND Industry = '${args.industry}'`;
    }

    const soql = `SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, Website, Phone, BillingCity, BillingState
                  FROM Account
                  WHERE ${whereClause}
                  ORDER BY Name ASC
                  LIMIT ${args.limit || 25}`;

    const result = await salesforceRequest(auth, `/query/?q=${encodeURIComponent(soql)}`);

    return {
      accounts: result.records.map((a: any) => ({
        id: a.Id,
        name: a.Name,
        industry: a.Industry,
        annualRevenue: a.AnnualRevenue,
        employees: a.NumberOfEmployees,
        website: a.Website,
        phone: a.Phone,
        location: a.BillingCity && a.BillingState ? `${a.BillingCity}, ${a.BillingState}` : null,
      })),
      count: result.totalSize,
      userId: userInfo.id,
      userName: userInfo.name,
    };
  },
});

/**
 * Get current user's leads
 * Example: "Show me my leads"
 */
export const getMyLeads = action({
  args: {
    status: v.optional(v.string()), // Open, Working, Converted, etc.
    limit: v.optional(v.number()),
    conversationId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx, { conversationId: args.conversationId, userId: args.userId });

    // Get current Salesforce user
    const userInfo = await salesforceRequest(auth, "/chatter/users/me");

    let whereClause = `OwnerId = '${userInfo.id}'`;
    if (args.status === "open") {
      whereClause += " AND IsConverted = false";
    } else if (args.status === "converted") {
      whereClause += " AND IsConverted = true";
    }

    const soql = `SELECT Id, Name, FirstName, LastName, Company, Email, Phone, Status, LeadSource, CreatedDate
                  FROM Lead
                  WHERE ${whereClause}
                  ORDER BY CreatedDate DESC
                  LIMIT ${args.limit || 25}`;

    const result = await salesforceRequest(auth, `/query/?q=${encodeURIComponent(soql)}`);

    return {
      leads: result.records.map((l: any) => ({
        id: l.Id,
        name: l.Name,
        company: l.Company,
        email: l.Email,
        phone: l.Phone,
        status: l.Status,
        source: l.LeadSource,
        createdDate: l.CreatedDate,
      })),
      count: result.totalSize,
      summary: `You have ${result.totalSize} lead${result.totalSize !== 1 ? 's' : ''}`,
    };
  },
});

/**
 * Describe an object's fields (for dynamic queries)
 */
export const describeObject = action({
  args: {
    objectType: v.string(),
    conversationId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getSalesforceAuth(ctx, { conversationId: args.conversationId, userId: args.userId });
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
