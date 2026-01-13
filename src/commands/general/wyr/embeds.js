import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";
import { parseQuestionOptions } from "./utils.js";

/**
 * Get category emoji and color
 * @param {string} question - The WYR question to determine category
 * @returns {Object} Category info with emoji and color
 */
function getCategoryInfo(question) {
  // Simple category detection based on keywords in the question
  const lowerQuestion = question.toLowerCase();

  if (
    lowerQuestion.includes("superhero") ||
    lowerQuestion.includes("power") ||
    lowerQuestion.includes("fly") ||
    lowerQuestion.includes("invisible") ||
    lowerQuestion.includes("teleport") ||
    lowerQuestion.includes("super") ||
    lowerQuestion.includes("laser") ||
    lowerQuestion.includes("telekinesis")
  ) {
    return { emoji: "🦸", name: "Superhero", color: 0x3498db };
  }
  if (
    lowerQuestion.includes("duck") ||
    lowerQuestion.includes("sing") ||
    lowerQuestion.includes("dance") ||
    lowerQuestion.includes("sneeze") ||
    lowerQuestion.includes("clown") ||
    lowerQuestion.includes("fart") ||
    lowerQuestion.includes("armpit") ||
    lowerQuestion.includes("spaghetti") ||
    lowerQuestion.includes("tutu")
  ) {
    return { emoji: "😂", name: "Funny", color: 0xf39c12 };
  }
  if (
    lowerQuestion.includes("internet") ||
    lowerQuestion.includes("phone") ||
    lowerQuestion.includes("wifi") ||
    lowerQuestion.includes("tiktok") ||
    lowerQuestion.includes("youtube") ||
    lowerQuestion.includes("social media") ||
    lowerQuestion.includes("battery") ||
    lowerQuestion.includes("technology") ||
    lowerQuestion.includes("autocorrect")
  ) {
    return { emoji: "📱", name: "Technology", color: 0x1abc9c };
  }
  if (
    lowerQuestion.includes("marry") ||
    lowerQuestion.includes("date") ||
    lowerQuestion.includes("relationship") ||
    lowerQuestion.includes("partner") ||
    lowerQuestion.includes("crush") ||
    lowerQuestion.includes("best friend") ||
    lowerQuestion.includes("ex") ||
    lowerQuestion.includes("love")
  ) {
    return { emoji: "💕", name: "Relationships", color: 0xe91e63 };
  }
  if (
    lowerQuestion.includes("eat") ||
    lowerQuestion.includes("food") ||
    lowerQuestion.includes("taste") ||
    lowerQuestion.includes("pizza") ||
    lowerQuestion.includes("chocolate") ||
    lowerQuestion.includes("meal") ||
    lowerQuestion.includes("cook") ||
    lowerQuestion.includes("spicy") ||
    lowerQuestion.includes("sweet")
  ) {
    return { emoji: "🍕", name: "Food", color: 0xff6b35 };
  }
  if (
    lowerQuestion.includes("explore") ||
    lowerQuestion.includes("travel") ||
    lowerQuestion.includes("adventure") ||
    lowerQuestion.includes("climb") ||
    lowerQuestion.includes("ocean") ||
    lowerQuestion.includes("mountain") ||
    lowerQuestion.includes("jungle") ||
    lowerQuestion.includes("skydiving") ||
    lowerQuestion.includes("safari")
  ) {
    return { emoji: "🏔️", name: "Adventure", color: 0x27ae60 };
  }
  if (
    lowerQuestion.includes("truth") ||
    lowerQuestion.includes("forever") ||
    lowerQuestion.includes("memory") ||
    lowerQuestion.includes("die") ||
    lowerQuestion.includes("meaning") ||
    lowerQuestion.includes("save") ||
    lowerQuestion.includes("stranger") ||
    lowerQuestion.includes("wisdom") ||
    lowerQuestion.includes("moral")
  ) {
    return { emoji: "🤔", name: "Philosophical", color: 0x9b59b6 };
  }
  if (
    lowerQuestion.includes("movie") ||
    lowerQuestion.includes("character") ||
    lowerQuestion.includes("celebrity") ||
    lowerQuestion.includes("marvel") ||
    lowerQuestion.includes("pokemon") ||
    lowerQuestion.includes("harry potter") ||
    lowerQuestion.includes("star wars") ||
    lowerQuestion.includes("disney") ||
    lowerQuestion.includes("netflix") ||
    lowerQuestion.includes("taylor swift")
  ) {
    return { emoji: "🎬", name: "Pop Culture", color: 0xe91e63 };
  }
  if (
    lowerQuestion.includes("memories") ||
    lowerQuestion.includes("communicate") ||
    lowerQuestion.includes("immortal") ||
    lowerQuestion.includes("disaster") ||
    lowerQuestion.includes("cure") ||
    lowerQuestion.includes("sacrifice") ||
    lowerQuestion.includes("surveillance") ||
    lowerQuestion.includes("enemy")
  ) {
    return { emoji: "🔥", name: "Challenging", color: 0xe74c3c };
  }
  if (
    lowerQuestion.includes("remote") ||
    lowerQuestion.includes("work from home") ||
    lowerQuestion.includes("digital nomad") ||
    lowerQuestion.includes("influencer") ||
    lowerQuestion.includes("subscription") ||
    lowerQuestion.includes("delivery") ||
    lowerQuestion.includes("uber") ||
    lowerQuestion.includes("student loan") ||
    lowerQuestion.includes("rent") ||
    lowerQuestion.includes("mortgage") ||
    lowerQuestion.includes("commute")
  ) {
    return { emoji: "💼", name: "Modern Life", color: 0x34495e };
  }

  // Default to life choices
  return { emoji: "🌟", name: "Life Choices", color: 0x2ecc71 };
}

