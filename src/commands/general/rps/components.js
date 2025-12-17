import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

/**
 * Create challenge buttons for RPS multiplayer
 * @param {string} challengeId - Unique challenge ID
 * @returns {ActionRowBuilder}
 */
export function createChallengeButtons(challengeId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rps_choice-${challengeId}-rock`)
      .setLabel("Rock")
      .setEmoji("🪨")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`rps_choice-${challengeId}-paper`)
      .setLabel("Paper")
      .setEmoji("📄")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`rps_choice-${challengeId}-scissors`)
      .setLabel("Scissors")
      .setEmoji("✂️")
      .setStyle(ButtonStyle.Primary),
  );

  return row;
}
