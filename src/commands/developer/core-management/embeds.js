import { EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";
import { getLogger } from "../../../utils/logger.js";

const CORE_EMOJI = emojiConfig.customEmojis.core;
const logger = getLogger();

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
  oldTotalCores = null,
  newTotalCores = null,
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
  logger.debug("Generated description:", description);
  logger.debug("Type:", type, "TargetUser:", targetUser?.username);

  const finalDescription =
    description || "Core account management operation completed.";
  logger.debug("Final description:", finalDescription);

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
        value: `${CORE_EMOJI} ${newAmount}`,
        inline: true,
      },
      {
        name: `Membership Status`,
        value:
          userData?.isCore && userData?.coreTier
            ? `${emojiConfig.getTierBadge(userData.coreTier)} ${userData.coreTier}`
            : userData?.isCore
              ? `${CORE_EMOJI} Core Member`
              : `None`,
        inline: true,
      },
    );

    // Add credit breakdown if available
    if (showCreditBreakdown && userData) {
      const subscriptionCredits = userData.subscriptionCredits || 0;
      const bonusCredits = userData.bonusCredits || 0;
      const isSubscriptionUser = userData.cryptoSubscription?.isActive;

      if (isSubscriptionUser) {
        embed.addFields({
          name: `Credit Breakdown`,
          value: `Subscription: ${subscriptionCredits} ${CORE_EMOJI} (monthly allowance)\nBonus: ${bonusCredits} ${CORE_EMOJI} (bonus Cores, never expires)`,
          inline: false,
        });
      } else {
        embed.addFields({
          name: `Credit Type`,
          value: `Bonus Cores: ${bonusCredits} ${CORE_EMOJI} (never expires)`,
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
        value: `${CORE_EMOJI} ${oldAmount}`,
        inline: true,
      },
      {
        name: `${getOperationText(type)}`,
        value: `${CORE_EMOJI} ${amount}`,
        inline: true,
      },
      {
        name: `New Balance`,
        value: `${CORE_EMOJI} ${newAmount}`,
        inline: true,
      },
    );

    // Add total balance impact if available
    if (oldTotalCores !== null && newTotalCores !== null) {
      embed.addFields({
        name: `Total Balance Impact`,
        value: `Previous Total: ${oldTotalCores} ${CORE_EMOJI}\nNew Total: ${newTotalCores} ${CORE_EMOJI}`,
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

  // Add target user info
  embed.addFields({
    name: `Target User`,
    value: [
      `User: ${targetUser}`,
      `Tag: \`${targetUser.tag}\``,
      `ID: \`${targetUser.id}\``,
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
  const creditTypeText = creditType === "bonus" ? "bonus Cores" : "Cores";

  switch (type) {
    case "add":
      return `Successfully added ${amount} ${CORE_EMOJI} ${creditTypeText} to ${username}'s Core account.`;
    case "remove":
      return `Successfully removed ${amount} ${CORE_EMOJI} ${creditTypeText} from ${username}'s Core account.`;
    case "set":
      return `Successfully set ${username}'s ${creditTypeText} to ${amount} ${CORE_EMOJI}.`;
    case "view":
      return `Displaying ${username}'s Core account information and credit breakdown.`;
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
