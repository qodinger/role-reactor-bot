import { EMOJIS, THEME } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";
import { formatTierDisplay, getCorePricing } from "./utils.js";

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
  const tierDisplay = formatTierDisplay(userData);

  return {
    color: THEME.PRIMARY,
    author: {
      name: `${username}`,
      icon_url: avatarURL,
    },
    fields: [
      {
        name: `Tier`,
        value: tierDisplay,
        inline: true,
      },
      {
        name: `Balance`,
        value: `${customEmojis.core} ${userData.credits}`,
        inline: true,
      },
      {
        name: `Get More Cores`,
        value: `[Donate on Ko-fi](https://ko-fi.com/rolereactor) • View \`/core pricing\``,
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
  const pricing = getCorePricing();

  // Format donation pricing
  const donationPricing = Object.entries(pricing.donations)
    .map(([price, credits]) => `**${price}** → ${credits} ${customEmojis.core}`)
    .join("\n");

  // Format subscription pricing
  const subscriptionPricing = Object.entries(pricing.subscriptions)
    .map(([tier, info]) => {
      const tierBadge = emojiConfig.getTierBadge(tier);
      return `**${tierBadge} ${tier}** ${info.price} → ${info.credits} ${customEmojis.core}`;
    })
    .join("\n");

  // Format benefits
  const benefits = pricing.benefits.map(benefit => `${benefit}`).join(" • ");

  return {
    color: THEME.PRIMARY,
    title: `Core Pricing & Benefits`,
    fields: [
      {
        name: `One-time Donations`,
        value: donationPricing,
        inline: true,
      },
      {
        name: `Core Membership`,
        value: subscriptionPricing,
        inline: true,
      },
      {
        name: `Core Benefits`,
        value: benefits,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Donate on Ko-fi • Use /core balance to check balance",
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
