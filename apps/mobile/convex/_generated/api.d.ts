/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as friends from "../friends.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as lib_codes from "../lib/codes.js";
import type * as lib_displayName from "../lib/displayName.js";
import type * as lib_goldEconomy from "../lib/goldEconomy.js";
import type * as lib_handSort from "../lib/handSort.js";
import type * as lib_onlineGame from "../lib/onlineGame.js";
import type * as lib_onlineRules from "../lib/onlineRules.js";
import type * as lib_requireAuth from "../lib/requireAuth.js";
import type * as lib_revealHelpers from "../lib/revealHelpers.js";
import type * as lib_roomHelpers from "../lib/roomHelpers.js";
import type * as lib_social from "../lib/social.js";
import type * as lib_views from "../lib/views.js";
import type * as profiles from "../profiles.js";
import type * as push from "../push.js";
import type * as rooms from "../rooms.js";
import type * as wallets from "../wallets.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  crons: typeof crons;
  friends: typeof friends;
  health: typeof health;
  http: typeof http;
  invites: typeof invites;
  "lib/codes": typeof lib_codes;
  "lib/displayName": typeof lib_displayName;
  "lib/goldEconomy": typeof lib_goldEconomy;
  "lib/handSort": typeof lib_handSort;
  "lib/onlineGame": typeof lib_onlineGame;
  "lib/onlineRules": typeof lib_onlineRules;
  "lib/requireAuth": typeof lib_requireAuth;
  "lib/revealHelpers": typeof lib_revealHelpers;
  "lib/roomHelpers": typeof lib_roomHelpers;
  "lib/social": typeof lib_social;
  "lib/views": typeof lib_views;
  profiles: typeof profiles;
  push: typeof push;
  rooms: typeof rooms;
  wallets: typeof wallets;
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
