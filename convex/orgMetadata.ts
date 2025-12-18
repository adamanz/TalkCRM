import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Standard Salesforce objects that are commonly used (always include these)
const IMPORTANT_STANDARD_OBJECTS = [
  "Account",
  "Contact",
  "Opportunity",
  "Lead",
  "Case",
  "Task",
  "Event",
  "Campaign",
  "User",
  "Product2",
  "Pricebook2",
  "PricebookEntry",
  "Quote",
  "Order",
  "Contract",
  "Asset",
  "Note",
  "Attachment",
];

/**
 * Get org metadata by instance URL
 */
export const getByInstance = internalQuery({
  args: { instanceUrl: v.string() },
  handler: async (ctx, args) => {
    // Normalize the URL
    let normalizedUrl = args.instanceUrl.replace(/\/$/, "");
    normalizedUrl = normalizedUrl.replace(".lightning.force.com", ".my.salesforce.com");

    // Try exact match first
    let metadata = await ctx.db
      .query("orgMetadata")
      .withIndex("by_instance", (q) => q.eq("instanceUrl", normalizedUrl))
      .first();

    if (metadata) return metadata;

    // Try with lightning.force.com -> my.salesforce.com conversion
    const altUrl = args.instanceUrl.replace(".lightning.force.com", ".my.salesforce.com");
    if (altUrl !== normalizedUrl) {
      metadata = await ctx.db
        .query("orgMetadata")
        .withIndex("by_instance", (q) => q.eq("instanceUrl", altUrl))
        .first();
    }

    return metadata;
  },
});

/**
 * Public query to get available objects for a user's org
 */
export const getAvailableObjects = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get user's Salesforce auth to find their instance URL
    const auth = await ctx.db
      .query("salesforceAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!auth) {
      return { standardObjects: [], customObjects: [], error: "No Salesforce connection" };
    }

    // Normalize instance URL
    let instanceUrl = auth.instanceUrl.replace(/\/$/, "");
    instanceUrl = instanceUrl.replace(".lightning.force.com", ".my.salesforce.com");

    // Get org metadata
    const metadata = await ctx.db
      .query("orgMetadata")
      .withIndex("by_instance", (q) => q.eq("instanceUrl", instanceUrl))
      .first();

    if (!metadata) {
      return {
        standardObjects: IMPORTANT_STANDARD_OBJECTS.map((name) => ({
          name,
          label: name,
          queryable: true,
        })),
        customObjects: [],
        needsSync: true,
      };
    }

    return {
      standardObjects: metadata.standardObjects,
      customObjects: metadata.customObjects,
      lastSyncedAt: metadata.lastSyncedAt,
      syncStatus: metadata.syncStatus,
    };
  },
});

/**
 * Create or update org metadata
 */
export const upsert = internalMutation({
  args: {
    instanceUrl: v.string(),
    standardObjects: v.array(
      v.object({
        name: v.string(),
        label: v.string(),
        queryable: v.boolean(),
      })
    ),
    customObjects: v.array(
      v.object({
        name: v.string(),
        label: v.string(),
        queryable: v.boolean(),
        description: v.optional(v.string()),
        keyFields: v.optional(v.array(
          v.union(
            v.string(),
            v.object({
              name: v.string(),
              label: v.string(),
              type: v.string(),
              helpText: v.optional(v.string()),
              picklistValues: v.optional(v.array(v.string())),
              referenceTo: v.optional(v.string()),
              relationshipName: v.optional(v.string()),
            })
          )
        )),
        sampleFields: v.optional(v.array(v.string())),
        recordCount: v.optional(v.number()),
      })
    ),
    syncStatus: v.union(
      v.literal("pending"),
      v.literal("syncing"),
      v.literal("complete"),
      v.literal("error")
    ),
    syncError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Normalize the URL
    let normalizedUrl = args.instanceUrl.replace(/\/$/, "");
    normalizedUrl = normalizedUrl.replace(".lightning.force.com", ".my.salesforce.com");

    // Check if metadata exists
    const existing = await ctx.db
      .query("orgMetadata")
      .withIndex("by_instance", (q) => q.eq("instanceUrl", normalizedUrl))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        standardObjects: args.standardObjects,
        customObjects: args.customObjects,
        lastSyncedAt: Date.now(),
        syncStatus: args.syncStatus,
        syncError: args.syncError,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("orgMetadata", {
        instanceUrl: normalizedUrl,
        standardObjects: args.standardObjects,
        customObjects: args.customObjects,
        lastSyncedAt: Date.now(),
        syncStatus: args.syncStatus,
        syncError: args.syncError,
      });
    }
  },
});

