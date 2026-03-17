/**
 * Giveaway Components - Buttons and select menus
 * @module commands/general/giveaway/components
 */

import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";

/**
 * Create the enter giveaway button
 * @returns {ButtonBuilder}
 */
export function createEnterButton() {
  return new ButtonBuilder()
    .setCustomId("giveaway_enter")
    .setLabel("🎁 Enter Giveaway")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("🎁");
}

/**
 * Create the end giveaway button (admin only)
 * @returns {ButtonBuilder}
 */
export function createEndButton() {
  return new ButtonBuilder()
    .setCustomId("giveaway_end")
    .setLabel("🏁 End Giveaway")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("🏁");
}

/**
 * Create the reroll button (admin only)
 * @returns {ButtonBuilder}
 */
export function createRerollButton() {
  return new ButtonBuilder()
    .setCustomId("giveaway_reroll")
    .setLabel("🔄 Reroll")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("🔄");
}

/**
 * Create the cancel button (admin only)
 * @returns {ButtonBuilder}
 */
export function createCancelButton() {
  return new ButtonBuilder()
    .setCustomId("giveaway_cancel")
    .setLabel("🚫 Cancel")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("🚫");
}

/**
 * Create the mark complete button (admin only)
 * @returns {ButtonBuilder}
 */
export function createCompleteButton() {
  return new ButtonBuilder()
    .setCustomId("giveaway_complete")
    .setLabel("✅ Mark Complete")
    .setStyle(ButtonStyle.Success)
    .setEmoji("✅");
}

/**
 * Create action row for active giveaway
 * @returns {ActionRowBuilder}
 */
export function createActiveGiveawayActions() {
  return new ActionRowBuilder().addComponents(createEnterButton());
}

/**
 * Create action row for ended giveaway (admin actions)
 * @param {boolean} showAll - Show all admin buttons
 * @returns {ActionRowBuilder}
 */
export function createEndedGiveawayActions(showAll = true) {
  const row = new ActionRowBuilder();

  if (showAll) {
    row.addComponents(
      createRerollButton(),
      createCompleteButton(),
      createCancelButton(),
    );
  } else {
    row.addComponents(createRerollButton());
  }

  return row;
}

/**
 * Create action row for giveaway management
 * @returns {ActionRowBuilder}
 */
export function createManagementActions() {
  return new ActionRowBuilder().addComponents(
    createEndButton(),
    createCancelButton(),
  );
}

/**
 * Parse button custom ID to extract data
 * @param {string} customId - Button custom ID
 * @returns {Object} Parsed data
 */
export function parseButtonCustomId(customId) {
  const parts = customId.split(":");

  if (parts.length === 1) {
    return { action: parts[0] };
  }

  return {
    action: parts[0],
    giveawayId: parts[1],
    extra: parts[2] || null,
  };
}

/**
 * Create custom ID for giveaway button
 * @param {string} action - Button action
 * @param {string} giveawayId - Giveaway ID
 * @param {string} extra - Extra data (optional)
 * @returns {string}
 */
export function createCustomId(action, giveawayId, extra = null) {
  if (extra) {
    return `${action}:${giveawayId}:${extra}`;
  }
  return `${action}:${giveawayId}`;
}
