import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from "discord.js";
import { PRO_ENGINE } from "./config.js";
import {
  THEME,
  EMOJIS,
  UI_COMPONENTS,
  BUTTON_STYLES,
} from "../../config/theme.js";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Build a standard ticketing footer
 * @param {import('discord.js').Client} [client]
 * @returns {{ text: string, iconURL?: string }}
 */
function ticketFooter(client, panelId = null) {
  const text = panelId
    ? `Ticketing System • ID: ${panelId.split("-").pop()}`
    : "Ticketing System";
  return UI_COMPONENTS.createFooter(
    text,
    client?.user?.displayAvatarURL() ?? undefined,
  );
}

// ─────────────────────────────────────────────
// Panel embeds
// ─────────────────────────────────────────────

/**
 * Create ticket panel embed (shown publicly in the server channel)
 * @param {Object} options
 * @param {string} [options.title]
 * @param {string} [options.description]
 * @param {import('discord.js').ColorResolvable} [options.color]
 * @param {string} [options.thumbnail]
 * @param {string} [options.image]
 * @param {number} [options.ticketCount]
 * @param {string} [options.waitTime]
 * @param {{ text: string, iconURL?: string }} [options.footer]
 * @param {string} [options.panelId]
 * @param {import('discord.js').Client} [options.client]
 * @returns {EmbedBuilder}
 */
export function createPanelEmbed(options) {
  const {
    title = "Support Tickets",
    description = "Click a button below to create a ticket",
    color = THEME.PRIMARY,
    footer,
    thumbnail,
    image,
    ticketCount,
    waitTime,
    panelId,
    client,
  } = options;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter(footer ?? ticketFooter(client, panelId))
    .setTimestamp();

  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);

  if (ticketCount !== undefined || waitTime !== undefined) {
    const fields = [];
    if (ticketCount !== undefined) {
      fields.push({
        name: "Open Tickets",
        value: ticketCount.toString(),
        inline: true,
      });
    }
    if (waitTime !== undefined) {
      fields.push({ name: "Avg Wait", value: waitTime, inline: true });
    }
    embed.addFields(fields);
  }

  return embed;
}

// ─────────────────────────────────────────────
// Ticket lifecycle embeds
// ─────────────────────────────────────────────

/**
 * Create ticket welcome embed (sent inside the ticket channel on creation)
 * @param {Object} options
 * @param {string} options.ticketId
 * @param {string} options.ticketNumber
 * @param {string} options.userName
 * @param {Object} [options.category]
 * @param {string} [options.category.label]
 * @param {string} [options.category.description]
 * @param {import('discord.js').ColorResolvable} [options.category.color]
 * @param {import('discord.js').Client} [options.client]
 * @returns {EmbedBuilder}
 */
export function createTicketWelcomeEmbed(options) {
  const { ticketNumber, userName, category, client } = options;

  const categoryLabel = category?.label || "General Support";
  const defaultDescription =
    `Welcome, **${userName}**! A staff member will be with you shortly.\n\n` +
    `**How can we help you today?**\n` +
    `> Please describe your issue in as much detail as possible.\n` +
    `> Include screenshots, links, or any relevant context.\n`;

  const customDescription = category?.description
    ? `Welcome, **${userName}**! A staff member will be with you shortly.\n\n${category.description}`
    : defaultDescription;

  // Use category color if available, otherwise default to primary theme
  const embedColor = category?.color || THEME.PRIMARY;

  return new EmbedBuilder()
    .setTitle(`${categoryLabel}  •  #${ticketNumber}`)
    .setDescription(customDescription)
    .addFields(
      {
        name: "Category",
        value: `\`${categoryLabel}\``,
        inline: true,
      },
      {
        name: "Ticket ID",
        value: `\`#${ticketNumber}\``,
        inline: true,
      },
    )
    .setColor(embedColor)
    .setFooter(ticketFooter(client))
    .setTimestamp();
}

/**
 * Create ticket claimed embed
 * @param {string} staffName
 * @param {import('discord.js').Client} [client]
 * @returns {EmbedBuilder}
 */
export function createTicketClaimedEmbed(staffName, client) {
  return new EmbedBuilder()
    .setTitle(`${EMOJIS.STATUS.SUCCESS} Ticket Claimed`)
    .setDescription(`**${staffName}** is now handling your ticket!`)
    .setColor(THEME.SUCCESS)
    .setFooter(ticketFooter(client))
    .setTimestamp();
}

/**
 * Create ticket closed embed
 * @param {Object} options
 * @param {string} options.ticketNumber
 * @param {string} options.closedBy
 * @param {string} [options.reason]
 * @param {string} [options.duration]
 * @param {import('discord.js').Client} [options.client]
 * @returns {EmbedBuilder}
 */
