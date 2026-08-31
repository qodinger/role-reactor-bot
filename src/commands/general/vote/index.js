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
import config from "../../../config/config.js";
import { THEME, UI_COMPONENTS } from "../../../config/theme.js";

// ============================================================================
// COMMAND METADATA
// ============================================================================

export const metadata = {
  name: "vote",
  category: "general",
  description: "Vote for the bot on top.gg and get rewards!",
  keywords: ["vote", "top.gg", "rewards", "sparks", "cores", "support"],
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
        "Shows your voting status on top.gg and a direct link to vote. Each vote earns you +5 Sparks ⚡.",
      inline: false,
    },
    {
      name: "Options",
      value:
        "• `public` — Show the vote link publicly (default: false, ephemeral)",
      inline: false,
    },
    {
      name: "Rewards & Streaks",
      value:
        "• **Base Vote:** +5 Sparks ⚡\n• **3-Vote Streak:** +6 Sparks ⚡\n• **7-Vote Streak:** +7 Sparks ⚡\n• **14+ Streak (Max):** +8 Sparks ⚡ 🔥\n• Vote once every 12 hours (36h grace period)",
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

    const streak = voteStatus.voteStreak || 0;
    let nextReward = 5;
    if (streak >= 13) nextReward = 8;
    else if (streak >= 6) nextReward = 7;
    else if (streak >= 2) nextReward = 6;

    const fields = [
      {
        name: "🎁 Next Vote Reward",
        value: `⚡ **+${nextReward} Sparks**`,
        inline: true,
      },
      {
        name: "🔥 Vote Streak",
        value: streak > 0 ? `**${streak} Votes**` : "No Active Streak",
        inline: true,
      },
      {
        name: "⏰ Cooldown Status",
        value: cooldownText,
        inline: true,
      },
    ];

    if (voteStatus.totalVotes > 0) {
      fields.push({
        name: "📈 Your Total Votes",
        value: `**${voteStatus.totalVotes}** votes`,
        inline: true,
      });
    }

    fields.push({
      name: "💡 Streak Bonuses & How It Works",
      value:
        "• **Day 1-2:** +5 Sparks ⚡ per vote\n" +
        "• **3-Vote Streak:** +6 Sparks ⚡ per vote\n" +
        "• **7-Vote Streak:** +7 Sparks ⚡ per vote\n" +
        "• **14+ Streak (Max):** +8 Sparks ⚡ per vote\n\n" +
        "1. Click the button below to visit top.gg\n" +
        "2. Log in and click **Vote**\n" +
        "3. Your Sparks ⚡ and Streak 🔥 update automatically!",
      inline: false,
    });

    const embed = new EmbedBuilder()
      .setTitle("🗳️ Vote for Role Reactor!")
      .setColor(THEME.PRIMARY)
      .setAuthor(
        UI_COMPONENTS.createAuthor(
          interaction.user.username,
          interaction.user.displayAvatarURL(),
        ),
      )
      .setDescription(
        `Support the bot by voting on top.gg! Every vote helps us grow and directly rewards you.`,
      )
      .addFields(fields)
      .setFooter(
        UI_COMPONENTS.createFooter(
          "Daily Voting Rewards",
          interaction.client?.user?.displayAvatarURL(),
        ),
      )
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
    console.error("Vote command error:", error);

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
