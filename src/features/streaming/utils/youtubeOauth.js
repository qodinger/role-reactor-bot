import { config } from "../../../config/config.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

const YOUTUBE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const YOUTUBE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/**
 * Generate the YouTube OAuth authorization URL.
 * @param {string} state - CSRF protection state parameter
 * @returns {string} Authorization URL
 */
export function generateYouTubeAuthUrl(state) {
  const { clientId, redirectUri, scopes } = config.youtube;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return `${YOUTUBE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token.
 * @param {string} code - Authorization code from callback
 * @returns {Promise<Object>} Token response { accessToken, refreshToken, expiresIn, scope }
 */
export async function exchangeYouTubeCodeForToken(code) {
  const { clientId, clientSecret, redirectUri } = config.youtube;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const response = await fetch(YOUTUBE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error("YouTube token exchange failed", {
      status: response.status,
      error,
    });
    throw new Error(`YouTube token exchange failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
    tokenType: data.token_type,
  };
}

/**
 * Refresh an expired YouTube access token.
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} New token response
 */
export async function refreshYouTubeToken(refreshToken) {
  const { clientId, clientSecret } = config.youtube;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(YOUTUBE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error("YouTube token refresh failed", {
      status: response.status,
      error,
    });
    throw new Error(`YouTube token refresh failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    scope: data.scope,
    tokenType: data.token_type,
    // Refresh token may not be returned on refresh
    refreshToken: data.refresh_token || refreshToken,
  };
}

/**
 * Revoke a YouTube access/refresh token.
 * @param {string} token - The token to revoke
 * @returns {Promise<boolean>} true if revoked successfully
 */
export async function revokeYouTubeToken(token) {
  try {
    const response = await fetch(
      `${YOUTUBE_REVOKE_URL}?token=${encodeURIComponent(token)}`,
      { method: "POST" },
    );
    return response.ok;
  } catch (error) {
    logger.error("YouTube token revocation failed", error);
    return false;
  }
}

/**
 * Validate a YouTube access token by fetching user info.
 * @param {string} accessToken - The access token to validate
 * @returns {Promise<Object|null>} User info or null if invalid
 */
export async function validateYouTubeToken(accessToken) {
  try {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  } catch (error) {
    logger.error("YouTube token validation failed", error);
    return null;
  }
}

/**
 * Get YouTube channel info using the Data API.
 * @param {string} accessToken - The access token
 * @returns {Promise<Object|null>} Channel info
 */
export async function getYouTubeChannelInfo(accessToken) {
  try {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;

    const channel = data.items[0];
    return {
      id: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description,
      thumbnail: channel.snippet.thumbnails?.default?.url,
      subscriberCount: parseInt(channel.statistics.subscriberCount, 10) || 0,
      videoCount: parseInt(channel.statistics.videoCount, 10) || 0,
      liveChatId: null, // Must be fetched from active broadcast
    };
  } catch (error) {
    logger.error("Failed to fetch YouTube channel info", error);
    return null;
  }
}

/**
 * Get the active YouTube live broadcast.
 * @param {string} accessToken - The access token
 * @returns {Promise<Object|null>} Broadcast info { broadcastId, liveChatId, title, status }
 */
export async function getYouTubeActiveBroadcast(accessToken) {
  try {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status&broadcastStatus=active",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;

    const broadcast = data.items[0];
    return {
      broadcastId: broadcast.id,
      liveChatId: broadcast.snippet.liveChatId,
      title: broadcast.snippet.title,
      description: broadcast.snippet.description,
      status: broadcast.status.broadcastStatus,
      privacyStatus: broadcast.status.privacyStatus,
    };
  } catch (error) {
    logger.error("Failed to fetch YouTube active broadcast", error);
    return null;
  }
}

/**
 * Get YouTube live chat messages (polling).
 * @param {string} accessToken - The access token
 * @param {string} liveChatId - The live chat ID
 * @param {string} [pageToken] - Page token for pagination
 * @param {number} [maxResults=200] - Max results (200-2000)
 * @returns {Promise<Object>} Chat messages response
 */
export async function getYouTubeChatMessages(
  accessToken,
  liveChatId,
  pageToken,
  maxResults = 200,
) {
  const params = new URLSearchParams({
    part: "snippet,authorDetails",
    liveChatId,
    maxResults: String(maxResults),
  });

  if (pageToken) params.set("pageToken", pageToken);

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/liveChat/messages?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error("YouTube chat messages fetch failed", {
      status: response.status,
      error,
    });
    return null;
  }

  const data = await response.json();

  return {
    messages: data.items || [],
    nextPageToken: data.nextPageToken,
    pollingIntervalMillis: data.pollingIntervalMillis,
    offlineAt: data.offlineAt,
  };
}

/**
 * Send a message to YouTube live chat.
 * @param {string} accessToken - The access token
 * @param {string} liveChatId - The live chat ID
 * @param {string} message - Message text
 * @returns {Promise<Object|null>} Sent message info
 */
export async function sendYouTubeChatMessage(accessToken, liveChatId, message) {
  const body = {
    snippet: {
      liveChatId,
      type: "textMessageEvent",
      textMessageDetails: {
        messageText: message,
      },
    },
  };

  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error("YouTube chat message send failed", {
      status: response.status,
      error,
    });
    return null;
  }

  return response.json();
}
