import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";
import { config } from "../../../config/config.js";

const CORE_EMOJI = config.coreEmoji;

// ============================================================================
// CORE MANAGEMENT EMBED BUILDER
// ============================================================================

export async function createCoreManagementEmbed({
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
    .setTitle(`${getEmbedTitle(type)} ${CORE_EMOJI} Core Energy`)
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
        name: `${CORE_EMOJI} Current Balance`,
        value: `**${newAmount} ${CORE_EMOJI}**`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Membership Status`,
        value: userData?.isCore ? `⭐ **Core Member**` : `👤 **Regular User**`,
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
        name: `${CORE_EMOJI} Previous Balance`,
        value: `**${oldAmount} ${CORE_EMOJI}**`,
        inline: true,
      },
      {
        name: `${getOperationEmoji(type)} ${getOperationText(type)}`,
        value: `**${amount} ${CORE_EMOJI}**`,
        inline: true,
      },
      {
        name: `${CORE_EMOJI} New Balance`,
        value: `**${newAmount} ${CORE_EMOJI}**`,
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
      return "✅ Added";
    case "remove":
      return "➖ Removed";
    case "set":
      return "🔧 Set";
    case "view":
      return "👁️ Viewing";
    default:
      return "Core Management";
  }
}

function getEmbedDescription(type, targetUser, amount, oldAmount, newAmount) {
  const change = newAmount - oldAmount;
  const changeText = change > 0 ? `+${change}` : change.toString();

  switch (type) {
    case "add":
      return `Successfully added **${amount} ${CORE_EMOJI}** to ${targetUser}'s account.\n**Change**: ${changeText} ${CORE_EMOJI}`;
    case "remove":
      return `Successfully removed **${amount} ${CORE_EMOJI}** from ${targetUser}'s account.\n**Change**: ${changeText} ${CORE_EMOJI}`;
    case "set":
      return `Successfully set ${targetUser}'s Core credits to **${amount} ${CORE_EMOJI}**.\n**Change**: ${changeText} ${CORE_EMOJI}`;
    case "view":
      return `Viewing ${targetUser}'s Core credit information.`;
    default:
      return "Core credit management operation completed.";
  }
}

function getOperationEmoji(type) {
  switch (type) {
    case "add":
      return "➕";
    case "remove":
      return "➖";
    case "set":
      return "🔧";
    default:
      return "📊";
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
