import { randomBytes } from "crypto";
import { config } from "../../../config/config.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";

/**
 * Generate the Twitch OAuth authorization URL
 * @param {string} state - CSRF protection state parameter
 * @returns {string} Authorization URL
 */
export function generateAuthUrl(state) {
  const { clientId, redirectUri, scopes } = config.twitch;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state,
  });

  return `${TWITCH_AUTH_URL}?${params.toString()}`;
}

/**
 * Generate the Twitch OAuth authorization URL for the dedicated bot account.
 * Uses a separate redirect URI (/callback/bot) and the bot scopes.
 * @param {string} state - CSRF protection state parameter
 * @returns {string} Authorization URL
 */
export function generateBotAuthUrl(state) {
  const { clientId, redirectUri, botScopes } = config.twitch;
  const botRedirectUri = redirectUri.replace(
    "/callback/twitch",
    "/callback/bot",
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: botRedirectUri,
    response_type: "code",
    scope: botScopes.join(" "),
    state,
  });

  return `${TWITCH_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from callback
 * @param {string} [redirectUriOverride] - Redirect URI used in the authorize
 *   request (must match exactly; defaults to the broadcaster callback URI)
 * @returns {Promise<Object>} Token response
 */
export async function exchangeCodeForToken(code, redirectUriOverride) {
  const { clientId, clientSecret, redirectUri } = config.twitch;
  const usedRedirectUri = redirectUriOverride || redirectUri;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: usedRedirectUri,
  });

  const response = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error("Twitch token exchange failed", {
      status: response.status,
      error: data,
    });
    throw new Error(`Token exchange failed: ${data.message || data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
    tokenType: data.token_type,
  };
}

/**
 * Refresh an expired access token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New token response
 */
export async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = config.twitch;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error("Twitch token refresh failed", {
      status: response.status,
      error: data,
    });
    throw new Error(`Token refresh failed: ${data.message || data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
    scope: data.scope,
    tokenType: data.token_type,
  };
}

/**
 * Validate an access token and get user info
 * @param {string} accessToken - Access token to validate
 * @returns {Promise<Object|null>} User info or null if invalid
 */
export async function validateToken(accessToken) {
  const response = await fetch(TWITCH_VALIDATE_URL, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

/**
 * Get Twitch user info using access token
 * @param {string} accessToken - Access token
 * @returns {Promise<Object>} User info
 */
export async function getUserInfo(accessToken) {
  const response = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": config.twitch.clientId,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error("Failed to get Twitch user info", {
      status: response.status,
      error: data,
    });
    throw new Error(
      `Failed to get user info: ${data.message || "Unknown error"}`,
    );
  }

  return data.data[0];
}

/**
 * Get Twitch channel info by username
 * @param {string} accessToken - Access token
 * @param {string} username - Channel username
 * @returns {Promise<Object>} Channel info
 */
export async function getChannelInfo(accessToken, username) {
  const response = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": config.twitch.clientId,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    logger.error("Failed to get Twitch channel info", {
      status: response.status,
      error: data,
    });
    throw new Error(
      `Failed to get channel info: ${data.message || "Unknown error"}`,
    );
  }

  return data.data[0];
}

/**
 * Get live stream info for a broadcaster (category, title, viewers, thumbnail).
 * The `stream.online` EventSub payload does not include these, so the alert
 * embeds fetch them here. Returns null on failure/empty.
 * @param {string} accessToken - broadcaster or app access token
 * @param {string} userId - Twitch user id
 * @returns {Promise<object|null>}
 */
export async function getStreamInfo(accessToken, userId) {
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": config.twitch.clientId,
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      logger.error("Failed to get Twitch stream info", {
        status: response.status,
        error: data,
      });
      return null;
    }

    return data.data?.[0] || null;
  } catch (error) {
    logger.error("Failed to get Twitch stream info", error);
    return null;
  }
}

/**
 * Get follower count for a broadcaster.
 * @param {string} accessToken - broadcaster access token (needs moderator:read:followers)
 * @param {string} broadcasterId - Twitch user id of the broadcaster
 * @returns {Promise<number>} Total follower count (0 on failure)
 */
export async function getFollowerCount(accessToken, broadcasterId) {
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": config.twitch.clientId,
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      logger.error("Failed to get Twitch follower count", {
        status: response.status,
        error: data,
      });
      return 0;
    }

    return data.data?.[0]?.total || 0;
  } catch (error) {
    logger.error("Failed to get Twitch follower count", error);
    return 0;
  }
}

/**
 * Get App Access Token (server-to-server, cached). Used to send chat as the
 * bot account so the Chat Bot Badge appears (per Twitch docs, the badge
 * requires an App Access Token, not a user token).
 * @returns {Promise<string>} App access token
 */
let cachedAppToken = null;
let cachedAppTokenExpiresAt = 0;

export async function getAppAccessToken() {
  const now = Date.now();
  if (cachedAppToken && cachedAppTokenExpiresAt - now > 5 * 60 * 1000) {
    return cachedAppToken;
  }

  const { clientId, clientSecret } = config.twitch;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error("Failed to get app access token", {
      status: response.status,
      error: data,
    });
    throw new Error(`App token failed: ${data.message || data.error}`);
  }

  cachedAppToken = data.access_token;
  cachedAppTokenExpiresAt =
    now + (data.expires_in ? data.expires_in * 1000 : 3600 * 1000);
  return cachedAppToken;
}

/**
 * Update channel info (title, game/category) via Twitch Helix API.
 * Requires channel:manage:broadcast scope.
 * @param {string} accessToken - Broadcaster access token
 * @param {string} broadcasterId - Twitch user ID
 * @param {Object} fields - { title?: string, gameId?: string, tags?: string[] }
 * @returns {Promise<boolean>}
 */
export async function updateChannel(accessToken, broadcasterId, fields = {}) {
  try {
    const params = new URLSearchParams({ broadcaster_id: broadcasterId });
    if (fields.title !== undefined) params.set("title", fields.title);
    if (fields.gameId !== undefined) params.set("game_id", fields.gameId);

    const response = await fetch(
      `https://api.twitch.tv/helix/channels?${params.toString()}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": config.twitch.clientId,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const data = await response.json();
      logger.error("Failed to update Twitch channel", {
        status: response.status,
        error: data,
      });
      return false;
    }
    return true;
  } catch (error) {
    logger.error("Failed to update Twitch channel", error);
    return false;
  }
}

/**
 * Search for a game/category by name and return its ID.
 * @param {string} accessToken - App or user access token
 * @param {string} name - Game/category name to search
 * @returns {Promise<string|null>} Game ID or null
 */
export async function searchGame(accessToken, name) {
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(name)}&first=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": config.twitch.clientId,
        },
      },
    );
    const data = await response.json();
    if (!response.ok || !data.data?.length) return null;
    return data.data[0].id;
  } catch (error) {
    logger.error("Failed to search Twitch game", error);
    return null;
  }
}

/**
 * Generate a random state string for CSRF protection
 * @returns {string} Random state string
 */
export function generateState() {
  return randomBytes(32).toString("hex");
}
