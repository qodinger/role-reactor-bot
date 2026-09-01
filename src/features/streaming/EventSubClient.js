import WebSocket from "ws";
import { config } from "../../config/config.js";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

const EVENTSUB_WS_URL = "wss://eventsub.wss.twitch.tv/ws";
// Twitch caps the number of subscriptions per WebSocket connection; keep headroom.
const MAX_SUBS_PER_SOCKET = 250;

/**
 * EventSubClient manages a small POOL of EventSub WebSocket connections and a
 * registry of every subscription across all connected streamers. A single
 * shared pool (instead of one socket per streamer) is what lets the bot scale
 * to many concurrent streams — Twitch allows up to ~300 subscriptions per
 * socket, so 100 streamers (≈800 subs) need only a handful of sockets.
 *
 * Subscriptions are created with a `tokenProvider` (a function returning the
 * current access token) rather than a static token, so a token refresh is
 * automatically picked up the next time the subscription is (re)created after
 * a socket reconnect.
 */
export class EventSubClient {
  constructor() {
    /** @type {Array<{ws: WebSocket, sessionId: string|null, ready: boolean}>} */
    this.sessions = [];
    /**
     * Local subscription registry, keyed by a stable local key
     * (`type:condition`) so re-subscribes after a reconnect are idempotent.
     * @type {Map<string, {type: string, version: string, condition: object, tokenProvider: Function, onChat: Function, onEvent: Function, twitchSubId: string|null, session: object|null, createPromise: Promise<void>|null}>}
     */
    this.subscriptions = new Map();
    /** Reverse index: Twitch subscription id -> local entry */
    this.subIdIndex = new Map();
    /** Subscriptions awaiting a ready socket */
    this.pending = [];
    this.shouldReconnect = true;
  }

  /**
   * Open a managed EventSub WebSocket session.
   * @returns {object} session
   */
  _createSession() {
    const ws = new WebSocket(EVENTSUB_WS_URL);
    const session = { ws, sessionId: null, ready: false };
    this.sessions.push(session);

    ws.onopen = () => logger.info("EventSub WebSocket connected");

    ws.onmessage = async event => {
      try {
        const message = JSON.parse(event.data);
        await this._handleMessage(session, message);
      } catch (error) {
        logger.error("Failed to parse EventSub message", error);
      }
    };

    ws.onclose = event => {
      logger.warn("EventSub WebSocket closed", {
        code: event.code,
        reason: event.reason,
      });
      session.ready = false;
      session.sessionId = null;
      this.sessions = this.sessions.filter(s => s !== session);
      if (this.shouldReconnect) {
        setTimeout(() => this._createSession(), 5000);
      }
    };

    ws.onerror = error => logger.error("EventSub WebSocket error", error);

    return session;
  }

  async _handleMessage(session, message) {
    switch (message.metadata?.message_type) {
      case "session_welcome":
        session.sessionId = message.payload.session.id;
        session.ready = true;
        logger.info("EventSub session welcome", {
          sessionId: session.sessionId,
        });
        await this._flushPending();
        await this._resubscribeAll();
        break;

      case "notification": {
        const subId = message.payload?.subscription?.id;
        const entry = this.subIdIndex.get(subId);
        if (entry && entry.onChat && entry.onEvent) {
          if (message.payload.subscription?.type === "channel.chat.message") {
            entry.onChat(message.payload.event);
          } else {
            entry.onEvent(message.payload);
          }
        }
        break;
      }

      case "session_keepalive":
        break;

      case "revocation":
        logger.warn("EventSub subscription revoked", message.payload);
        break;
    }
  }

  _localKey(type, condition) {
    return `${type}:${JSON.stringify(condition)}`;
  }

  /**
   * Pick a session with capacity, creating one if needed.
   * @returns {object|null} ready session or null
   */
  _pickSession() {
    // Reuse an existing (even not-yet-ready) session so a burst of subscribe()
    // calls before the first welcome doesn't spawn hundreds of sockets.
    if (this.sessions.length > 0) {
      const first = this.sessions[0];
      if (!first.ready) return first;
      const ready = this.sessions.filter(
        s =>
          s.ready &&
          s.sessionId &&
          this._sessionSubCount(s) < MAX_SUBS_PER_SOCKET,
      );
      if (ready.length > 0) return ready[0];
    }
    return this._createSession();
  }

  _sessionSubCount(session) {
    let count = 0;
    for (const entry of this.subscriptions.values()) {
      if (entry.session === session) count += 1;
    }
    return count;
  }

