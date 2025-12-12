import { THEME, EMOJIS } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";

const { customEmojis } = emojiConfig;

/**
 * Create payment embed
 * @param {import('discord.js').User} user - Discord user
 * @param {Object} paymentInfo - Payment information
 * @param {string} botAvatarURL - Bot avatar URL
 * @returns {Object} Discord embed object
 */
export function createPaymentEmbed(user, paymentInfo, botAvatarURL) {
  const { type, amount, cores, currency, tier } = paymentInfo;

  const title =
    type === "subscription"
      ? `💳 Subscribe to ${tier}`
      : `💳 Core Credits Payment`;

  const description =
    type === "subscription"
      ? `Subscribe to **${tier}** and get **${cores} Cores** monthly for **$${amount}/${currency}**`
      : `Get **${cores} Cores** for **$${amount} ${currency}**`;

  const fields = [
    {
      name: "Payment Method",
      value: "🪙 Cryptocurrency (USDT, BTC, ETH, etc.)",
      inline: false,
    },
    {
      name: type === "subscription" ? "Monthly Credits" : "Credits",
      value: `${customEmojis.core} ${cores} Cores`,
      inline: true,
    },
    {
      name: "Amount",
      value: `$${amount} ${currency}`,
      inline: true,
    },
  ];

  if (type === "subscription") {
    fields.push({
      name: "Subscription Type",
      value: "🔄 Monthly Recurring",
      inline: false,
    });
  }

  return {
    color: THEME.PRIMARY,
    title,
    description,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: "Click the button below to complete payment",
      icon_url: botAvatarURL,
    },
    // Note: Discord.js v14 supports buttons, but we'll use a link in description for now
    // You can add buttons using ActionRowBuilder and ButtonBuilder if needed
  };
}

/**
 * Create error embed
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @param {string} botAvatarURL - Bot avatar URL
 * @returns {Object} Discord embed object
 */
export function createErrorEmbed(title, description, botAvatarURL) {
  return {
    color: THEME.ERROR,
    title: `${EMOJIS.STATUS.ERROR} ${title}`,
    description,
    timestamp: new Date().toISOString(),
    footer: {
      text: "Core Payment • Error",
      icon_url: botAvatarURL,
    },
  };
}
