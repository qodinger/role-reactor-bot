/**
 * OAuth State Store
 *
 * Manages OAuth state parameters for CSRF protection.
 * Replaces scattered `global.twitchOAuthStates` usage.
 */

/** @type {Map<string, { userId: string, guildId?: string, platform?: string }>} */
const twitchUserStates = new Map();

/** @type {Map<string, { userId: string, guildId?: string }>} */
const twitchBotStates = new Map();

/** @type {Map<string, { userId: string, guildId?: string }>} */
const youtubeUserStates = new Map();

/**
 * Store a user OAuth state.
 */
export function setTwitchUserState(state, data) {
  twitchUserStates.set(state, data);
}

/**
 * Get and consume a user OAuth state (returns data and deletes it).
 */
export function getTwitchUserState(state) {
  const data = twitchUserStates.get(state);
  if (data) twitchUserStates.delete(state);
  return data;
}

/**
 * Check if a user OAuth state exists.
 */
export function hasTwitchUserState(state) {
  return twitchUserStates.has(state);
}

/**
 * Store a bot OAuth state.
 */
export function setTwitchBotState(state, data) {
  twitchBotStates.set(state, data);
}

/**
 * Get and consume a bot OAuth state (returns data and deletes it).
 */
export function getTwitchBotState(state) {
  const data = twitchBotStates.get(state);
  if (data) twitchBotStates.delete(state);
  return data;
}

/**
 * Check if a bot OAuth state exists.
 */
export function hasTwitchBotState(state) {
  return twitchBotStates.has(state);
}

/**
 * Store a YouTube user OAuth state.
 */
export function setYouTubeUserState(state, data) {
  youtubeUserStates.set(state, data);
}

/**
 * Get and consume a YouTube user OAuth state (returns data and deletes it).
 */
export function getYouTubeUserState(state) {
  const data = youtubeUserStates.get(state);
  if (data) youtubeUserStates.delete(state);
  return data;
}

/**
 * Check if a YouTube user OAuth state exists.
 */
export function hasYouTubeUserState(state) {
  return youtubeUserStates.has(state);
}