/**
 * Create a visual progress bar for votes
 * @param {number} percentage - Percentage (0-100)
 * @param {number} maxBars - Maximum number of bars to show
 * @returns {string} Progress bar string
 */
function createProgressBar(percentage, maxBars = 15) {
  const filledBars = Math.round((percentage / 100) * maxBars);
  const emptyBars = maxBars - filledBars;

  const filled = "▓".repeat(filledBars);
  const empty = "░".repeat(emptyBars);

  return `${filled}${empty}`;
}

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
 * @param {string} reaction - Fun reaction message (optional) - DEPRECATED
 * @param {string} userTitle - User title for the voter (optional)
 * @returns {EmbedBuilder}
 */
export function createWYREmbed(
  question,
  user,
  voteCounts = { option1: 0, option2: 0, total: 0 },
  _reaction = null, // Deprecated parameter, kept for compatibility
  userTitle = null,
) {
  const { option1, option2, total } = voteCounts;
  const options = parseQuestionOptions(question);
  const categoryInfo = getCategoryInfo(question);

  // Build description with question and options
  let description = `**${question}**\n\n`;

  // Always show percentage and vote count (even when 0)
  const option1Percent = calculatePercentage(option1, total);
  const option2Percent = calculatePercentage(option2, total);

  // Create progress bars for visual appeal
  const option1Bar = createProgressBar(option1Percent);
  const option2Bar = createProgressBar(option2Percent);

  description += `${EMOJIS.NUMBERS.ONE} **${options.option1}**\n`;
  description += `${option1Bar} **${option1Percent}%** (${option1} ${option1 === 1 ? "vote" : "votes"})\n\n`;

  description += `${EMOJIS.NUMBERS.TWO} **${options.option2}**\n`;
  description += `${option2Bar} **${option2Percent}%** (${option2} ${option2 === 1 ? "vote" : "votes"})\n\n`;

  description += `${EMOJIS.UI.VOTE} **Total: ${total}** ${total === 1 ? "vote" : "votes"}`;

  // Add some fun stats for larger vote counts
  if (total >= 10) {
    const winningOption = option1 > option2 ? 1 : option2 > option1 ? 2 : 0;
    if (winningOption === 1) {
      description += `\n\n🏆 Option 1 is winning by ${option1 - option2} vote${option1 - option2 === 1 ? "" : "s"}!`;
    } else if (winningOption === 2) {
      description += `\n\n🏆 Option 2 is winning by ${option2 - option1} vote${option2 - option1 === 1 ? "" : "s"}!`;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(categoryInfo.color)
    .setTitle(`${categoryInfo.emoji} Would You Rather? • ${categoryInfo.name}`)
    .setDescription(description)
    .setFooter({
      text: `${userTitle ? `${user.displayName} • ${userTitle} • ` : ""}Role Reactor`,
      iconURL: user.displayAvatarURL(),
    })
    .setTimestamp();

  return embed;
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
