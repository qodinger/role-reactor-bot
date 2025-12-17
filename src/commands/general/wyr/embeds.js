import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";
import { parseQuestionOptions } from "./utils.js";

/**
 * Calculate percentage for vote visualization
 * @param {number} current - Current votes
 * @param {number} total - Total votes
 * @returns {number} Percentage (0-100)
 */
function calculatePercentage(current, total) {
  if (total === 0) {
    return 0;
  }
  return Math.round((current / total) * 100);
}

/**
 * Create Would You Rather embed
 * @param {string} question - The WYR question
 * @param {import('discord.js').User} user - User who requested the question
 * @param {Object} voteCounts - Vote counts { option1: number, option2: number, total: number }
 * @returns {EmbedBuilder}
 */
export function createWYREmbed(
  question,
  user,
  voteCounts = { option1: 0, option2: 0, total: 0 },
) {
  const { option1, option2, total } = voteCounts;
  const options = parseQuestionOptions(question);

  // Build description with question and options
  let description = `**${question}**\n\n`;

  // Always show percentage and vote count (even when 0)
  const option1Percent = calculatePercentage(option1, total);
  const option2Percent = calculatePercentage(option2, total);

  description += `${EMOJIS.NUMBERS.ONE} **${options.option1}**\n**${option1Percent}%** (${option1} ${option1 === 1 ? "vote" : "votes"})\n\n`;
  description += `${EMOJIS.NUMBERS.TWO} **${options.option2}**\n**${option2Percent}%** (${option2} ${option2 === 1 ? "vote" : "votes"})\n\n`;
  description += `${EMOJIS.UI.VOTE} **${total}** ${total === 1 ? "vote" : "votes"}`;

  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.UI.QUESTION} Would You Rather?`)
    .setDescription(description);
}

/**
 * Create error embed for WYR command
 * @returns {EmbedBuilder}
 */
export function createErrorEmbed() {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
    .setDescription("Failed to generate a question. Please try again later.");
}
