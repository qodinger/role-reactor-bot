import { EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";
import {
  CHOICE_EMOJIS,
  CHOICE_NAMES,
  determineWinner,
  getResultMessage,
} from "./utils.js";

/**
 * Create Rock Paper Scissors game embed (vs bot)
 * @param {string} playerChoice - Player's choice
 * @param {string} botChoice - Bot's choice
 * @param {import('discord.js').User} user - User who played
 * @returns {EmbedBuilder}
 */
export function createRPSEmbed(playerChoice, botChoice, user) {
  const winner = determineWinner(playerChoice, botChoice, false);
  const resultMessage = getResultMessage(winner);

  // Determine embed color based on result
  let embedColor = THEME.INFO; // Default: tie
  if (winner === "player") {
    embedColor = THEME.SUCCESS; // Green for win
  } else if (winner === "bot") {
    embedColor = THEME.ERROR; // Red for loss
  }

  return new EmbedBuilder()
    .setColor(embedColor)
    .setTitle("Rock Paper Scissors")
    .setDescription(`**${resultMessage}**`)
    .addFields(
      {
        name: `${CHOICE_EMOJIS[playerChoice]} Your Choice`,
        value: `**${CHOICE_NAMES[playerChoice]}**`,
        inline: true,
      },
      {
        name: `${CHOICE_EMOJIS[botChoice]} Bot's Choice`,
        value: `**${CHOICE_NAMES[botChoice]}**`,
        inline: true,
      },
    )
    .setFooter({
      text: `Played by ${user.username} • Role Reactor`,
      iconURL: user.displayAvatarURL(),
    })
    .setTimestamp();
}

/**
 * Create challenge embed for multiplayer RPS
 * @param {import('discord.js').User} challenger - User who challenged
 * @param {import('discord.js').User} challenged - User being challenged
 * @param {string} challengeId - Challenge ID
 * @param {number} createdAt - Timestamp when challenge was created (optional, defaults to now)
 * @returns {EmbedBuilder}
 */
export function createChallengeEmbed(
  challenger,
  challenged,
  challengeId,
  createdAt = Date.now(),
) {
  // Use mention format for clickable user mentions
  const challengerMention = challenger.toString();
  const challengedMention = challenged.toString();
  const challengedName = challenged.displayName || challenged.username;

  // Calculate expiration time (5 minutes from creation)
  const expirationTime = createdAt + 5 * 60 * 1000;
  const expirationTimestamp = Math.floor(expirationTime / 1000);

  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle("Rock Paper Scissors Challenge")
    .setDescription(
      `${challengerMention} has challenged ${challengedMention} to Rock Paper Scissors!\n\n` +
        `${challengedMention}, choose your move below!\n\n` +
        `*Only ${challengedName} can respond to this challenge.*`,
    )
    .addFields({
      name: "⏰ Expires",
      value: `<t:${expirationTimestamp}:R>`,
      inline: true,
    })
    .setFooter({
      text: `Challenge ID: ${challengeId} • Role Reactor`,
    })
    .setTimestamp(createdAt);
}

/**
 * Create multiplayer result embed
 * @param {string} player1Choice - Player 1's choice
 * @param {string} player2Choice - Player 2's choice
 * @param {import('discord.js').User} player1 - Player 1
 * @param {import('discord.js').User} player2 - Player 2
 * @returns {EmbedBuilder}
 */
export function createMultiplayerResultEmbed(
  player1Choice,
  player2Choice,
  player1,
  player2,
) {
  const player1Name = player1.displayName || player1.username;
  const player2Name = player2.displayName || player2.username;
  const player1Mention = player1.toString();
  const player2Mention = player2.toString();

  const winner = determineWinner(player1Choice, player2Choice, true);
  const resultMessage = getResultMessage(winner, {
    player1Name,
    player2Name,
  });

  // Determine embed color based on result
  let embedColor = THEME.INFO; // Default: tie
  if (winner === "player1") {
    embedColor = THEME.SUCCESS; // Green
  } else if (winner === "player2") {
    embedColor = THEME.SUCCESS; // Green (both players can win)
  }

  return new EmbedBuilder()
    .setColor(embedColor)
    .setTitle("Rock Paper Scissors - Result")
    .setDescription(
      `**${resultMessage}**\n\n${player1Mention} vs ${player2Mention}`,
    )
    .addFields(
      {
        name: `${CHOICE_EMOJIS[player1Choice]} ${player1Name}`,
        value: `**${CHOICE_NAMES[player1Choice]}**`,
        inline: true,
      },
      {
        name: `${CHOICE_EMOJIS[player2Choice]} ${player2Name}`,
        value: `**${CHOICE_NAMES[player2Choice]}**`,
        inline: true,
      },
    )
    .setFooter({
      text: `Role Reactor`,
    })
    .setTimestamp();
}

/**
 * Create expired challenge embed
 * @param {Object} challenge - Challenge data
 * @returns {EmbedBuilder}
 */
export function createExpiredChallengeEmbed(challenge) {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle("Rock Paper Scissors Challenge - Expired")
    .setDescription(
      `**${challenge.challengerName}** challenged **${challenge.challengedName}** to Rock Paper Scissors, but the challenge expired after 5 minutes.\n\n` +
        `*This challenge is no longer active. Please create a new challenge to play.*`,
    )
    .setFooter({
      text: `Challenge Expired • Role Reactor`,
    })
    .setTimestamp();
}

/**
 * Create error embed for RPS command
 * @returns {EmbedBuilder}
 */
export function createErrorEmbed() {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle("Error")
    .setDescription("Failed to process your game. Please try again.");
}