/**
 * Mark sync as started
 */
export const markSyncStarted = internalMutation({
  args: { instanceUrl: v.string() },
  handler: async (ctx, args) => {
    let normalizedUrl = args.instanceUrl.replace(/\/$/, "");
    normalizedUrl = normalizedUrl.replace(".lightning.force.com", ".my.salesforce.com");

    const existing = await ctx.db
      .query("orgMetadata")
      .withIndex("by_instance", (q) => q.eq("instanceUrl", normalizedUrl))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        syncStatus: "syncing" as const,
      });
    } else {
      // Create a placeholder record
      await ctx.db.insert("orgMetadata", {
        instanceUrl: normalizedUrl,
        standardObjects: [],
        customObjects: [],
        lastSyncedAt: Date.now(),
        syncStatus: "syncing" as const,
      });
    }
  },
});

/**
 * Sync org metadata from Salesforce
 * Fetches all available objects and stores them for AI context
 */
export const syncFromSalesforce = internalAction({
  args: {
    accessToken: v.string(),
    instanceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`Syncing org metadata from ${args.instanceUrl}`);

    // Mark sync as started
    await ctx.runMutation(internal.orgMetadata.markSyncStarted, {
      instanceUrl: args.instanceUrl,
    });

    try {
      // Get API version
      const versionsResponse = await fetch(`${args.instanceUrl}/services/data/`, {
        headers: { Authorization: `Bearer ${args.accessToken}` },
      });

      if (!versionsResponse.ok) {
        throw new Error(`Failed to get API versions: ${versionsResponse.status}`);
      }

      const versions = await versionsResponse.json();
      const latestVersion = versions[versions.length - 1].version;
      console.log(`Using Salesforce API v${latestVersion}`);

      // Get all sObjects (Describe Global)
      const describeResponse = await fetch(
        `${args.instanceUrl}/services/data/v${latestVersion}/sobjects/`,
        {
          headers: { Authorization: `Bearer ${args.accessToken}` },
        }
      );

      if (!describeResponse.ok) {
        throw new Error(`Failed to describe objects: ${describeResponse.status}`);
      }

      const describeData = await describeResponse.json();
      const allObjects = describeData.sobjects || [];

      console.log(`Found ${allObjects.length} total objects in org`);

      // Separate standard and custom objects
      const standardObjects: Array<{ name: string; label: string; queryable: boolean }> = [];
      const customObjectsBasic: Array<{ name: string; label: string; queryable: boolean }> = [];

      for (const obj of allObjects) {
        // Skip non-queryable objects
        if (!obj.queryable) continue;

        // Skip internal/system objects
        if (obj.name.endsWith("__Share") || obj.name.endsWith("__History")) continue;
        if (obj.name.endsWith("__Feed") || obj.name.endsWith("__ChangeEvent")) continue;
        if (obj.name.endsWith("__mdt")) continue; // Skip custom metadata types

        if (obj.custom) {
          customObjectsBasic.push({
            name: obj.name,
            label: obj.label,
            queryable: obj.queryable,
          });
        } else if (IMPORTANT_STANDARD_OBJECTS.includes(obj.name)) {
          standardObjects.push({
            name: obj.name,
            label: obj.label,
            queryable: obj.queryable,
          });
        }
      }

      console.log(
        `Parsed ${standardObjects.length} standard objects and ${customObjectsBasic.length} custom objects`
      );

      // Rich custom object type with full field metadata
      type RichCustomObject = {
        name: string;
        label: string;
        queryable: boolean;
        description?: string;
        keyFields?: Array<{
          name: string;
          label: string;
          type: string;
          helpText?: string;
          picklistValues?: string[];
          referenceTo?: string;
        }>;
        sampleFields?: string[];
        recordCount?: number;
      };

      // Prioritize custom objects that are likely important (Message, Invoice, etc.)
      // Sort by priority: objects with key business words first, then alphabetically
      const priorityKeywords = ["Message", "Invoice", "Payment", "Order", "Quote", "Estimate", "Conversation", "Text", "Log"];
      const prioritizedObjects = [...customObjectsBasic].sort((a, b) => {
        const aHasPriority = priorityKeywords.some(kw => a.name.includes(kw) || a.label.includes(kw));
        const bHasPriority = priorityKeywords.some(kw => b.name.includes(kw) || b.label.includes(kw));
        if (aHasPriority && !bHasPriority) return -1;
        if (!aHasPriority && bHasPriority) return 1;
        return a.name.localeCompare(b.name);
      });

      // For custom objects, fetch rich field metadata for ALL objects
      const customObjectsWithFields: RichCustomObject[] = [];
      // No limit - describe ALL custom objects to ensure AI has complete field info
      const objectsToDescribe = prioritizedObjects;

      for (const obj of objectsToDescribe) {
        try {
          // Describe the object to get field metadata
          const objDescribeResponse = await fetch(
            `${args.instanceUrl}/services/data/v${latestVersion}/sobjects/${obj.name}/describe/`,
            { headers: { Authorization: `Bearer ${args.accessToken}` } }
          );

          if (!objDescribeResponse.ok) {
            customObjectsWithFields.push({ ...obj });
            continue;
          }

          const objData = await objDescribeResponse.json();

          // Capture ALL queryable fields - the AI needs complete field info to construct valid SOQL
          const usefulFields = (objData.fields || [])
            .filter((f: any) => {
              // Skip system/internal fields that are rarely useful
              const skipFields = ["IsDeleted", "SystemModstamp", "LastViewedDate", "LastReferencedDate", "LastActivityDate"];
              if (skipFields.includes(f.name)) return false;

              // Skip audit trail fields (CreatedById, LastModifiedById, etc.)
              if (f.name.endsWith("ById") && f.type === "reference") return false;

              // Skip compound address/geolocation subfields
              if (f.compound) return false;

              // Include standard fields
              if (f.name === "Id" || f.name === "Name" || f.name === "CreatedDate") return true;
              if (f.nameField) return true; // The main name field

              // Include ALL custom fields (__c) - these are what users care about
              if (f.name.endsWith("__c")) {
                return true; // Include all custom fields regardless of type
              }

              // Include common standard fields on custom objects
              const commonStandardFields = ["OwnerId", "RecordTypeId", "CurrencyIsoCode", "Description"];
              if (commonStandardFields.includes(f.name)) return true;

              return false;
            })
            // NO LIMIT - capture ALL fields so AI can construct valid queries
            .map((f: any) => ({
              name: f.name,
              label: f.label,
              type: f.type,
              helpText: f.inlineHelpText || undefined,
              picklistValues: f.type === "picklist"
                ? (f.picklistValues || []).filter((p: any) => p.active).map((p: any) => p.value).slice(0, 10)
                : undefined,
              referenceTo: f.type === "reference" && f.referenceTo?.length > 0
                ? f.referenceTo[0]
                : undefined,
              relationshipName: f.type === "reference" && f.relationshipName
                ? f.relationshipName
                : undefined,
            }));

          // Try to get a sample record to see which fields are populated
          let sampleFields: string[] = [];
          let recordCount: number | undefined;
          try {
            // Get count
            const countQuery = `SELECT COUNT() FROM ${obj.name}`;
            const countResponse = await fetch(
              `${args.instanceUrl}/services/data/v${latestVersion}/query/?q=${encodeURIComponent(countQuery)}`,
              { headers: { Authorization: `Bearer ${args.accessToken}` } }
            );
            if (countResponse.ok) {
              const countData = await countResponse.json();
              recordCount = countData.totalSize;
            }

            // Get a sample record if there are any
            if (recordCount && recordCount > 0) {
              const fieldNames = usefulFields.map((f: any) => f.name).join(", ");
              const sampleQuery = `SELECT ${fieldNames} FROM ${obj.name} ORDER BY CreatedDate DESC LIMIT 1`;
              const sampleResponse = await fetch(
                `${args.instanceUrl}/services/data/v${latestVersion}/query/?q=${encodeURIComponent(sampleQuery)}`,
                { headers: { Authorization: `Bearer ${args.accessToken}` } }
              );
              if (sampleResponse.ok) {
                const sampleData = await sampleResponse.json();
                if (sampleData.records && sampleData.records.length > 0) {
                  const record = sampleData.records[0];
                  // Find fields that have non-null values
                  sampleFields = Object.keys(record)
                    .filter(k => k !== "attributes" && record[k] !== null && record[k] !== "")
                    .slice(0, 8);
                }
              }
            }
          } catch (e) {
            console.log(`Could not get sample for ${obj.name}:`, e);
          }

          customObjectsWithFields.push({
            name: obj.name,
            label: obj.label,
            queryable: obj.queryable,
            description: objData.description || objData.labelPlural || undefined,
            keyFields: usefulFields,
            sampleFields: sampleFields.length > 0 ? sampleFields : undefined,
            recordCount,
          });

          console.log(`Described ${obj.name}: ${usefulFields.length} fields, ${recordCount || 0} records`);

        } catch (e) {
          console.error(`Error describing ${obj.name}:`, e);
          customObjectsWithFields.push({ ...obj });
        }
      }

      // All objects have been described - no need for fallback since we removed the limit

      // Store the metadata
      await ctx.runMutation(internal.orgMetadata.upsert, {
        instanceUrl: args.instanceUrl,
        standardObjects,
        customObjects: customObjectsWithFields,
        syncStatus: "complete",
      });

      console.log(`Successfully synced metadata for ${args.instanceUrl}`);

      return {
        success: true,
        standardObjectCount: standardObjects.length,
        customObjectCount: customObjectsWithFields.length,
        customObjects: customObjectsWithFields.map((o) => o.name),
      };
    } catch (error: any) {
      console.error(`Failed to sync org metadata: ${error.message}`);

      // Store error status
      await ctx.runMutation(internal.orgMetadata.upsert, {
        instanceUrl: args.instanceUrl,
        standardObjects: IMPORTANT_STANDARD_OBJECTS.map((name) => ({
          name,
          label: name,
          queryable: true,
        })),
        customObjects: [],
        syncStatus: "error",
        syncError: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Sync metadata for all connected Salesforce orgs
 * Called by weekly cron job to keep custom object info fresh
 */
export const syncAllOrgs = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting weekly org metadata sync...");

    // Get all unique Salesforce auths (one per org)
    const allAuths = await ctx.runQuery(internal.orgMetadata.getAllSalesforceAuths);

    // Track unique instance URLs to avoid syncing the same org twice
    const syncedOrgs = new Set<string>();
    const results: Array<{ instanceUrl: string; success: boolean; error?: string }> = [];

    for (const auth of allAuths) {
      // Normalize instance URL
      let instanceUrl = auth.instanceUrl.replace(/\/$/, "");
      instanceUrl = instanceUrl.replace(".lightning.force.com", ".my.salesforce.com");

      // Skip if already synced this org
      if (syncedOrgs.has(instanceUrl)) {
        continue;
      }
      syncedOrgs.add(instanceUrl);

      try {
        console.log(`Syncing metadata for ${instanceUrl}...`);
        const result = await ctx.runAction(internal.orgMetadata.syncFromSalesforce, {
          accessToken: auth.accessToken,
          instanceUrl: auth.instanceUrl,
        });

        results.push({
          instanceUrl,
          success: result.success,
          error: result.error,
        });
      } catch (error: any) {
        console.error(`Failed to sync ${instanceUrl}:`, error.message);
        results.push({
          instanceUrl,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(`Weekly sync complete. Synced ${results.length} orgs.`);
    return { syncedOrgs: results.length, results };
  },
});

/**
 * Get all Salesforce auth records (for cron sync)
 */
export const getAllSalesforceAuths = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("salesforceAuth").collect();
  },
});

/**
 * Clear all org metadata (for schema migrations)
 */
export const clearAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("orgMetadata").collect();
    for (const doc of all) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: all.length };
  },
});
