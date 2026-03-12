import { getStorageManager } from "../../utils/storage/storageManager.js";
import { getPremiumManager } from "../premium/PremiumManager.js";
import { getLogger } from "../../utils/logger.js";
import { FREE_TIER, PRO_ENGINE } from "./config.js";
import dedent from "dedent";

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

      if (!channel) {
        throw new Error("Discord channel is missing");
      }
      if (!ticketId || !guildId) {
        throw new Error("Ticket ID and Guild ID are required");
      }

      // Determine max messages based on tier
      const isPro = await this.premiumManager.isFeatureActive(
        guildId,
        "pro_engine",
      );

      const maxMessages = isPro
        ? PRO_ENGINE.MAX_MESSAGES_PER_TRANSCRIPT
        : FREE_TIER.MAX_MESSAGES_PER_TRANSCRIPT;

      // Fetch messages from channel
      const { messages, isTruncated } = await this.fetchChannelMessages(
        channel,
        maxMessages,
      );

      // Format messages
      const formattedMessages = this.formatMessages(messages);

      // Generate content based on format
      let content;
      if (format === "html") {
        content = this.generateHTML(formattedMessages, {
          ...ticket,
          isTruncated,
        });
      } else if (format === "json") {
        content = this.generateJSON(formattedMessages, {
          ...ticket,
          isTruncated,
        });
      } else {
        content = this.generateMarkdown(formattedMessages, {
          ...ticket,
          isTruncated,
        });
      }

      // Calculate expiry
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
        content: "", // Save space by not storing rendered string (regenerate on on-the-fly)
        messages: formattedMessages,
        metadata: {
          ticketOpenedAt: ticket?.openedAt,
          ticketClosedAt: ticket?.closedAt || new Date().toISOString(),
          claimedBy: ticket?.claimedBy,
          totalMessages: formattedMessages.length,
          isTruncated: !!isTruncated,
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
  /**
   * Fetch messages from a channel with a limit
   * @param {Object} channel - Discord channel
   * @param {number} maxMessages - Maximum messages to fetch
   * @returns {Promise<Object>} Messages and truncated flag
   */
  async fetchChannelMessages(channel, maxMessages = 1000) {
    try {
      const messages = [];
      let lastId = null;
      let isTruncated = false;

      // Fetch messages in batches (Discord limit: 100 per request)
      while (messages.length < maxMessages) {
        const remaining = maxMessages - messages.length;
        const limit = Math.min(100, remaining);
        const options = { limit };
        if (lastId) {
          options.before = lastId;
        }

        const fetched = await channel.messages.fetch(options);

        if (fetched.size === 0) break;

        messages.push(...fetched.values());
        lastId = fetched.last().id;

        // If we fetched the max we could in this request and still have more to go
        if (messages.length >= maxMessages) {
          isTruncated = true;
          break;
        }
      }

      // Sort by creation time (oldest first)
      return {
        messages: messages.reverse(),
        isTruncated,
      };
    } catch (error) {
      logger.error("Failed to fetch channel messages:", error);
      return { messages: [], isTruncated: false };
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
      displayName: msg.member?.displayName || msg.author?.username || "Unknown",
      avatarUrl:
        (typeof msg.author?.displayAvatarURL === "function"
          ? msg.author.displayAvatarURL({ size: 64 })
          : null) || "https://cdn.discordapp.com/embed/avatars/0.png",
      content: msg.cleanContent || msg.content || "",
      embeds:
        msg.embeds?.map(e => ({
          title: e.title || null,
          description: e.description || null,
          fields: e.fields?.map(f => ({ name: f.name, value: f.value })) || [],
          color: e.color || null,
        })) || [],
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
    // Group consecutive messages from the same user (within 7 minutes)
    const groupedMessages = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prev = messages[i - 1];
      const sameUser =
        prev &&
        ((msg.userId && prev.userId && msg.userId === prev.userId) ||
          (!msg.userId && msg.displayName === prev?.displayName));
      const isGrouped =
        sameUser &&
        new Date(msg.timestamp) - new Date(prev.timestamp) < 7 * 60 * 1000;
      groupedMessages.push({ ...msg, isGrouped });
    }

    const html = dedent`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width">
        <title>Ticket Transcript - ${ticket?.ticketId || "Unknown"}</title>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            background-color: #313338;
            color: #dcddde;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            font-size: 16px;
            font-weight: 400;
            scroll-behavior: smooth;
          }
          a { color: #00aff4; text-decoration: none; }
          a:hover { text-decoration: underline; }
          img { object-fit: contain; }

          /* Container */
          .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 0.5rem 1rem;
          }

          /* Preamble / Header */
          .preamble {
            display: grid;
            grid-template-columns: auto 1fr;
            max-width: 100%;
            padding: 1rem;
          }
          .preamble__entries-container {
            padding: 0.6rem 1rem;
          }
          .preamble__entry {
            margin-bottom: 0.1rem;
            color: #ffffff;
            font-size: 1.4rem;
          }
          .preamble__entry--small {
            font-size: 1rem;
            color: #dcddde;
          }

          /* Chatlog */
          .chatlog {
            padding: 1rem 0;
            width: 100%;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
          .chatlog__message-group {
            margin-bottom: 0;
          }

          /* Individual message row */
          .chatlog__message {
            display: grid;
            grid-template-columns: auto 1fr;
            padding: 0.15rem 0;
          }
          .chatlog__message--group-start {
            margin-top: 1.0625rem;
          }
          .chatlog__message:hover {
            background-color: #32353b;
          }

          /* Avatar column */
          .chatlog__message-aside {
            grid-column: 1;
            width: 72px;
            padding: 0.15rem 0.15rem 0 0.15rem;
            text-align: center;
          }
          .chatlog__avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
          }
          .chatlog__short-timestamp {
            display: none;
            color: #a3a6aa;
            font-size: 0.75rem;
            font-weight: 500;
          }
          .chatlog__message:hover .chatlog__short-timestamp {
            display: block;
          }

          /* Content column */
          .chatlog__message-primary {
            grid-column: 2;
            min-width: 0;
          }
          .chatlog__header {
            margin-bottom: 0.1rem;
          }
          .chatlog__author {
            font-weight: 500;
            color: #ffffff;
          }
          .chatlog__author-tag {
            position: relative;
            top: -0.1rem;
            margin-left: 0.3rem;
            padding: 0.05rem 0.3rem;
            border-radius: 3px;
            background-color: #5865F2;
            color: #ffffff;
            font-size: 0.625rem;
            font-weight: 500;
            line-height: 1.3;
          }
          .chatlog__timestamp {
            margin-left: 0.3rem;
            color: #a3a6aa;
            font-size: 0.75rem;
            font-weight: 500;
          }

          /* Message content */
          .chatlog__content {
            padding-right: 1rem;
            font-size: 0.95rem;
            word-wrap: break-word;
            line-height: 1.375;
            white-space: pre-wrap;
          }

          /* Embeds */
          .chatlog__embed {
            display: flex;
            margin-top: 0.3rem;
            max-width: 520px;
          }
          .chatlog__embed-color-pill {
            flex-shrink: 0;
            width: 0.25rem;
            border-top-left-radius: 3px;
            border-bottom-left-radius: 3px;
          }
          .chatlog__embed-color-pill--default {
            background-color: #202225;
          }
          .chatlog__embed-content-container {
            display: flex;
            flex-direction: column;
            padding: 0.5rem 0.6rem;
            border: 1px solid rgba(46, 48, 54, 0.6);
            border-top-right-radius: 3px;
            border-bottom-right-radius: 3px;
            background-color: rgba(46, 48, 54, 0.3);
          }
          .chatlog__embed-title {
            margin-bottom: 0.3rem;
            color: #ffffff;
            font-size: 0.875rem;
            font-weight: 600;
          }
          .chatlog__embed-description {
            color: #dcddde;
            font-weight: 500;
            font-size: 0.85rem;
            white-space: pre-wrap;
          }
          .chatlog__embed-fields {
            display: flex;
            flex-wrap: wrap;
            gap: 0 0.5rem;
          }
          .chatlog__embed-field {
            flex: 0;
            min-width: 100%;
            max-width: 506px;
            padding-top: 0.6rem;
            font-size: 0.875rem;
          }
          .chatlog__embed-field-name {
            margin-bottom: 0.2rem;
            color: #ffffff;
            font-weight: 600;
          }
          .chatlog__embed-field-value {
            color: #dcddde;
            font-weight: 500;
          }

          /* Attachments */
          .chatlog__attachment {
            position: relative;
            width: fit-content;
            margin-top: 0.3rem;
            border-radius: 3px;
            overflow: hidden;
          }
          .chatlog__attachment a {
            color: #00aff4;
            font-size: 0.85rem;
          }

          /* Markdown */
          .chatlog__markdown {
            max-width: 100%;
            line-height: 1.3;
            overflow-wrap: break-word;
          }
          .chatlog__markdown-pre {
            background-color: #2f3136;
            font-family: "Consolas", "Courier New", Courier, monospace;
            font-size: 0.85rem;
          }
          .chatlog__markdown-pre--multiline {
            display: block;
            margin-top: 0.25rem;
            padding: 0.5rem;
            border: 2px solid #282b30;
            border-radius: 5px;
            color: #b9bbbe;
          }
          .chatlog__markdown-pre--inline {
            display: inline-block;
            padding: 2px;
            border-radius: 3px;
          }
          .chatlog__markdown-mention {
            border-radius: 3px;
            padding: 0 2px;
            background-color: rgba(88, 101, 242, .3);
            color: #dee0fc;
            font-weight: 500;
          }
          .chatlog__markdown-mention:hover {
            background-color: #5865f2;
            color: #ffffff;
          }
          strong { font-weight: 700; color: #ffffff; }
          em { font-style: italic; }
          u { text-decoration: underline; }
          del { text-decoration: line-through; }
          .warning-box {
            background-color: rgba(255, 170, 0, 0.1);
            border: 1px solid rgba(255, 170, 0, 0.3);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 20px;
            color: #ffaa00;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
          }
          .warning-box span {
            margin-right: 10px;
            font-size: 1.2rem;
          }

          /* Postamble */
          .postamble {
            padding: 1.25rem;
          }
          .postamble__entry {
            color: #ffffff;
          }
  </style>
</head>
      <body>
      <div class="container">
        <div class="preamble">
          <div class="preamble__entries-container">
            <div class="preamble__entry">🎫 Ticket Transcript</div>
            <div class="preamble__entry--small"><strong>Ticket ID:</strong> ${ticket?.ticketId || "Unknown"}</div>
            <div class="preamble__entry--small"><strong>Created:</strong> ${new Date(ticket?.openedAt || Date.now()).toLocaleString()}</div>
            <div class="preamble__entry--small"><strong>Closed:</strong> ${ticket?.closedAt ? new Date(ticket.closedAt).toLocaleString() : "Not closed"}</div>
            <div class="preamble__entry--small"><strong>Messages:</strong> ${messages.length}</div>
          </div>
        </div>

        ${
          ticket?.isTruncated
            ? `
        <div class="warning-box">
          <span>⚠️</span> This transcript was truncated because it reached the maximum message limit. Some earlier context may be missing.
        </div>`
            : ""
        }

        <div class="chatlog">
          ${groupedMessages
            .map(msg => {
              const header = !msg.isGrouped
                ? `<div class="chatlog__header"><span class="chatlog__author">${this.escapeHtml(msg.displayName)}</span>${msg.isBot ? '<span class="chatlog__author-tag">BOT</span>' : ""}<span class="chatlog__timestamp">${new Date(msg.timestamp).toLocaleString()}</span></div>`
                : "";
              const aside = !msg.isGrouped
                ? `<img class="chatlog__avatar" src="${msg.avatarUrl}" alt="Avatar">`
                : `<span class="chatlog__short-timestamp">${new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>`;
              const content = `<div class="chatlog__content chatlog__markdown"><span class="chatlog__markdown-preserve">${this.parseMarkdown(msg.content)}</span></div>`;
              const embeds = (msg.embeds || [])
                .map(embed => {
                  const pill = `<div class="chatlog__embed-color-pill${embed.color ? "" : " chatlog__embed-color-pill--default"}" style="${embed.color ? "background-color: #" + embed.color.toString(16).padStart(6, "0") : ""}"></div>`;
                  const title = embed.title
                    ? `<div class="chatlog__embed-title">${this.parseMarkdown(embed.title)}</div>`
                    : "";
                  const desc = embed.description
                    ? `<div class="chatlog__embed-description">${this.parseMarkdown(embed.description)}</div>`
                    : "";
                  const fields =
                    embed.fields && embed.fields.length > 0
                      ? `<div class="chatlog__embed-fields">${embed.fields.map(f => `<div class="chatlog__embed-field"><div class="chatlog__embed-field-name">${this.parseMarkdown(f.name)}</div><div class="chatlog__embed-field-value">${this.parseMarkdown(f.value)}</div></div>`).join("")}</div>`
                      : "";
                  return `<div class="chatlog__embed">${pill}<div class="chatlog__embed-content-container">${title}${desc}${fields}</div></div>`;
                })
                .join("");
              const attachments =
                msg.attachments?.length > 0
                  ? `<div class="chatlog__attachment">${msg.attachments.map(url => `<a href="${url}" target="_blank">📎 View Attachment</a>`).join("<br>")}</div>`
                  : "";
              return `<div class="chatlog__message${!msg.isGrouped ? " chatlog__message--group-start" : ""}"><div class="chatlog__message-aside">${aside}</div><div class="chatlog__message-primary">${header}${content}${embeds}${attachments}</div></div>`;
            })
            .join("")}
        </div>

        <div class="postamble">
          <div class="postamble__entry">Exported ${messages.length} message(s)</div>
        </div>
      </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Generate markdown transcript
   * @param {Array} messages - Formatted messages
   * @param {Object} ticket - Ticket data
   * @returns {string} Markdown content
   */
  generateMarkdown(messages, ticket) {
    let md = `# Ticket Transcript - ${ticket?.ticketId || "Unknown"}\n\n`;
    md += `**Created:** ${new Date(ticket?.openedAt || Date.now()).toLocaleString()}\n`;
    md += `**Closed:** ${ticket?.closedAt ? new Date(ticket.closedAt).toLocaleString() : "Not closed"}\n`;
    md += `**Messages:** ${messages.length}\n`;
    if (ticket?.isTruncated) {
      md += `**⚠️ Notice:** This transcript was truncated due to the maximum message limit.\n`;
    }
    md += `\n---\n\n`;

    // Grouping logic (same as HTML)
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prev = messages[i - 1];
      const sameUser =
        prev &&
        ((msg.userId && prev.userId && msg.userId === prev.userId) ||
          (!msg.userId &&
            (msg.displayName || msg.username) ===
              (prev?.displayName || prev?.username)));
      const isGrouped =
        sameUser &&
        new Date(msg.timestamp) - new Date(prev.timestamp) < 7 * 60 * 1000;

      if (!isGrouped) {
        if (i > 0) md += "\n---\n\n";
        const name = msg.displayName || msg.username || "Unknown Member";
        const timestamp = new Date(msg.timestamp).toLocaleString();
        md += `**${name}** \`[${timestamp}]\`\n`;
      } else {
        // Just a small gap for continuation
        md += "\n";
      }

      // Message Content
      if (msg.content) {
        md += `${msg.content}\n`;
      }

      // Embeds
      if (msg.embeds?.length > 0) {
        msg.embeds.forEach(e => {
          md += "\n> ";
          if (e.title) md += `**${e.title}**\n> `;
          if (e.description) md += `${e.description}\n> `;
          e.fields?.forEach(f => {
            md += `\n> **${f.name}**\n> ${f.value}\n> `;
          });
          md += "\n";
        });
      }

      // Attachments
      if (msg.attachments?.length > 0) {
        md +=
          "\n" +
          msg.attachments.map(url => `[📎 Attachment](${url})`).join("\n") +
          "\n";
      }
    }

    return md.trim();
  }

  /**
   * Generate text transcript (alias for Markdown)
   * @param {Array} messages - Formatted messages
   * @param {Object} ticket - Ticket data
   * @returns {string} Text content
   */
  generateText(messages, ticket) {
    return this.generateMarkdown(messages, ticket);
  }

  /**
   * Generate JSON transcript with metadata
   * @param {Array} messages - Formatted messages
   * @param {Object} ticket - Ticket data
   * @returns {string} JSON string
   */
  generateJSON(messages, ticket) {
    return JSON.stringify(
      {
        ticketInfo: {
          ticketId: ticket?.ticketId || "Unknown",
          guildId: ticket?.guildId || "Unknown",
          openedAt: ticket?.openedAt || null,
          closedAt: ticket?.closedAt || new Date().toISOString(),
          status: ticket?.status || "unknown",
          isTruncated: ticket?.isTruncated || false,
          exportDate: new Date().toISOString(),
          totalMessages: messages.length,
        },
        messages: messages.map(msg => ({
          id: msg.id,
          timestamp: msg.timestamp,
          author: {
            id: msg.userId,
            username: msg.username,
            displayName: msg.displayName,
            isBot: msg.isBot,
            avatarUrl: msg.avatarUrl,
          },
          content: msg.content,
          embeds: msg.embeds,
          attachments: msg.attachments,
        })),
      },
      null,
      2,
    );
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
   * Parse basic Discord markdown (bold, italic, code, mentions)
   * @param {string} text - Raw text
   * @returns {string} HTML parsed text
   */
  parseMarkdown(text) {
    if (!text) return "";
    let parsed = this.escapeHtml(text);

    // Bold
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Italic
    parsed = parsed
      .replace(/\*([^\*]+)\*/g, "<em>$1</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>");

    // Underline
    parsed = parsed.replace(/__(.*?)__/g, "<u>$1</u>");

    // Strikethrough
    parsed = parsed.replace(/~~(.*?)~~/g, "<del>$1</del>");

    // Code blocks
    parsed = parsed.replace(
      /```([\s\S]*?)```/g,
      '<div class="chatlog__markdown-pre chatlog__markdown-pre--multiline">$1</div>',
    );

    // Inline code
    parsed = parsed.replace(
      /`([^`]+)`/g,
      '<span class="chatlog__markdown-pre chatlog__markdown-pre--inline">$1</span>',
    );

    // Discord Mentions
    parsed = parsed.replace(
      /&lt;@!?(\d+)&gt;/g,
      '<span class="chatlog__markdown-mention">@User</span>',
    );
    parsed = parsed.replace(
      /&lt;@&amp;(\d+)&gt;/g,
      '<span class="chatlog__markdown-mention">@Role</span>',
    );
    parsed = parsed.replace(
      /&lt;#(\d+)&gt;/g,
      '<span class="chatlog__markdown-mention">#Channel</span>',
    );

    // Line breaks
    parsed = parsed.replace(/\n/g, "<br>");

    return parsed;
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
