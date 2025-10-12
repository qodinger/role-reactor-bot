import { PermissionFlagsBits, MessageFlags } from "discord.js";
import { EMOJIS, THEME } from "../../../config/theme.js";
import { config } from "../../../config/config.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

export async function execute(interaction) {
  // Defer the interaction immediately to prevent timeout
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case "balance":
        await handleBalance(interaction);
        break;
      case "pricing":
        await handlePricing(interaction);
        break;
      case "add":
        await handleAddCredits(interaction);
        break;
      case "remove":
        await handleRemoveCredits(interaction);
        break;
      case "set-core":
        await handleSetCore(interaction);
        break;
      default:
        await interaction.editReply({
          content: "❌ Unknown subcommand",
        });
    }
  } catch (error) {
    logger.error(`Error executing ai-avatar-credits ${subcommand}:`, error);

    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Command Error`,
      description: "An unexpected error occurred. Please try again later.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Credits • Error",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleBalance(interaction) {
  const storage = await getStorageManager();
  const userId = interaction.user.id;

  try {
    // Get centralized credit data (global, not per guild)
    const coreCredits = (await storage.get("core_credit")) || {};

    // Get user's credit data
    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    const balanceEmbed = {
      color: userData.isCore ? THEME.SUCCESS : THEME.PRIMARY,
      title: `${EMOJIS.UI.INFO} Your Core Balance`,
      description: userData.isCore
        ? `**Core Member** - You have special benefits! ⭐`
        : `**Regular User** - Earn Cores through donations or subscriptions`,
      fields: [
        {
          name: `${EMOJIS.UI.INFO} Available Cores`,
          value: `${userData.credits} Cores`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Core Status`,
          value: userData.isCore ? "⭐ Core Member" : "👤 Regular User",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Avatars Generated`,
          value: `${userData.totalGenerated} avatars`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Core Cost`,
          value: "**1 Core per AI service**",
          inline: false,
        },
        {
          name: `${EMOJIS.ACTIONS.REFRESH} Get More Cores`,
          value:
            "Donate on [Ko-fi](https://ko-fi.com/rolereactor) or subscribe for Core membership!",
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Credit Balance",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [balanceEmbed] });
  } catch (error) {
    logger.error("Error checking balance:", error);

    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Balance Check Failed`,
      description:
        "There was an error checking your credit balance. Please try again.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Error",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handlePricing(interaction) {
  const pricingEmbed = {
    color: THEME.PRIMARY,
    title: `${EMOJIS.UI.INFO} Core System & Core Membership`,
    description:
      "Manage your Cores for AI services and unlock Core membership benefits!",
    fields: [
      {
        name: `${EMOJIS.UI.INFO} Core System`,
        value:
          "• **All Users**: 1 Core per AI service\n• **Core Members**: Get tier-based monthly Cores + priority processing (minimum $10/month)",
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} How to Get Cores & Core`,
        value:
          "• **Donations**: $1 = 20 Cores, $2.50 = 50 Cores, $5 = 100 Cores, $10 = 200 Cores\n• **Ko-fi Memberships**: Tier-based Core membership (minimum $10/month)\n• **Admin Grants**: Manual Core addition via `/verify`\n• **AI Service**: Google Gemini 2.5",
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} Core Membership Benefits`,
        value:
          "• 🎨 **Tier-based monthly Cores** (fixed amounts per tier)\n• 🚀 **Priority processing**\n• 💎 **Exclusive features** (coming soon)\n• ⭐ **Special recognition** in the community\n• 💰 **Minimum $10/month** for Core membership",
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} One-time Donations`,
        value: (() => {
          const corePricing = config.corePricing;
          const rate = corePricing.donation.rate;
          return `• **$5 donation** = ${5 * rate} Cores = ${5 * rate} AI services\n• **$10 donation** = ${10 * rate} Cores = ${10 * rate} AI services\n• **$25 donation** = ${25 * rate} Cores = ${25 * rate} AI services\n• **$50 donation** = ${50 * rate} Cores = ${50 * rate} AI services`;
        })(),
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} Core Membership Tiers`,
        value: (() => {
          const corePricing = config.corePricing;
          return Object.entries(corePricing.subscriptions)
            .map(
              ([tierName, tierData]) =>
                `• **${tierName}** - $${tierData.price}/month = ${tierData.cores} Cores monthly`,
            )
            .join("\n");
        })(),
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} Core Membership`,
        value:
          "• **Core members** = Tier-based monthly Cores + all purchases\n• **Priority processing** in the queue\n• **Special recognition** in the community\n• **Minimum $10/month** required for Core membership",
        inline: false,
      },
      {
        name: `${EMOJIS.ACTIONS.REFRESH} Get Started`,
        value:
          "• Use `/credits balance` to check your Cores\n• Use `/avatar` to generate your first AI avatar\n• Donate on [Ko-fi](https://ko-fi.com/rolereactor) and include your Discord ID in the message\n• Cores are added automatically via webhook",
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "AI Avatar Generator • Pricing",
      icon_url: interaction.client.user.displayAvatarURL(),
    },
  };

  await interaction.editReply({ embeds: [pricingEmbed] });
}

