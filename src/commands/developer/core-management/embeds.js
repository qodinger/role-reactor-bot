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
    .setTitle(title)
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
  creditType = "bonus",
  showCreditBreakdown = false,
  donationDetails = null,
}) {
  // Ensure description is always set
  const description = getEmbedDescription(
    type,
    targetUser,
    amount,
    oldAmount,
    newAmount,
    creditType,
  );
  console.log("Generated description:", description);
  console.log("Type:", type, "TargetUser:", targetUser?.username);

  const finalDescription =
    description || "Core account management operation completed.";
  console.log("Final description:", finalDescription);

  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
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

    // Add credit breakdown if available
    if (showCreditBreakdown && userData) {
      const subscriptionCredits = userData.subscriptionCredits || 0;
      const bonusCredits = userData.bonusCredits || 0;
      const isSubscriptionUser = userData.koFiSubscription?.isActive;

      if (isSubscriptionUser) {
        embed.addFields({
          name: `💎 Credit Breakdown`,
          value: `• **Subscription**: ${subscriptionCredits} ${CORE_EMOJI} (monthly allowance)\n• **Bonus**: ${bonusCredits} ${CORE_EMOJI} (donation Cores, never expires)`,
          inline: false,
        });
      } else {
        embed.addFields({
          name: `💎 Credit Type`,
          value: `• **Donation Cores**: ${bonusCredits} ${CORE_EMOJI} (never expires)`,
          inline: false,
        });
      }
    }

    if (userData?.lastUpdated) {
      embed.addFields({
        name: `Last Updated`,
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

    // Add donation details if available
    if (type === "add-donation" && donationDetails) {
      embed.addFields({
        name: `💰 Donation Details`,
        value: `**Amount**: $${donationDetails.amount}\n**Cores Calculated**: ${donationDetails.coresCalculated} ${CORE_EMOJI} (10 per $1)\n${donationDetails.koFiUrl ? `**Ko-fi URL**: [View Donation](${donationDetails.koFiUrl})` : ""}`,
        inline: false,
      });
    }

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
    case "add-donation":
      return THEME.SUCCESS;
    case "cancel-subscription":
      return THEME.ERROR;
    default:
      return THEME.PRIMARY;
  }
}

function getEmbedDescription(
  type,
  targetUser,
  amount,
  _oldAmount,
  _newAmount,
  creditType = "bonus",
) {
  const username = targetUser?.username || targetUser?.tag || "Unknown User";
  const creditTypeText =
    creditType === "bonus" ? "bonus Cores (donation Cores)" : "Cores";

  switch (type) {
    case "add":
      return `Successfully added **${amount} ${CORE_EMOJI}** ${creditTypeText} to ${username}'s Core account.`;
    case "remove":
      return `Successfully removed **${amount} ${CORE_EMOJI}** ${creditTypeText} from ${username}'s Core account.`;
    case "set":
      return `Successfully set ${username}'s ${creditTypeText} to **${amount} ${CORE_EMOJI}**.`;
    case "view":
      return `Displaying ${username}'s Core account information and credit breakdown.`;
    case "add-donation":
      return `Successfully verified Ko-fi donation and added **${amount} ${CORE_EMOJI}** bonus Cores to ${username}'s Core account.`;
    case "cancel-subscription":
      return `Successfully cancelled ${username}'s Core subscription and removed Core membership status.`;
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
    case "add-donation":
      return "Donation Verified";
    case "cancel-subscription":
      return "Subscription Cancelled";
    default:
      return "Operation";
  }
}
