import { MessageFlags } from "discord.js";
import { EMOJIS, THEME } from "../../../config/theme.js";
import { config } from "../../../config/config.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

// Get Core emoji from config (environment-specific)
const CORE_EMOJI = config.coreEmoji;

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    // Defer the interaction immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();

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
    logger.error(`Error executing core command:`, error);

    try {
      const errorEmbed = {
        color: THEME.ERROR,
        title: `${EMOJIS.STATUS.ERROR} Command Error`,
        description: "An unexpected error occurred. Please try again later.",
        timestamp: new Date().toISOString(),
        footer: {
          text: "Core Energy • Error",
          icon_url: interaction.client.user.displayAvatarURL(),
        },
      };

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      logger.error("Failed to send error response:", replyError);
    }
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
      description: `**Balance:**\n${CORE_EMOJI} ${userData.credits}\n\nGet more at [Ko-fi](https://ko-fi.com/rolereactor) • Use \`/core pricing\``,
      timestamp: new Date().toISOString(),
      footer: {
        text: `Core Energy • ${interaction.user.username}`,
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
        text: "Core Energy • Error",
        icon_url: interaction.client.user.displayAvatarURL(),
      },
    };

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handlePricing(interaction) {
  const pricingEmbed = {
    color: THEME.PRIMARY,
    title: `${CORE_EMOJI} Core Pricing`,
    description: `**1 ${CORE_EMOJI} Core = 1 AI Avatar Generation** • All users pay the same rate`,
    fields: [
      {
        name: `${CORE_EMOJI} One-time Donations`,
        value: `**$5** → 50 ${CORE_EMOJI} • **$10** → 100 ${CORE_EMOJI}\n**$25** → 250 ${CORE_EMOJI} • **$50** → 500 ${CORE_EMOJI}`,
        inline: true,
      },
      {
        name: `⭐ Core Membership`,
        value: `**Basic** $10/mo → 150 ${CORE_EMOJI}\n**Premium** $25/mo → 400 ${CORE_EMOJI}\n**Elite** $50/mo → 850 ${CORE_EMOJI}`,
        inline: true,
      },
      {
        name: `🚀 Core Benefits`,
        value: `Priority processing • Monthly bonuses • Better value`,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: `Donate on Ko-fi • Use /core balance to check balance`,
      icon_url: interaction.client.user.displayAvatarURL(),
    },
  };

  await interaction.editReply({ embeds: [pricingEmbed] });
}
