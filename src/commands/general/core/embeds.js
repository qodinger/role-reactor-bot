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
  const { client = null } = options;

  const totalCredits = userData.credits || 0;
  const totalSparks = Math.floor(userData.sparks || 0);

  const fields = [
    {
      name: `🔮 Paid Cores`,
      value: `**${Number(totalCredits.toFixed(2)).toLocaleString()}** *(Transferable)*`,
      inline: true,
    },
    {
      name: `⚡ Sparks`,
      value: `**${totalSparks.toLocaleString()}** *(Rewards)*`,
      inline: true,
    },
  ];

  return {
    color: THEME.PRIMARY,
    author: {
      name: `${username}'s Core & Sparks Profile`,
      icon_url: avatarURL,
    },
    fields,
    footer: {
      text: "Role Reactor Energy • Cores & Sparks",
      icon_url: client?.user?.displayAvatarURL(),
    },
  };
}

/**
 * Creates a success embed for Core gift transfers
 * @param {Object} data - Gift transfer details
 * @returns {Object} Discord embed object
 */
export function createGiftSuccessEmbed({ senderUser, targetUser, grossAmount, taxAmount, netAmount, client }) {
  return {
    color: THEME.SUCCESS || 0x10b981,
    title: "🎁 Core Gift Transferred!",
    description: `Successfully gifted Cores to **${targetUser.username}**!`,
    fields: [
      {
        name: "Sender",
        value: `<@${senderUser.id}>`,
        inline: true,
      },
      {
        name: "Recipient",
        value: `<@${targetUser.id}>`,
        inline: true,
      },
      {
        name: "Gross Sent",
        value: `🔮 **${grossAmount.toFixed(2)} Cores**`,
        inline: true,
      },
      {
        name: "Transfer Tax (10% Burn)",
        value: `🔥 **${taxAmount.toFixed(2)} Cores**`,
        inline: true,
      },
      {
        name: "Net Received",
        value: `✨ **${netAmount.toFixed(2)} Cores**`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Role Reactor Energy • 10% Deflationary Burn Tax Applied",
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
