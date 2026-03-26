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
import { emojiConfig } from "../../../config/emojis.js";
import { THEME } from "../../../config/theme.js";

/**
 * Vote command definition
 */
export const command = {
  name: "vote",
  description: "Vote for the bot on top.gg and get rewards!",
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription("Vote for the bot on top.gg and get rewards!")
    .addBooleanOption(option =>
      option
        .setName("public")
        .setDescription("Show vote link publicly (default: false)")
        .setRequired(false),
    ),

  /**
   * Execute the vote command
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord interaction
   */
  async execute(interaction) {
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
        .setFooter({
          text: "Thank you for supporting Role Reactor! ❤️",
        })
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
          .setColor(THEME.ERROR);

        await interaction.reply({
          embeds: [errorEmbed],
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  },
};

// Export data and execute for command loader compatibility
export const { data } = command;
export const { execute } = command;
export default command;
