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
  const subscriptionCredits = userData.subscriptionCredits || 0;
  const bonusCredits = userData.bonusCredits || 0;

  // Build breakdown text - show only if there are credits
  let breakdownText = "";
  if (subscriptionCredits > 0 && bonusCredits > 0) {
    // Legacy case: both subscription and bonus credits
    breakdownText = `Subscription: ${subscriptionCredits} ${customEmojis.core}\nBonus: ${bonusCredits} ${customEmojis.core}`;
  } else if (subscriptionCredits > 0) {
    // Legacy case: only subscription credits
    breakdownText = `Subscription: ${subscriptionCredits} ${customEmojis.core}`;
  } else if (bonusCredits > 0) {
    // Current case: only bonus credits (from crypto payments)
    breakdownText = `Bonus: ${bonusCredits} ${customEmojis.core}`;
  }

  const fields = [
    {
      name: `Tier`,
      value: tierDisplay,
      inline: true,
    },
    {
      name: `Total Balance`,
      value: `${customEmojis.core} ${userData.credits}`,
      inline: true,
    },
  ];

  // Only add breakdown field if there are credits to show
  if (breakdownText) {
    fields.push({
      name: `Core Breakdown`,
      value: breakdownText,
      inline: false,
    });
  }

  // Add payment link field
  fields.push({
    name: `Get More Cores`,
    value: `[Purchase Cores](https://rolereactor.app/sponsor) • View \`/core pricing\``,
    inline: false,
  });

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
 * Creates a pricing embed showing Core pricing and membership benefits
 * @param {string} botAvatarURL - Bot's avatar URL for footer
 * @returns {Object} Discord embed object
 */
export function createPricingEmbed(botAvatarURL) {
  const pricing = getCorePricing();

  // Format one-time payment pricing (crypto payments only)
  const paymentPricing = Object.entries(pricing.donations)
    .map(([price, credits]) => `**${price}** → ${credits} ${customEmojis.core}`)
    .join("\n");

  // Format benefits (updated for one-time payments)
  const benefits = [
    "Never expires",
    "Instant delivery",
    "Secure crypto payments",
    "10 Cores per $1",
  ].join(" • ");

  return {
    color: THEME.PRIMARY,
    title: `Core Pricing`,
    description: "Purchase Core credits with cryptocurrency (one-time payment)",
    fields: [
      {
        name: `Pricing`,
        value: paymentPricing,
        inline: false,
      },
      {
        name: `Benefits`,
        value: benefits,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Purchase on website • Use /core balance to check balance",
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
