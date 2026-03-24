/**
 * Giveaway Components - Buttons and select menus
 * @module commands/admin/giveaway/components
 */

import { ButtonBuilder, ActionRowBuilder } from "discord.js";
import { BUTTON_STYLES, EMOJIS } from "../../../config/theme.js";

/**
 * Create pagination buttons for the giveaway list
 * @param {number} currentPage 
 * @param {number} totalPages 
 * @param {boolean} showAll 
 * @returns {ActionRowBuilder}
 */
export function createListPaginationButtons(currentPage, totalPages, showAll) {
  const row = new ActionRowBuilder();
  const filter = showAll ? "all" : "act";

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_page:${filter}:${Math.max(1, currentPage - 1)}`)
      .setLabel("Previous")
      .setStyle(BUTTON_STYLES.SECONDARY)
      .setEmoji(EMOJIS.ACTIONS.BACK)
      .setDisabled(currentPage <= 1),
    
    new ButtonBuilder()
      .setCustomId(`giveaway_page:info:${currentPage}`)
      .setLabel(`Page ${currentPage}/${totalPages}`)
      .setStyle(BUTTON_STYLES.PRIMARY)
      .setDisabled(true),

    new ButtonBuilder()
      .setCustomId(`giveaway_page:${filter}:${Math.min(totalPages, currentPage + 1)}`)
      .setLabel("Next")
      .setStyle(BUTTON_STYLES.SECONDARY)
      .setEmoji(EMOJIS.ACTIONS.FORWARD)
      .setDisabled(currentPage >= totalPages)
  );
  return row;
}

/**
 * Create the enter giveaway button
 * @param {string} giveawayId - Giveaway ID
 * @returns {ButtonBuilder}
 */
export function createEnterButton(giveawayId) {
  return new ButtonBuilder()
    .setCustomId(createCustomId("giveaway_enter", giveawayId))
    .setLabel("Enter Giveaway")
    .setStyle(BUTTON_STYLES.PRIMARY)
    .setEmoji("🎁");
}

/**
 * Create the end giveaway button (admin only)
 * @param {string} giveawayId - Giveaway ID
 * @returns {ButtonBuilder}
 */
export function createEndButton(giveawayId) {
  return new ButtonBuilder()
    .setCustomId(createCustomId("giveaway_end", giveawayId))
    .setLabel("End Giveaway")
    .setStyle(BUTTON_STYLES.DANGER)
    .setEmoji("🏁");
}

/**
 * Create the reroll button (admin only)
 * @param {string} giveawayId - Giveaway ID
 * @returns {ButtonBuilder}
 */
export function createRerollButton(giveawayId) {
  return new ButtonBuilder()
    .setCustomId(createCustomId("giveaway_reroll", giveawayId))
    .setLabel("Reroll")
    .setStyle(BUTTON_STYLES.SECONDARY)
    .setEmoji("🔄");
}

/**
 * Create the cancel button (admin only)
 * @param {string} giveawayId - Giveaway ID
 * @returns {ButtonBuilder}
 */
export function createCancelButton(giveawayId) {
  return new ButtonBuilder()
    .setCustomId(createCustomId("giveaway_cancel", giveawayId))
    .setLabel("Cancel")
    .setStyle(BUTTON_STYLES.DANGER);
}

/**
 * Create the mark complete button (admin only)
 * @param {string} giveawayId - Giveaway ID
 * @returns {ButtonBuilder}
 */
export function createCompleteButton(giveawayId) {
  return new ButtonBuilder()
    .setCustomId(createCustomId("giveaway_complete", giveawayId))
    .setLabel("Mark Complete")
    .setStyle(BUTTON_STYLES.SUCCESS);
}

/**
 * Create action row for active giveaway
 * @param {string} giveawayId - Giveaway ID
 * @returns {ActionRowBuilder}
 */
export function createActiveGiveawayActions(giveawayId) {
  return new ActionRowBuilder().addComponents(createEnterButton(giveawayId));
}

/**
 * Create action row for ended giveaway (admin actions)
 * @param {string} giveawayId - Giveaway ID
 * @param {boolean} showAll - Show all admin buttons
 * @returns {ActionRowBuilder}
 */
export function createEndedGiveawayActions(giveawayId, showAll = true) {
  const row = new ActionRowBuilder();

  if (showAll) {
    row.addComponents(
      createRerollButton(giveawayId),
      createCompleteButton(giveawayId),
      createCancelButton(giveawayId),
    );
  } else {
    row.addComponents(createRerollButton(giveawayId));
  }

  return row;
}

/**
 * Create action row for giveaway management
 * @param {string} giveawayId - Giveaway ID
 * @returns {ActionRowBuilder}
 */
export function createManagementActions(giveawayId) {
  return new ActionRowBuilder().addComponents(
    createEndButton(giveawayId),
    createCancelButton(giveawayId),
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
