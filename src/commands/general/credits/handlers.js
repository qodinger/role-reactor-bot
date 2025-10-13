import { MessageFlags } from "discord.js";
import { EMOJIS, THEME } from "../../../config/theme.js";
import { config } from "../../../config/config.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

// Get Core emoji from config (environment-specific)
const CORE_EMOJI = config.coreEmoji;

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
      default:
        await interaction.editReply({
          content: "❌ Unknown subcommand",
        });
    }
  } catch (error) {
    logger.error(`Error executing credits ${subcommand}:`, error);

    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Command Error`,
      description: "An unexpected error occurred. Please try again later.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "Core System • Error",
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
      title: `${CORE_EMOJI} Your Core Balance`,
      description: userData.isCore
        ? `**${CORE_EMOJI} Core Member** - You have special benefits and priority processing! ⭐`
        : `**Regular User** - Earn ${CORE_EMOJI} Cores through donations or subscriptions`,
      fields: [
        {
          name: `${CORE_EMOJI} Available Cores`,
          value: `**${userData.credits} ${CORE_EMOJI}**`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Membership Status`,
          value: userData.isCore ? `⭐ **Core Member**` : `👤 **Regular User**`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.INFO} Avatars Generated`,
          value: `**${userData.totalGenerated}** avatars`,
          inline: true,
        },
        {
          name: `${CORE_EMOJI} Core Usage`,
          value: `**1 ${CORE_EMOJI} = 1 AI Avatar Generation**`,
          inline: false,
        },
        {
          name: `${EMOJIS.ACTIONS.REFRESH} Get More ${CORE_EMOJI} Cores`,
          value: `• Donate on [Ko-fi](https://ko-fi.com/rolereactor)\n• Subscribe for Core membership\n• Contact an administrator`,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: `Core System • ${interaction.user.username}`,
        icon_url: interaction.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [balanceEmbed] });
  } catch (error) {
    logger.error("Error checking balance:", error);

    const errorEmbed = {
      color: THEME.ERROR,
      title: `${EMOJIS.STATUS.ERROR} Balance Check Failed`,
      description:
        "There was an error checking your Core balance. Please try again.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "Core System • Error",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handlePricing(interaction) {
  const pricingEmbed = {
    color: THEME.PRIMARY,
    title: `${CORE_EMOJI} Core System & Pricing`,
    description: `Manage your ${CORE_EMOJI} Cores for AI avatar generation and unlock Core membership benefits!`,
    fields: [
      {
        name: `${CORE_EMOJI} How It Works`,
        value: `• **1 ${CORE_EMOJI} Core = 1 AI Avatar Generation**\n• **All users** pay the same rate\n• **Core Members** get priority processing + monthly bonuses`,
        inline: false,
      },
      {
        name: `${CORE_EMOJI} One-time Donations`,
        value: `• **$5** = **50 ${CORE_EMOJI}** (10.0 Cores/$)\n• **$10** = **100 ${CORE_EMOJI}** (10.0 Cores/$)\n• **$25** = **250 ${CORE_EMOJI}** (10.0 Cores/$)\n• **$50** = **500 ${CORE_EMOJI}** (10.0 Cores/$)`,
        inline: false,
      },
      {
        name: `${CORE_EMOJI} Core Membership Tiers`,
        value: `• **Core Basic** - $10/month = **150 ${CORE_EMOJI}** monthly\n• **Core Premium** - $25/month = **400 ${CORE_EMOJI}** monthly\n• **Core Elite** - $50/month = **850 ${CORE_EMOJI}** monthly`,
        inline: false,
      },
      {
        name: `⭐ Core Membership Benefits`,
        value: `• 🎨 **Monthly ${CORE_EMOJI} Core bonuses**\n• 🚀 **Priority processing** in generation queue\n• 💎 **Exclusive features** (coming soon)\n• ⭐ **Special recognition** in community\n• 📈 **Better value** than one-time donations`,
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} AI Service Details`,
        value: `• **Model**: Stability AI SD 3.5 Flash\n• **Quality**: High-resolution anime avatars\n• **Style**: Custom anime art with your prompts\n• **Speed**: 10-30 seconds per generation`,
        inline: false,
      },
      {
        name: `${EMOJIS.ACTIONS.REFRESH} Get Started`,
        value: `• Use \`/credits balance\` to check your ${CORE_EMOJI} Cores\n• Use \`/avatar\` to generate your first AI avatar\n• Donate on [Ko-fi](https://ko-fi.com/rolereactor) with your Discord ID\n• ${CORE_EMOJI} Cores are added automatically via webhook`,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: `Core System • ${interaction.user.username}`,
      icon_url: interaction.user.displayAvatarURL(),
    },
  };

  await interaction.editReply({ embeds: [pricingEmbed] });
}