async function handleAddCredits(interaction) {
  // Check if user has admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Permission Denied`,
      description: "You need Administrator permissions to add credits.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Admin Only",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const targetUser = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");
  const reason =
    interaction.options.getString("reason") || "Manual credit addition";

  const storage = await getStorageManager();
  const userId = targetUser.id;

  try {
    // Get centralized credit data (global, not per guild)
    const coreCredits = (await storage.get("core_credit")) || {};

    // Get current user data
    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Add credits
    userData.credits += amount;
    userData.lastUpdated = new Date().toISOString();

    // Update centralized data
    coreCredits[userId] = userData;

    // Save updated data
    await storage.set("core_credit", coreCredits);

    const successEmbed = {
      color: THEME.SUCCESS,
      title: `${EMOJIS.STATUS.SUCCESS} Credits Added`,
      description: `Successfully added ${amount} credits to ${targetUser.username}!`,
      fields: [
        {
          name: `${EMOJIS.UI.USER} User`,
          value: `${targetUser.username} (${targetUser.id})`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Amount Added`,
          value: `${amount} credits`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} New Balance`,
          value: `${userData.credits} credits`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Reason`,
          value: reason,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Admin Action",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error("Error adding credits:", error);

    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Credit Addition Failed`,
      description: "There was an error adding credits. Please try again later.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Error",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleRemoveCredits(interaction) {
  // Check if user has admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Permission Denied`,
      description: "You need Administrator permissions to remove credits.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Admin Only",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const targetUser = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");
  const reason =
    interaction.options.getString("reason") || "Manual credit removal";

  const storage = await getStorageManager();
  const userId = targetUser.id;

  try {
    // Get centralized credit data (global, not per guild)
    const coreCredits = (await storage.get("core_credit")) || {};

    // Get current user data
    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Check if user has enough credits
    if (userData.credits < amount) {
      const errorEmbed = {
        color: THEME.ERROR,
        title: `${EMOJIS.STATUS.ERROR} Insufficient Credits`,
        description: `${targetUser.username} only has ${userData.credits} credits, cannot remove ${amount} credits.`,
        timestamp: new Date().toISOString(),
        footer: {
          text: "AI Avatar Generator • Admin Action",
          icon_url: interaction.client.user.displayAvatarURL(),
        },
      };

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // Remove credits
    userData.credits -= amount;
    userData.lastUpdated = new Date().toISOString();

    // Update centralized data
    coreCredits[userId] = userData;

    // Save updated data
    await storage.set("core_credit", coreCredits);

    const successEmbed = {
      color: THEME.WARNING,
      title: `${EMOJIS.STATUS.WARNING} Credits Removed`,
      description: `Successfully removed ${amount} credits from ${targetUser.username}.`,
      fields: [
        {
          name: `${EMOJIS.UI.USER} User`,
          value: `${targetUser.username} (${targetUser.id})`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Amount Removed`,
          value: `${amount} credits`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} New Balance`,
          value: `${userData.credits} credits`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Reason`,
          value: reason,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Admin Action",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error("Error removing credits:", error);

    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Credit Removal Failed`,
      description:
        "There was an error removing credits. Please try again later.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Error",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleSetCore(interaction) {
  // Check if user has admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Permission Denied`,
      description: "You need Administrator permissions to set Core status.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Admin Only",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const targetUser = interaction.options.getUser("user");
  const isCore = interaction.options.getBoolean("is-core");
  const reason =
    interaction.options.getString("reason") || "Manual Core status change";

  const storage = await getStorageManager();
  const userId = targetUser.id;

  try {
    // Get centralized credit data (global, not per guild)
    const coreCredits = (await storage.get("core_credit")) || {};

    // Get current user data
    const userData = coreCredits[userId] || {
      credits: 0,
      isCore: false,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Update Core status
    userData.isCore = isCore;
    userData.lastUpdated = new Date().toISOString();

    // Update centralized data
    coreCredits[userId] = userData;

    // Save updated data
    await storage.set("core_credit", coreCredits);

    const successEmbed = {
      color: isCore ? THEME.SUCCESS : THEME.WARNING,
      title: `${EMOJIS.STATUS.SUCCESS} Core Status Updated`,
      description: `${targetUser.username} is now ${isCore ? "a Core member" : "a regular user"}.`,
      fields: [
        {
          name: `${EMOJIS.UI.USER} User`,
          value: `${targetUser.username} (${targetUser.id})`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} New Status`,
          value: isCore ? "⭐ Core Member" : "👤 Regular User",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Credit Cost`,
          value: isCore ? "1 credit per avatar" : "2 credits per avatar",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Reason`,
          value: reason,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Admin Action",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error("Error setting Core status:", error);

    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Core Status Update Failed`,
      description:
        "There was an error updating Core status. Please try again later.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "AI Avatar Generator • Error",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
