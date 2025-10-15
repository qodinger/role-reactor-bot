import { EmbedBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";
import { GenerationHistory } from "../../general/avatar/utils/generationHistory.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

const logger = getLogger();

/**
 * Handle avatar debug commands
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleAvatarDebug(interaction, _client) {
  const subcommand = interaction.options.getSubcommand();

  try {
    // Check developer permissions
    if (!isDeveloper(interaction.user.id)) {
      logger.warn("Permission denied for avatar-debug command", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      await interaction.editReply({
        content:
          "❌ **Permission Denied**\nYou need developer permissions to use this command.",
      });
      return;
    }

    switch (subcommand) {
      case "stats":
        await handleStatsCommand(interaction);
        break;
      case "user":
        await handleUserCommand(interaction);
        break;
      default:
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Unknown subcommand",
              "Please use a valid subcommand.",
            ),
          ],
        });
    }
  } catch (error) {
    logger.error(`Error in avatar debug ${subcommand}:`, error);
    await interaction.editReply({
      embeds: [createErrorEmbed("Command Failed", error.message)],
    });
  }
}

/**
 * Handle stats subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleStatsCommand(interaction) {
  const hours = interaction.options.getInteger("hours") || 24;
  const stats = await GenerationHistory.getGenerationStats(hours);

  const embed = new EmbedBuilder()
    .setTitle(`Avatar Generation Statistics`)
    .setDescription(`**Last ${stats.timeRange}**`)
    .setColor(THEME.PRIMARY)
    .addFields(
      {
        name: "Overview",
        value: [
          `**Total Attempts:** ${stats.totalAttempts}`,
          `**Successful:** ${stats.successfulGenerations} (${stats.successRate}%)`,
          `**Failed:** ${stats.failedGenerations} (${stats.failureRate}%)`,
          `**User Reports:** ${stats.userReports}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Performance",
        value: [
          `**Avg Processing Time:** ${stats.averageProcessingTime}ms`,
          `**Success Rate:** ${stats.successRate}%`,
          `**Failure Rate:** ${stats.failureRate}%`,
        ].join("\n"),
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter({ text: "Developer Tool - Avatar Generation Debug" });

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle user subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleUserCommand(interaction) {
  const user = interaction.options.getUser("user");
  const limit = interaction.options.getInteger("limit") || 10;

  const userHistory = await GenerationHistory.getUserHistory(user.id, limit);

  if (!userHistory || userHistory.generations.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle(`No Generation History`)
      .setDescription(`No generation history found for ${user.displayName}.`)
      .setColor(THEME.SECONDARY)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Generation History - ${user.displayName}`)
    .setDescription(`**${userHistory.generations.length} recent generations**`)
    .setColor(THEME.PRIMARY)
    .addFields({
      name: "Summary",
      value: [
        `**Total Attempts:** ${userHistory.totalAttempts}`,
        `**Successful:** ${userHistory.successfulGenerations}`,
        `**Failed:** ${userHistory.failedGenerations}`,
        `**Success Rate:** ${userHistory.totalAttempts > 0 ? ((userHistory.successfulGenerations / userHistory.totalAttempts) * 100).toFixed(1) : 0}%`,
      ].join("\n"),
      inline: true,
    })
    .setTimestamp();

  // Show recent generations
  const generationList = userHistory.generations
    .slice(-5)
    .map((gen, index) => {
      const timestamp = new Date(gen.timestamp).toLocaleString();
      const status = gen.success ? EMOJIS.SUCCESS : EMOJIS.ERROR;
      const generationId = gen.id || `gen_${index + 1}`;

      return (
        `**${index + 1}.** ${status} **${generationId}** ${timestamp}\n` +
        `**Prompt:** ${gen.prompt.substring(0, 40)}...\n` +
        `**Time:** ${gen.processingTime}ms | **Tier:** ${gen.userTier}\n`
      );
    })
    .join("\n");

  embed.addFields({
    name: "Recent Generations",
    value: generationList || "No generations found",
  });

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Create error embed
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @returns {EmbedBuilder} Error embed
 */
function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`${title}`)
    .setDescription(description)
    .setColor(THEME.ERROR)
    .setTimestamp();
}
