import { EventEmitter } from "events";

/**
 * Base Platform class that all streaming platforms extend.
 * Defines the contract for platform integrations (Twitch, YouTube, Kick, etc.).
 *
 * Each platform must implement:
 * - init() — initialize connections, token refresh, etc.
 * - disconnect() — tear down all connections
 * - sendMessage() — send a chat message
 * - subscribeToEvents() — register event subscriptions
 * - getChannelInfo() — get channel metadata
 * - isLive() — check if stream is live
 *
 * Events emitted:
 * - 'chat' — incoming chat message (normalized)
 * - 'follow' — new follower
 * - 'subscribe' — new subscriber
 * - 'raid' — incoming raid
 * - 'stream.online' — stream started
 * - 'stream.offline' — stream ended
 */
export default class Platform extends EventEmitter {
  /**
   * @param {Object} connection - Platform connection config from DB
   */
  constructor(connection) {
    super();
    this.connection = connection;
    this.isConnected = false;
  }

  /**
   * Platform identifier (twitch, youtube, kick).
   * @returns {string}
   */
  get platformId() {
    throw new Error("Platform subclass must implement platformId getter");
  }

  /**
   * Initialize the platform (token refresh, WebSocket connections, etc.).
   */
  async init() {
    throw new Error("Platform subclass must implement init()");
  }

  /**
   * Tear down all connections and clean up resources.
   */
  async disconnect() {
    throw new Error("Platform subclass must implement disconnect()");
  }

  /**
   * Send a chat message to the platform.
   * @param {string} message - Message text
   * @param {Object} [options] - Platform-specific options (replyParentMessageId, etc.)
   * @returns {Promise<boolean>} true if sent successfully
   */
  async sendMessage(message, _options = {}) {
    throw new Error("Platform subclass must implement sendMessage()");
  }

  /**
   * Subscribe to platform events (follows, subs, raids, stream status, chat).
   */
  async subscribeToEvents() {
    throw new Error("Platform subclass must implement subscribeToEvents()");
  }

  /**
   * Get channel metadata (name, title, game/category, followers, etc.).
   * @returns {Promise<Object|null>}
   */
  async getChannelInfo() {
    throw new Error("Platform subclass must implement getChannelInfo()");
  }

  /**
   * Check if the stream is currently live.
   * @returns {Promise<boolean>}
   */
  async isLive() {
    throw new Error("Platform subclass must implement isLive()");
  }

  /**
   * Timeout a user from chat (moderator action).
   * @param {string} userId - Platform user ID
   * @param {number} duration - Duration in seconds
   * @param {string} [reason] - Optional reason
   * @returns {Promise<boolean>}
   */
  async timeoutUser(userId, duration, _reason = "") {
    throw new Error("Platform subclass must implement timeoutUser()");
  }

  /**
   * Ban a user from chat (moderator action).
   * @param {string} userId - Platform user ID
   * @param {string} [reason] - Optional reason
   * @returns {Promise<boolean>}
   */
  async banUser(userId, _reason = "") {
    throw new Error("Platform subclass must implement banUser()");
  }

  /**
   * Get list of users currently in chat.
   * @returns {Promise<Array>}
   */
  async getChannelChatters() {
    throw new Error("Platform subclass must implement getChannelChatters()");
  }

  /**
   * Refresh access token if needed (platform-specific logic).
   */
  async refreshTokensIfNeeded() {
    throw new Error("Platform subclass must implement refreshTokensIfNeeded()");
  }

  /**
   * Normalize a platform-specific chat message into a common format.
   * @param {Object} rawMessage - Platform-specific message
   * @returns {Object} Normalized message
   */
  normalizeChatMessage(rawMessage) {
    return {
      messageId: rawMessage.id || rawMessage.messageId,
      userId: rawMessage.userId,
      userLogin: rawMessage.userLogin || rawMessage.username,
      userName: rawMessage.userName || rawMessage.displayName,
      message: rawMessage.text || rawMessage.message,
      badges: rawMessage.badges || [],
      isBroadcaster: rawMessage.isBroadcaster || false,
      isMod: rawMessage.isMod || false,
      isVip: rawMessage.isVip || false,
      isSubscriber: rawMessage.isSubscriber || false,
      platform: this.platformId,
    };
  }
}
