import { getStorageManager } from "../../utils/storage/storageManager.js";
import { getPremiumManager } from "../premium/PremiumManager.js";
import { getLogger } from "../../utils/logger.js";
import { FREE_TIER, PRO_ENGINE } from "./config.js";

const logger = getLogger();

/**
 * TicketTranscript - Generate and manage ticket transcripts
 */
export class TicketTranscript {
  constructor() {
    this.storage = null;
    this.premiumManager = null;
  }

  /**
   * Initialize transcript manager
   */
  async initialize() {
    this.storage = await getStorageManager();
    this.premiumManager = getPremiumManager();
    logger.info("🎫 TicketTranscript initialized");
  }

  /**
   * Generate transcript from channel messages
   * @param {Object} options - Transcript options
   * @returns {Promise<Object>} Transcript result
   */
  async generateFromChannel(options) {
    try {
      const { ticketId, guildId, channel, ticket, format = "html" } = options;

      // Fetch messages from channel
      const messages = await this.fetchChannelMessages(channel);

      // Format messages
      const formattedMessages = this.formatMessages(messages);

      // Generate content based on format
      let content;
      if (format === "html") {
        content = this.generateHTML(formattedMessages, ticket);
      } else if (format === "json") {
        content = JSON.stringify(formattedMessages, null, 2);
      } else {
        content = this.generateText(formattedMessages);
      }

      // Calculate expiry
      const isPro = await this.premiumManager.isFeatureActive(
        guildId,
        "pro_engine",
      );

      const retentionDays = isPro
        ? PRO_ENGINE.TRANSCRIPT_RETENTION_DAYS
        : FREE_TIER.TRANSCRIPT_RETENTION_DAYS;

      const expiresAt =
        retentionDays > 0
          ? new Date(
              Date.now() + retentionDays * 24 * 60 * 60 * 1000,
            ).toISOString()
          : null;

      // Generate transcript ID
      const transcriptId = `TRS-${guildId}-${ticketId.split("-").pop()}`;

      // Save transcript
      const transcript = await this.storage.createTicketTranscript({
        transcriptId,
        ticketId,
        guildId,
        format,
        content,
        messages: formattedMessages,
        metadata: {
          ticketOpenedAt: ticket?.openedAt,
          ticketClosedAt: ticket?.closedAt || new Date().toISOString(),
          claimedBy: ticket?.claimedBy,
          totalMessages: formattedMessages.length,
          duration: ticket?.openedAt
            ? new Date(ticket.closedAt || Date.now()) -
              new Date(ticket.openedAt)
            : 0,
        },
        expiresAt,
      });

      if (!transcript) {
        throw new Error("Failed to save transcript");
      }

      logger.info(
        `Transcript generated: ${transcriptId} for ticket ${ticketId}`,
      );

      return {
        success: true,
        transcript,
        content,
      };
    } catch (error) {
      logger.error("Failed to generate transcript:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Fetch messages from channel
   * @param {DiscordChannel} channel - Discord channel
   * @returns {Promise<Array>} Array of messages
   */
  async fetchChannelMessages(channel) {
    try {
      const messages = [];
      let lastId = null;

      // Fetch messages in batches (Discord limit: 100 per request)
      while (messages.length < 1000) {
        // Max 1000 messages
        const options = { limit: 100 };
        if (lastId) {
          options.before = lastId;
        }

        const fetched = await channel.messages.fetch(options);

        if (fetched.size === 0) break;

        messages.push(...fetched.values());
        lastId = fetched.last().id;
      }

      // Sort by creation time (oldest first)
      return messages.reverse();
    } catch (error) {
      logger.error("Failed to fetch channel messages:", error);
      return [];
    }
  }

  /**
   * Format messages for transcript
   * @param {Array} messages - Discord messages
   * @returns {Array} Formatted messages
   */
  formatMessages(messages) {
    return messages.map(msg => ({
      id: msg.id,
      userId: msg.author?.id || "unknown",
      username: msg.author?.username || "Unknown",
      discriminator: msg.author?.discriminator || "0000",
      content: msg.content || "",
      timestamp: msg.createdAt?.toISOString() || new Date().toISOString(),
      attachments: msg.attachments?.map(a => a.url) || [],
      isBot: msg.author?.bot || false,
    }));
  }

  /**
   * Generate HTML transcript
   * @param {Array} messages - Formatted messages
   * @param {Object} ticket - Ticket data
   * @returns {string} HTML content
   */
  generateHTML(messages, ticket) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket Transcript - ${ticket?.ticketId || "Unknown"}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #2c2f33;
      color: #ffffff;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      background: #5865F2;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .header p {
      margin: 10px 0 0;
      opacity: 0.8;
    }
    .message {
      background: #36393f;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 10px;
      border-left: 3px solid #5865F2;
    }
    .message.system {
      border-left-color: #f1c40f;
      background: #3c3f41;
      font-style: italic;
    }
    .message-header {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    .username {
      font-weight: bold;
      color: #5865F2;
      margin-right: 10px;
    }
    .system .username {
      color: #f1c40f;
    }
    .timestamp {
      font-size: 12px;
      opacity: 0.6;
    }
    .content {
      line-height: 1.5;
    }
    .attachment {
      margin-top: 10px;
      padding: 10px;
      background: #2c2f33;
      border-radius: 4px;
    }
    .attachment a {
      color: #5865F2;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎫 Ticket Transcript</h1>
      <p><strong>Ticket ID:</strong> ${ticket?.ticketId || "Unknown"}</p>
      <p><strong>Created:</strong> ${new Date(ticket?.openedAt || Date.now()).toLocaleString()}</p>
      <p><strong>Closed:</strong> ${ticket?.closedAt ? new Date(ticket.closedAt).toLocaleString() : "Not closed"}</p>
      <p><strong>Messages:</strong> ${messages.length}</p>
    </div>
    
    <div class="messages">
      ${messages
        .map(
          msg => `
        <div class="message ${msg.isBot ? "system" : ""}">
          <div class="message-header">
            <span class="username">${this.escapeHtml(msg.username)}${msg.isBot ? " [BOT]" : ""}</span>
            <span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span>
          </div>
          <div class="content">
            ${this.escapeHtml(msg.content)}
            ${
              msg.attachments?.length > 0
                ? `
              <div class="attachment">
                <strong>Attachments:</strong><br>
                ${msg.attachments.map(url => `<a href="${url}" target="_blank">${url}</a>`).join("<br>")}
              </div>
            `
                : ""
            }
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  </div>
</body>
</html>
    `.trim();

    return html;
  }

  /**
   * Generate plain text transcript
   * @param {Array} messages - Formatted messages
   * @returns {string} Text content
   */
  generateText(messages) {
    return messages
      .map(
        msg =>
          `[${new Date(msg.timestamp).toLocaleString()}] ${msg.username}: ${msg.content}`,
      )
      .join("\n");
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Get transcript by ticket ID
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object|null>} Transcript or null
   */
  async getTranscriptByTicket(ticketId) {
    try {
      return await this.storage.getTicketTranscriptByTicket(ticketId);
    } catch (error) {
      logger.error("Failed to get transcript by ticket:", error);
      return null;
    }
  }

  /**
   * Delete expired transcripts
   * @param {string} guildId - Guild ID
   * @returns {Promise<number>} Number of deleted transcripts
   */
  async cleanupExpired(guildId) {
    try {
      const expired = await this.storage.getExpiredTranscripts(guildId);
      let deleted = 0;

      for (const transcript of expired) {
        const success = await this.storage.deleteTicketTranscript(
          transcript.transcriptId,
        );
        if (success) {
          deleted++;
          logger.info(`Expired transcript deleted: ${transcript.transcriptId}`);
        }
      }

      return deleted;
    } catch (error) {
      logger.error("Failed to cleanup expired transcripts:", error);
      return 0;
    }
  }

  /**
   * Get storage usage
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Storage usage stats
   */
  async getStorageUsage(guildId) {
    try {
      return await this.storage.getTranscriptStorageUsage(guildId);
    } catch (error) {
      logger.error("Failed to get storage usage:", error);
      return { totalTranscripts: 0, totalSizeBytes: 0, totalSizeMB: "0" };
    }
  }
}

// Singleton instance
let instance = null;

export function getTicketTranscript() {
  if (!instance) {
    instance = new TicketTranscript();
  }
  return instance;
}
