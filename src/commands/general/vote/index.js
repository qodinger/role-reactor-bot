/**
 * Vote Command - View vote link and rewards
 * @module commands/general/vote
 */

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

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
   * @param {Object} interaction - Discord interaction
   */
  async execute(interaction) {
    try {
      const isPublic = interaction.options.getBoolean("public") || false;

      // Bot's top.gg page
      const voteLink = "https://top.gg/bot/1392714201558159431/vote";

      const embed = new EmbedBuilder()
        .setTitle("🗳️ Vote for Role Reactor!")
        .setColor(0xff6b6b)
        .setDescription(
          `Support the bot by voting on top.gg! Every vote helps us grow and improve.`,
        )
        .addFields(
          {
            name: "🎁 Vote Reward",
            value:
              "**1 Core Credit** per vote\n\nYou can vote every **12 hours**!",
            inline: true,
          },
          {
            name: "⏰ Cooldown",
            value: "12 hours",
            inline: true,
          },
          {
            name: "🔗 Vote Link",
            value: `[Click here to vote!](${voteLink})`,
            inline: false,
          },
          {
            name: "💡 How It Works",
            value:
              "1. Click the vote link above\n" +
              "2. Log in to top.gg (Discord login)\n" +
              "3. Click the vote button\n" +
              "4. You'll automatically receive **1 Core**!\n" +
              "5. Come back in 12 hours to vote again!",
            inline: false,
          },
        )
        .setFooter({
          text: "Thank you for supporting Role Reactor! ❤️",
        })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: !isPublic,
      });
    } catch (error) {
      console.error("Vote command error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Failed to show vote information. Please try again.",
          ephemeral: true,
        });
      }
    }
  },
};

export default command;
