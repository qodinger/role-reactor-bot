import { EmbedBuilder } from "discord.js";
import { THEME, UI_COMPONENTS, EMOJIS } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";

/**
 * Creates a balance embed showing user's Cores & Sparks
 * @param {Object} userData - User's Core credit data
 * @param {string} username - User's name for the author line
 * @param {string} avatarURL - User's avatar URL
 * @param {Object} [options={}] - Additional metadata for the embed
 * @param {Object|null} [options.client] - Discord client for footer icon
 * @returns {EmbedBuilder} Discord embed object
 */
export function createBalanceEmbed(
  userData,
  username,
  avatarURL,
  options = {},
) {
  const { client = null } = options;

  const totalCredits = Number((userData.credits || 0).toFixed(2));
  const totalSparks = Math.floor(userData.sparks || 0);

  const coreEmoji = emojiConfig.core;
  const sparkEmoji = emojiConfig.spark;

  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setAuthor(UI_COMPONENTS.createAuthor(username, avatarURL))
    .setTitle("💳 Currency Balance")
    .addFields(
      {
        name: "Currency",
        value: [`${coreEmoji} Paid Cores`, `${sparkEmoji} Reward Sparks`].join(
          "\n",
        ),
        inline: true,
      },
      {
        name: "Balance",
        value: [
          `**${totalCredits.toLocaleString()}**`,
          `**${totalSparks.toLocaleString()}**`,
        ].join("\n"),
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Core & Sparks Wallet",
        client?.user?.displayAvatarURL(),
      ),
    );
}

/**
 * Creates a success embed for Core send transfers
 * @param {Object} data - Transfer details
 * @returns {EmbedBuilder} Discord embed object
 */
export function createSendSuccessEmbed({
  senderUser,
  targetUser,
  grossAmount,
  taxAmount,
  netAmount,
  client,
}) {
  const coreEmoji = emojiConfig.core;
  const burnEmoji = EMOJIS.CURRENCY.BURN;

  return new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.CURRENCY.TRANSFER} Cores Transferred!`)
    .setAuthor(
      UI_COMPONENTS.createAuthor(
        senderUser.username,
        senderUser.displayAvatarURL(),
      ),
    )
    .setDescription(`Successfully sent Cores to **${targetUser.username}**!`)
    .addFields(
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
        value: `${coreEmoji} **${grossAmount.toFixed(2)} Cores**`,
        inline: true,
      },
      {
        name: "Transfer Tax (10% Burn)",
        value: `${burnEmoji} **${taxAmount.toFixed(2)} Cores**`,
        inline: true,
      },
      {
        name: "Net Received",
        value: `✨ **${netAmount.toFixed(2)} Cores**`,
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "10% Deflationary Burn Tax Applied",
        client?.user?.displayAvatarURL(),
      ),
    );
}

/**
 * Creates a confirmation embed for Core send transfers
 * @param {Object} data - Transfer details
 * @returns {EmbedBuilder} Discord embed object
 */
export function createSendConfirmationEmbed({
  targetUser,
  grossAmount,
  taxAmount,
  netAmount,
  client,
}) {
  const coreEmoji = emojiConfig.core;
  const burnEmoji = EMOJIS.CURRENCY.BURN;

  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.CURRENCY.TRANSFER} Confirm Core Transfer`)
    .setDescription(
      `Are you sure you want to send Paid Cores to **${targetUser.username}**?`,
    )
    .addFields(
      {
        name: "Recipient",
        value: `<@${targetUser.id}>`,
        inline: true,
      },
      {
        name: "You Send",
        value: `${coreEmoji} **${grossAmount.toFixed(2)} Cores**`,
        inline: true,
      },
      {
        name: "Burn Tax (10%)",
        value: `${burnEmoji} **-${taxAmount.toFixed(2)} Cores**`,
        inline: true,
      },
      {
        name: "They Receive",
        value: `✨ **${netAmount.toFixed(2)} Cores**`,
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Confirmation expires in 60s",
        client?.user?.displayAvatarURL(),
      ),
    );
}

/**
 * Creates a cancelled embed for Core transfers
 * @param {string} reason - Reason for cancellation
 * @param {Object} client - Discord client
 * @returns {EmbedBuilder} Discord embed object
 */
export function createSendCancelledEmbed(reason, client) {
  return new EmbedBuilder()
    .setColor(THEME.SECONDARY)
    .setTitle(`${EMOJIS.STATUS.ERROR} Core Transfer Cancelled`)
    .setDescription(reason || "The transfer has been cancelled.")
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Transfer Cancelled",
        client?.user?.displayAvatarURL(),
      ),
    );
}

/**
 * Creates a generic error embed
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @param {string} avatarURL - Client avatar URL
 * @returns {EmbedBuilder} Discord embed object
 */
export function createErrorEmbed(title, description, avatarURL) {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} ${title}`)
    .setDescription(description)
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter("Balance Command Error", avatarURL),
    );
}

/**
 * Creates a validation error embed
 * @param {Array<string>} errors - Array of error messages
 * @param {Object} client - Discord client
 * @returns {EmbedBuilder} Discord embed object
 */
export function createValidationErrorEmbed(errors, client) {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Validation Error`)
    .setDescription("Please fix the following errors:")
    .addFields({
      name: "Errors",
      value: errors.map((error, index) => `${index + 1}. ${error}`).join("\n"),
      inline: false,
    })
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Input Validation Error",
        client?.user?.displayAvatarURL(),
      ),
    );
}