export function createTicketClosedEmbed(options) {
  const { ticketNumber, closedBy, reason, duration, client } = options;

  const fields = [{ name: "Closed By", value: closedBy, inline: true }];

  if (reason) {
    fields.push({ name: "Reason", value: reason, inline: false });
  }
  if (duration) {
    fields.push({ name: "Duration", value: duration, inline: true });
  }

  return new EmbedBuilder()
    .setTitle(`Ticket #${ticketNumber} Closed`)
    .setDescription(
      "This ticket has been closed and a transcript has been saved.",
    )
    .addFields(fields)
    .setColor(THEME.ERROR)
    .setFooter(ticketFooter(client))
    .setTimestamp();
}

/**
 * Create transcript log embed (sent to the logs channel)
 * @param {Object} options
 * @param {string} options.ticketId
 * @param {string} options.userName
 * @param {string} options.userId
 * @param {string} options.closedBy
 * @param {string} [options.reason]
 * @param {string} [options.duration]
 * @param {any[]} [options.messages]
 * @param {import('discord.js').Client} [options.client]
 * @returns {EmbedBuilder}
 */
export function createTranscriptLogEmbed(options) {
  const { ticketId, userId, closedBy, reason, duration, messages, client } =
    options;

  const embed = new EmbedBuilder()
    .setTitle(`Ticket Log  •  #${ticketId.split("-").pop()}`)
    .setDescription(`A ticket has been closed and the transcript is attached.`)
    .setColor(THEME.INFO)
    .addFields(
      {
        name: "Ticket Owner",
        value: `<@${userId}>`,
        inline: true,
      },
      { name: "Closed By", value: `${closedBy}`, inline: true },
      { name: "Duration", value: duration || "Unknown", inline: true },
      {
        name: "Messages",
        value: messages?.length?.toString() || "0",
        inline: true,
      },
    )
    .setFooter(ticketFooter(client))
    .setTimestamp();

  if (reason) {
    embed.addFields({ name: "Reason", value: reason, inline: false });
  }

  return embed;
}

/**
 * Create staff alert embed (notification channel)
 * @param {Object} options
 * @param {string} options.ticketId
 * @param {string} options.ticketNumber
 * @param {string} options.userName
 * @param {string} options.userId
 * @param {string} options.channelId
 * @param {string} [options.channelName]
 * @param {string} [options.guildId]
 * @param {Object} [options.category]
 * @param {import('discord.js').Client} [options.client]
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createStaffAlertEmbed(options) {
  const {
    ticketNumber,
    userName,
    userId,
    category,
    client,
    guildId,
    channelName,
  } = options;
  const categoryLabel = category?.label || "General Support";

  // Use a direct link instead of a mention to avoid the "#unknown" issue for staff not in the thread
  const threadDisplay = guildId
    ? `[${channelName || `ticket-${ticketNumber}`}](https://discord.com/channels/${guildId}/${options.channelId})`
    : `<#${options.channelId}>`;

  return new EmbedBuilder()
    .setTitle(`🎫 New Ticket: #${ticketNumber}`)
    .setDescription(
      `A new support ticket has been opened and is waiting for a staff member.\n\n` +
        `**Member:** <@${userId}> (${userName})\n` +
        `**Category:** \`${categoryLabel}\`\n` +
        `**Thread:** ${threadDisplay}`,
    )
    .setColor(category?.color || THEME.PRIMARY)
    .setFooter(ticketFooter(client))
    .setTimestamp();
}

// ─────────────────────────────────────────────
// Limit embeds
// ─────────────────────────────────────────────

/**
 * Create limit reached embed
 * @param {Object} options
 * @param {string} [options.type]
 * @param {number} options.current
 * @param {number} options.max
 * @param {boolean} options.isPro
 * @param {import('discord.js').Client} [options.client]
 * @returns {EmbedBuilder}
 */
export function createLimitReachedEmbed(options) {
  const { type = "ticket", current, max, isPro, client } = options;

  const title =
    type === "ticket" ? "Ticket Limit Reached" : "Panel Limit Reached";
  const itemType = type === "ticket" ? "tickets" : "panels";

  const description = isPro
    ? `You have reached the maximum of **${max} ${itemType}**.`
    : `You have reached the maximum of **${max} ${itemType}** on the Free Tier.\n\n**Upgrade to Pro Engine** for up to ${PRO_ENGINE.MAX_TICKETS_PER_MONTH} ${itemType}/month!`;

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .addFields({
      name: "Current Usage",
      value: `${current} / ${max}`,
      inline: true,
    })
    .setColor(isPro ? THEME.WARNING : THEME.ERROR)
    .setFooter(ticketFooter(client))
    .setTimestamp();
}

