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
  // Determine tier display with proper badge emoji
  let tierDisplay;
  if (userData.isCore && userData.coreTier) {
    switch (userData.coreTier) {
      case "Core Basic":
        tierDisplay = `${customEmojis.coreBasic} Core Basic`;
        break;
      case "Core Premium":
        tierDisplay = `${customEmojis.premiumBadge} Core Premium`;
        break;
      case "Core Elite":
        tierDisplay = `${customEmojis.eliteBadge} Core Elite`;
        break;
      default:
        tierDisplay = `${customEmojis.core} ${userData.coreTier}`;
    }
  } else if (userData.isCore) {
    tierDisplay = `${customEmojis.core} Core Member`;
  } else {
    tierDisplay = "Regular";
  }

  return {
    color: THEME.PRIMARY,
    author: {
      name: `${username}`,
      icon_url: avatarURL,
    },
    fields: [
      {
        name: `**Tier**`,
        value: tierDisplay,
        inline: true,
      },
      {
        name: `**Balance**`,
        value: `${customEmojis.core} ${userData.credits}`,
        inline: true,
      },
      {
        name: ``,
        value: `[Get more Cores on Ko-fi](https://ko-fi.com/rolereactor) • View \`/core pricing\``,
        inline: false,
      },
    ],
  };
}

/**
 * Creates a pricing embed showing Core pricing and membership benefits
 * @param {string} botAvatarURL - Bot's avatar URL for footer
 * @returns {Object} Discord embed object
 */
export function createPricingEmbed(botAvatarURL) {
  return {
    color: THEME.PRIMARY,
    title: `Core Pricing`,
    fields: [
      {
        name: `**One-time Donations**`,
        value: `**$10** → 100 ${customEmojis.core}\n**$25** → 250 ${customEmojis.core}\n**$50** → 500 ${customEmojis.core}`,
        inline: true,
      },
      {
        name: `**Core Membership**`,
        value: `**Basic** $10/mo → 150 ${customEmojis.core}\n**Premium** $25/mo → 400 ${customEmojis.core}\n**Elite** $50/mo → 850 ${customEmojis.core}`,
        inline: true,
      },
      {
        name: `Core Benefits`,
        value: `Priority processing • Monthly bonuses • Better value`,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: `Donate on Ko-fi • Use /core balance to check balance`,
      icon_url: botAvatarURL,
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
