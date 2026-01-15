import { EMOJIS, THEME } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";


// Get custom emojis object
const { customEmojis } = emojiConfig;

/**
 * Creates a balance embed showing user's Core credits and tier information
 * @param {Object} userData - User's Core credit data
 * @param {string} username - Username for footer
 * @param {string} avatarURL - User's avatar URL
 * @returns {Object} Discord embed object
 */
export function createBalanceEmbed(userData, username, avatarURL) {
  const totalCredits = userData.credits || 0;

  const fields = [
    {
      name: `Total Balance`,
      value: `${customEmojis.core} ${totalCredits}`,
      inline: true,
    },
  ];



  return {
    color: THEME.PRIMARY,
    author: {
      name: `${username}`,
      icon_url: avatarURL,
    },
    fields,
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
