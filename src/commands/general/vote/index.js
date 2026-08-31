/**
 * Vote Command - View vote link and rewards
 * @module commands/general/vote
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { getVoteStatus } from "../../../webhooks/topgg.js";
import { getLogger } from "../../../utils/logger.js";
import config from "../../../config/config.js";
import { emojiConfig } from "../../../config/emojis.js";
import { THEME, UI_COMPONENTS } from "../../../config/theme.js";

const logger = getLogger();

// ============================================================================
// COMMAND METADATA
// ============================================================================

export const metadata = {
  name: "vote",
  category: "general",
  description: "Vote for the bot on top.gg and get rewards!",
  keywords: ["vote", "top.gg", "rewards", "cores", "support", "premium"],
  emoji: "🗳️",
  helpFields: [
    {
      name: "How to Use",
      value: "```/vote [public]```",
      inline: false,
    },
    {
      name: "What It Does",
      value:
        "Shows your voting status on top.gg and a direct link to vote. Each vote earns you 1 Core (premium currency).",
      inline: false,
    },
    {
      name: "Options",
      value:
        "• `public` — Show the vote link publicly (default: false, ephemeral)",
      inline: false,
    },
    {
      name: "Rewards",
      value:
        "• **1 Core** per vote\n• Vote once every 12 hours\n• Use Cores for AI image generation and premium features",
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addBooleanOption(option =>
    option
      .setName("public")
      .setDescription("Show vote link publicly (default: false)")
      .setRequired(false),
  );

// ============================================================================
// HANDLER
// ============================================================================

export async function execute(interaction) {
  try {
    const isPublic = interaction.options.getBoolean("public") || false;
    const { customEmojis } = emojiConfig;

    // Bot's top.gg page from config
    const voteLink = config.externalLinks.vote;

    // Dynamically fetch user's last vote timestamp
    const voteStatus = await getVoteStatus(interaction.user.id);

    let cooldownText = "12 hours";
    if (!voteStatus.canVote && voteStatus.nextVote) {
      cooldownText = `⏳ Wait until <t:${Math.floor(voteStatus.nextVote.getTime() / 1000)}:R>`;
    } else {
      cooldownText = "✅ **Ready to vote!**";
    }

    const fields = [
      {
        name: "🎁 Vote Reward",
        value: `**${customEmojis.core} 1** per vote`,
        inline: true,
      },
      {
        name: "⏰ Cooldown Status",
        value: cooldownText,
        inline: true,
      },
    ];

    // If they have voted at least once, show their total votes
    if (voteStatus.totalVotes > 0) {
      fields.push({
        name: "📈 Your Total Votes",
        value: `**${voteStatus.totalVotes}** votes`,
        inline: true,
      });
    }

    fields.push({
      name: "💡 How It Works",
      value:
        "1. Click the button below to visit top.gg\n" +
        "2. Log in with your Discord account\n" +
        "3. Click the shiny **Vote** button\n" +
        `4. You'll automatically receive **1** ${customEmojis.core}\n` +
        "5. Come back in 12 hours to do it again!",
      inline: false,
    });

    const embed = new EmbedBuilder()
      .setTitle("🗳️ Vote for Role Reactor!")
      .setColor(THEME.PRIMARY)
      .setDescription(
        `Support the bot by voting on top.gg! Every vote helps us grow and directly rewards you.`,
      )
      .addFields(fields)
      .setFooter(UI_COMPONENTS.createFooter("Vote"))
      .setTimestamp();

    const buttonRow = /** @type {any} */ (
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Vote on Top.gg")
          .setURL(voteLink)
          .setStyle(ButtonStyle.Link)
          .setEmoji("🚀"),
      )
    );

    return interaction.reply({
      embeds: [embed],
      components: [buttonRow],
      ephemeral: !isPublic,
    });
  } catch (error) {
    logger.error("Vote command error:", error);

    if (!interaction.replied && !interaction.deferred) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("Vote Error")
        .setDescription("Failed to show vote information. Please try again.")
        .setColor(THEME.ERROR)
        .setFooter(UI_COMPONENTS.createFooter("Vote"))
        .setTimestamp();

      await interaction.reply({
        embeds: [errorEmbed],
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}
