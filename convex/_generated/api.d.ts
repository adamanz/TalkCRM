/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as agentSessions from "../agentSessions.js";
import type * as ai from "../ai.js";
import type * as analytics from "../analytics.js";
import type * as anam from "../anam.js";
import type * as auth from "../auth.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as dealCoach from "../dealCoach.js";
import type * as http from "../http.js";
import type * as orgCredentials from "../orgCredentials.js";
import type * as orgMetadata from "../orgMetadata.js";
import type * as recordings from "../recordings.js";
import type * as salesforce from "../salesforce.js";
import type * as sendblue from "../sendblue.js";
import type * as textMessages from "../textMessages.js";
import type * as twilio from "../twilio.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  agentSessions: typeof agentSessions;
  ai: typeof ai;
  analytics: typeof analytics;
  anam: typeof anam;
  auth: typeof auth;
  conversations: typeof conversations;
  crons: typeof crons;
  dealCoach: typeof dealCoach;
  http: typeof http;
  orgCredentials: typeof orgCredentials;
  orgMetadata: typeof orgMetadata;
  recordings: typeof recordings;
  salesforce: typeof salesforce;
  sendblue: typeof sendblue;
  textMessages: typeof textMessages;
  twilio: typeof twilio;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
