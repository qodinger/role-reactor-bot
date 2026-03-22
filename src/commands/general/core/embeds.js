import { EMOJIS, THEME } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";

// Get custom emojis object
const { customEmojis } = emojiConfig;

/**
 * Creates an enhanced balance embed showing user's Core credits, tier, and stats
 * @param {Object} userData - User's Core credit data
 * @param {string} username - User's name for profiling
 * @param {string} avatarURL - User's avatar URL
 * @param {Object} [options={}] - Additional metadata for the embed
 * @param {Object|null} [options.voteStatus] - User's voting status and stats
 * @param {boolean} [options.isServerPro] - Whether the guild has Pro Engine active
 * @param {Object|null} [options.client] - Discord client for fetching footer icons
 * @returns {Object} Discord embed object
 */
export function createBalanceEmbed(
  userData,
  username,
  avatarURL,
  options = {},
) {
  const { voteStatus = null, client = null } = options;

  const totalCredits = userData.credits || 0;
  const isPro = totalCredits > 0;

  const fields = [
    {
      name: `Total Balance`,
      value: `${customEmojis.core} **${totalCredits.toLocaleString()}**`,
      inline: true,
    },
  ];

  // Add vote stats if available
  if (voteStatus) {
    let nextVoteText = "✅ **Ready!**";
    if (!voteStatus.canVote && voteStatus.nextVote) {
      nextVoteText = `<t:${Math.floor(voteStatus.nextVote.getTime() / 1000)}:R>`;
    }

    fields.push({
      name: "Vote Stats",
      value: `Total: **${voteStatus.totalVotes || 0}**\nNext: ${nextVoteText}`,
      inline: false,
    });
  }

  return {
    color: isPro ? THEME.PRIMARY : 0x808080,
    author: {
      name: `${username}'s Core Profile`,
      icon_url: avatarURL,
    },
    description: isPro
      ? "You have active Core Energy! You can use it for AI generations and other premium features."
      : "You currently have no Core Energy. Vote or visit our website to get some!",
    fields,
    footer: {
      text: "Core Energy • Your Universal Currency",
      icon_url: client?.user?.displayAvatarURL(),
    },
  };
}

/**
 * Creates an error embed for command failures
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @param {string} botAvatarURL - Bot's avatar URL for footer
 * @returns {Object} Discord embed object
 */
export function createErrorEmbed(title, description, botAvatarURL) {
  return {
    color: THEME.ERROR,
    title: `${EMOJIS.STATUS.ERROR} ${title}`,
    description,
    timestamp: new Date().toISOString(),
    footer: {
      text: "Core Energy • Error",
      icon_url: botAvatarURL,
    },
  };
}

/**
 * Creates a validation error embed
 * @param {Array<string>} errors - Array of error messages
 * @param {Object} client - Discord client
 * @returns {Object} Discord embed object
 */
export function createValidationErrorEmbed(errors, client) {
  return {
    color: THEME.ERROR,
    title: `${EMOJIS.STATUS.ERROR} Validation Error`,
    description: "Please fix the following errors:",
    fields: [
      {
        name: "Errors",
        value: errors
          .map((error, index) => `${index + 1}. ${error}`)
          .join("\n"),
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Core Energy • Input Validation",
      icon_url: client.user.displayAvatarURL(),
    },
  };
}
