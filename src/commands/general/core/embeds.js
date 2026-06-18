import { EMOJIS, THEME } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";
import {
  getConversionRateInfo,
  getAIFeatureCosts,
} from "../../../config/ai.js";
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
  const { client = null } = options;

  const totalCredits = userData.credits || 0;

  const rateInfo = getConversionRateInfo();
  const featureCosts = getAIFeatureCosts();
  const avatarCost = featureCosts.aiImage ?? 5.0;
  const chatCost = featureCosts.aiChat ?? 0.05;
  const coreValueUSD = `$${rateInfo.coreValueUSD.toFixed(2)}`;

  const fields = [
    {
      name: `Core Balance`,
      value: `${customEmojis.core} **${Number(totalCredits.toFixed(2)).toLocaleString()}**`,
      inline: true,
    },
    {
      name: `Core Value`,
      value: `1 Core ≈ ${coreValueUSD} USD\n${rateInfo.conversionRate} Cores = **$1.00**`,
      inline: true,
    },
    {
      name: `Spending Guide`,
      value: [
        `💬 **AI Chat:** ${chatCost} Core per message (~${Math.floor(1 / chatCost)} messages per Core)`,
        `🖼️ **AI Avatar:** ${avatarCost} Cores each (~${Math.floor(1 / avatarCost * 10) / 10} avatars per Core)`,
        `⚡ **Pro Engine:** 20 Cores/week`,
        `🚀 **Buy Cores:** rolereactor.app`,
      ].join("\n"),
      inline: false,
    },
  ];

  return {
    color: THEME.PRIMARY,
    author: {
      name: `${username}'s Core Profile`,
      icon_url: avatarURL,
    },
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