// ─────────────────────────────────────────────
// Utility embeds (error / success / info)
// ─────────────────────────────────────────────

/**
 * Create error embed
 * @param {string} message
 * @param {string} [title]
 * @param {import('discord.js').Client} [client]
 * @returns {EmbedBuilder}
 */
export function createErrorEmbed(message, title = "Error", client) {
  return new EmbedBuilder()
    .setTitle(`${EMOJIS.STATUS.ERROR} ${title}`)
    .setDescription(message)
    .setColor(THEME.ERROR)
    .setFooter(ticketFooter(client))
    .setTimestamp();
}

/**
 * Create success embed
 * @param {string} message
 * @param {string} [title]
 * @param {import('discord.js').Client} [client]
 * @returns {EmbedBuilder}
 */
export function createSuccessEmbed(message, title = "Success", client) {
  return new EmbedBuilder()
    .setTitle(`${EMOJIS.STATUS.SUCCESS} ${title}`)
    .setDescription(message)
    .setColor(THEME.SUCCESS)
    .setFooter(ticketFooter(client))
    .setTimestamp();
}

/**
 * Create info embed
 * @param {string} title
 * @param {string} description
 * @param {import('discord.js').Client} [client]
 * @returns {EmbedBuilder}
 */
export function createInfoEmbed(title, description, client) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(THEME.INFO)
    .setFooter(ticketFooter(client))
    .setTimestamp();
}

// ─────────────────────────────────────────────
// Button factories
// ─────────────────────────────────────────────

/**
 * Create ticket panel buttons
 * @param {Array} categories
 * @returns {ActionRowBuilder<ButtonBuilder>[]}
 */
export function createPanelButtons(categories) {
  const buttons = categories.map((cat, index) =>
    new ButtonBuilder()
      .setCustomId(`ticket_create_${cat.id || index}`)
      .setLabel(cat.label || "Support")
      .setEmoji(cat.emoji || "📧")
      .setStyle(BUTTON_STYLES.PRIMARY),
  );

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(
      /** @type {ActionRowBuilder<ButtonBuilder>} */
      (new ActionRowBuilder().addComponents(buttons.slice(i, i + 5))),
    );
  }
  return rows;
}

/**
 * Create ticket action buttons (inside ticket channel)
 * @param {Object} options
 * @returns {ActionRowBuilder<ButtonBuilder>[]}
 */
export function createTicketActionButtons(options = {}) {
  const {
    canClaim = true,
    canClose = true,
    canAddUser = true,
    isClaimed = false,
  } = options;

  const buttons = [];

  if (canClaim && !isClaimed) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("Claim")
        .setEmoji("✋")
        .setStyle(BUTTON_STYLES.SUCCESS),
    );
  }

  if (canClose) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("Close Ticket")
        .setEmoji("🔒")
        .setStyle(BUTTON_STYLES.DANGER),
    );
  }

  if (canAddUser) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("ticket_add_user")
        .setLabel("Add User")
        .setEmoji("👥")
        .setStyle(BUTTON_STYLES.SECONDARY),
    );
  }

  if (isClaimed) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("ticket_transfer")
        .setLabel("Transfer")
        .setEmoji("🔄")
        .setStyle(BUTTON_STYLES.SECONDARY),
    );
  }

  return buttons.length > 0
    ? [
        /** @type {ActionRowBuilder<ButtonBuilder>} */ (
          new ActionRowBuilder().addComponents(buttons)
        ),
      ]
    : [];
}

/**
 * Create staff alert buttons (sent to staff-only channel)
 * @param {Object} options
 * @param {string} options.ticketId
 * @returns {ActionRowBuilder<ButtonBuilder>[]}
 */
export function createStaffAlertButtons(options) {
  const { ticketId } = options;

  return [
    /** @type {ActionRowBuilder<ButtonBuilder>} */ (
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_claim_external_${ticketId}`)
          .setLabel("Claim Ticket")
          .setEmoji("🎟️")
          .setStyle(BUTTON_STYLES.PRIMARY),
      )
    ),
  ];
}

/**
 * Create confirmation buttons
 * @param {string} confirmId
 * @param {string} cancelId
 * @param {string} confirmLabel
 * @param {string} cancelLabel
 * @returns {ActionRowBuilder<ButtonBuilder>}
 */
export function createConfirmationButtons(
  confirmId = "confirm",
  cancelId = "cancel",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
) {
  return /** @type {ActionRowBuilder<ButtonBuilder>} */ (
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel(confirmLabel)
        .setStyle(BUTTON_STYLES.SUCCESS),
      new ButtonBuilder()
        .setCustomId(cancelId)
        .setLabel(cancelLabel)
        .setStyle(BUTTON_STYLES.SECONDARY),
    )
  );
}
