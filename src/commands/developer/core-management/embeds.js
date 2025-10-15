import { EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";
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
  // Ensure description is always set
  const description = getEmbedDescription(
    type,
    targetUser,
    amount,
    oldAmount,
    newAmount,
  );
  console.log("Generated description:", description);
  console.log("Type:", type, "TargetUser:", targetUser?.username);

  const finalDescription =
    description || "Core account management operation completed.";
  console.log("Final description:", finalDescription);

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor(type))
    .setDescription(finalDescription)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
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
        name: `Membership Status`,
        value:
          userData?.isCore && userData?.coreTier
            ? `${emojiConfig.getTierBadge(userData.coreTier)} **${userData.coreTier}**`
            : userData?.isCore
              ? `${CORE_EMOJI} **Core Member**`
              : `None`,
        inline: true,
      },
    );

    if (userData?.lastUpdated) {
      embed.addFields({
        name: `Last Updated`,
        value: `<t:${Math.floor(new Date(userData.lastUpdated).getTime() / 1000)}:R>`,
        inline: false,
      });
    }
  } else if (type === "remove-tier") {
    // Special handling for tier removal
    embed.addFields(
      {
        name: `Previous Tier`,
        value: userData?.coreTier
          ? `${emojiConfig.getTierBadge(userData.coreTier)} ${userData.coreTier}`
          : "None",
        inline: true,
      },
      {
        name: `New Tier`,
        value: "None",
        inline: true,
      },
      {
        name: `Core Status`,
        value: "❌ Inactive",
        inline: true,
      },
    );

    // Add reason if provided
    if (reason && reason !== "No reason provided") {
      embed.addFields({
        name: `Reason`,
        value: reason,
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
        name: `Reason`,
        value: reason,
        inline: false,
      });
    }
  }

  // Add target user info with enhanced design
  embed.addFields({
    name: `Target User`,
    value: [
      `**User:** ${targetUser}`,
      `**Tag:** \`${targetUser.tag}\``,
      `**ID:** \`${targetUser.id}\``,
    ].join("\n"),
    inline: true,
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
    case "tier":
      return THEME.SUCCESS;
    case "remove-tier":
      return THEME.WARNING;
    default:
      return THEME.PRIMARY;
  }
}

function getEmbedDescription(type, targetUser, amount, _oldAmount, _newAmount) {
  const username = targetUser?.username || targetUser?.tag || "Unknown User";

  switch (type) {
    case "add":
      return `Successfully added **${amount} ${CORE_EMOJI}** to ${username}'s Core account.`;
    case "remove":
      return `Successfully removed **${amount} ${CORE_EMOJI}** from ${username}'s Core account.`;
    case "set":
      return `Successfully set ${username}'s Core balance to **${amount} ${CORE_EMOJI}**.`;
    case "view":
      return `Displaying ${username}'s Core account information and statistics.`;
    case "tier":
      return `Successfully updated ${username}'s Core membership tier.`;
    case "remove-tier":
      return `Successfully removed ${username}'s Core membership tier.`;
    default:
      return "Core account management operation completed successfully.";
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