  /**
   * Subscribe to an EventSub event on the shared pool.
   * @param {{type: string, version: string, condition: object}} sub
   * @param {Function} tokenProvider - returns a valid access token (Bearer)
   * @param {{onChat: Function, onEvent: Function}} handlers
   * @returns {Promise<void>}
   */
  async subscribe(sub, tokenProvider, handlers) {
    const key = this._localKey(sub.type, sub.condition);
    if (this.subscriptions.has(key)) return;

    const entry = {
      type: sub.type,
      version: sub.version,
      condition: sub.condition,
      tokenProvider,
      onChat: handlers.onChat,
      onEvent: handlers.onEvent,
      twitchSubId: null,
      session: null,
      createPromise: null,
    };
    this.subscriptions.set(key, entry);

    const session = this._pickSession();
    if (session && session.ready && session.sessionId) {
      await this._createSubscription(session, entry);
    } else {
      this.pending.push(entry);
    }
  }

  async _flushPending() {
    const pending = this.pending;
    this.pending = [];
    for (const entry of pending) {
      const session = this._pickSession();
      await this._createSubscription(session, entry);
    }
  }

  async _resubscribeAll() {
    for (const entry of this.subscriptions.values()) {
      const session = this._pickSession();
      await this._createSubscription(session, entry);
    }
  }

  async _createSubscription(session, entry) {
    if (!session.sessionId) return;

    // Pending flushes, reconnect handling, and token refreshes can all ask for
    // the same entry at once. Share one in-flight request to avoid Twitch 409s.
    if (entry.createPromise) return entry.createPromise;

    entry.createPromise = this._createSubscriptionRequest(
      session,
      entry,
    ).finally(() => {
      entry.createPromise = null;
    });
    return entry.createPromise;
  }

  async _createSubscriptionRequest(session, entry) {
    // Already active on a live session — skip to avoid duplicate creations
    // (e.g. when a welcome both flushes pending and re-subscribes all).
    if (
      entry.twitchSubId &&
      entry.session &&
      this.sessions.includes(entry.session)
    ) {
      return;
    }
    try {
      const token = await entry.tokenProvider();
      const response = await fetch(
        "https://api.twitch.tv/helix/eventsub/subscriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Client-Id": config.twitch.clientId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: entry.type,
            version: entry.version,
            condition: entry.condition,
            transport: {
              method: "websocket",
              session_id: session.sessionId,
            },
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        logger.error(
          `Failed to create EventSub subscription for ${entry.type}`,
          data,
        );
        return;
      }

      const subId = data.data?.[0]?.id;
      if (subId) {
        if (entry.twitchSubId) this.subIdIndex.delete(entry.twitchSubId);
        entry.twitchSubId = subId;
        entry.session = session;
        this.subIdIndex.set(subId, entry);
      }
      logger.info(`EventSub subscription created: ${entry.type}`);
    } catch (error) {
      logger.error(
        `Error creating EventSub subscription for ${entry.type}`,
        error,
      );
    }
  }

  /**
   * Re-subscribe everything owned by a given broadcaster (used after a token
   * refresh). The tokenProvider already reads the live token, so this mainly
   * forces a recreate on the current sessions.
   * @param {string} broadcasterUserId
   */
  async resubscribeBroadcaster(broadcasterUserId) {
    for (const session of this.sessions) {
      if (!session.ready || !session.sessionId) continue;
      for (const entry of this.subscriptions.values()) {
        const isOwned =
          entry.condition.broadcaster_user_id === broadcasterUserId ||
          entry.condition.to_broadcaster_user_id === broadcasterUserId;
        if (isOwned) {
          await this._createSubscription(session, entry);
        }
      }
    }
  }

  /**
   * Remove every subscription belonging to a broadcaster (called when that
   * streamer disconnects). Only their entries are removed — the shared socket
   * pool is left intact for other streamers.
   * @param {string} broadcasterUserId
   */
  async unsubscribeBroadcaster(broadcasterUserId) {
    for (const [key, entry] of this.subscriptions) {
      const isOwned =
        entry.condition.broadcaster_user_id === broadcasterUserId ||
        entry.condition.to_broadcaster_user_id === broadcasterUserId;
      if (!isOwned) continue;

      if (entry.twitchSubId) {
        try {
          const token = await entry.tokenProvider();
          await fetch(
            `https://api.twitch.tv/helix/eventsub/subscriptions?id=${entry.twitchSubId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
                "Client-Id": config.twitch.clientId,
              },
            },
          );
        } catch (error) {
          logger.error(
            `Failed to delete EventSub subscription ${entry.twitchSubId}`,
            error,
          );
        }
        if (entry.twitchSubId) this.subIdIndex.delete(entry.twitchSubId);
      }

      this.subscriptions.delete(key);
    }
  }

  /**
   * Disconnect all sessions (used on shutdown).
   */
  disconnect() {
    this.shouldReconnect = false;
    for (const session of this.sessions) {
      try {
        session.ws.onclose = null;
        session.ws.close();
      } catch (_) {}
    }
    this.sessions = [];
    this.subscriptions.clear();
    this.subIdIndex.clear();
  }
}

export default EventSubClient;
