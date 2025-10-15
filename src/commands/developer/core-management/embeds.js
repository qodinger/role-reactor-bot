import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";

const CORE_EMOJI = emojiConfig.customEmojis.core;

// ============================================================================
// CORE MANAGEMENT EMBED BUILDER
// ============================================================================

// New parameter-based function for simple embeds
export function createCoreManagementEmbed(
  type,
  title,
  description,
  fields = [],
) {
  const embed = new EmbedBuilder()
    .setColor(getEmbedColor(type))
    .setTitle(`${title} ${CORE_EMOJI}`)
    .setDescription(description)
    .setTimestamp();

  if (fields && fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

export async function createDetailedCoreManagementEmbed({
  type,
  targetUser,
  amount,
  oldAmount,
  newAmount,
  reason,
  operator,
  userData = null,
}) {
  const embed = new EmbedBuilder()
    .setColor(getEmbedColor(type))
    .setTitle(`${getEmbedTitle(type)} Core Energy`)
    .setDescription(
      getEmbedDescription(type, targetUser, amount, oldAmount, newAmount),
    )
    .setFooter({
      text: `Operator: ${operator.tag} • ${new Date().toLocaleDateString()}`,
      iconURL: operator.displayAvatarURL(),
    })
    .setTimestamp();

  // Add main fields based on operation type
  if (type === "view") {
    embed.addFields(
      {
        name: `Current Balance`,
        value: `**${CORE_EMOJI} ${newAmount}**`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Membership Status`,
        value: userData?.isCore
          ? userData?.coreTier
            ? `⭐ **${userData.coreTier}**`
            : `⭐ **Core Member**`
          : `👤 **Regular User**`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Avatars Generated`,
        value: `**${userData?.totalGenerated || 0}**`,
        inline: true,
      },
    );

    if (userData?.lastUpdated) {
      embed.addFields({
        name: `${EMOJIS.TIME.CLOCK} Last Updated`,
        value: `<t:${Math.floor(new Date(userData.lastUpdated).getTime() / 1000)}:R>`,
        inline: false,
      });
    }
  } else {
    embed.addFields(
      {
        name: `Previous Balance`,
        value: `**${CORE_EMOJI} ${oldAmount}**`,
        inline: true,
      },
      {
        name: `${getOperationText(type)}`,
        value: `**${CORE_EMOJI} ${amount}**`,
        inline: true,
      },
      {
        name: `New Balance`,
        value: `**${CORE_EMOJI} ${newAmount}**`,
        inline: true,
      },
    );

    // Add reason if provided
    if (reason && reason !== "No reason provided") {
      embed.addFields({
        name: `${EMOJIS.UI.INFO} Reason`,
        value: reason,
        inline: false,
      });
    }
  }

  // Add target user info
  embed.addFields({
    name: `${EMOJIS.UI.USER} Target User`,
    value: `${targetUser} (${targetUser.tag})\nID: \`${targetUser.id}\``,
    inline: false,
  });

  return embed;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getEmbedColor(type) {
  switch (type) {
    case "add":
      return THEME.SUCCESS;
    case "remove":
      return THEME.WARNING;
    case "set":
      return THEME.PRIMARY;
    case "view":
      return THEME.SECONDARY;
    default:
      return THEME.PRIMARY;
  }
}

function getEmbedTitle(type) {
  switch (type) {
    case "add":
      return "Added";
    case "remove":
      return "Removed";
    case "set":
      return "Set";
    case "view":
      return "Viewing";
    default:
      return "Core Management";
  }
}

function getEmbedDescription(type, targetUser, amount, _oldAmount, _newAmount) {
  switch (type) {
    case "add":
      return `Successfully added **${amount} ${CORE_EMOJI}** to ${targetUser}'s account.`;
    case "remove":
      return `Successfully removed **${amount} ${CORE_EMOJI}** from ${targetUser}'s account.`;
    case "set":
      return `Successfully set ${targetUser}'s Core credits to **${amount} ${CORE_EMOJI}**.`;
    case "view":
      return `Viewing ${targetUser}'s Core credit information.`;
    default:
      return "Core credit management operation completed.";
  }
}

function getOperationText(type) {
  switch (type) {
    case "add":
      return "Added";
    case "remove":
      return "Removed";
    case "set":
      return "Set To";
    default:
      return "Operation";
  }
}
