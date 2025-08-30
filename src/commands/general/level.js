import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";
import { getExperienceManager } from "../../features/experience/ExperienceManager.js";

export const data = new SlashCommandBuilder()
  .setName("level")
  .setDescription(`${EMOJIS.FEATURES.ROLES} Check your level and experience`)
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("User to check (defaults to you)")
      .setRequired(false),
  );

// Award XP before executing so the latest XP is reflected in the embed
export const preAwardXP = true;

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const experienceManager = await getExperienceManager();

    const userData = await experienceManager.getUserData(
      interaction.guild.id,
      targetUser.id,
    );
    const progress = experienceManager.calculateProgress(userData.totalXP);

    // Get server rank by calculating position in leaderboard
    const leaderboard = await experienceManager.getLeaderboard(
      interaction.guild.id,
      100,
    );
    const userRank =
      leaderboard.findIndex(user => user.userId === targetUser.id) + 1;
    const totalUsers = leaderboard.length;
    const serverRank =
      userRank > 0 ? `#${userRank} of ${totalUsers}` : "Unranked";

    // Create progress bar
    const progressBarLength = 20;
    const filledBars = Math.floor(
      (progress.progress / 100) * progressBarLength,
    );
    const emptyBars = progressBarLength - filledBars;
    const progressBar = "█".repeat(filledBars) + "░".repeat(emptyBars);

    // Determine rank based on level
    let rank = "Newcomer";
    let rankEmoji = EMOJIS.UI.STAR; // Default star emoji
    if (userData.level >= 50) {
      rank = "Legend";
      rankEmoji = EMOJIS.UI.OWNER; // Crown for legend
    } else if (userData.level >= 30) {
      rank = "Veteran";
      rankEmoji = EMOJIS.UI.STAR; // Star for veteran
    } else if (userData.level >= 20) {
      rank = "Experienced";
      rankEmoji = EMOJIS.ACTIONS.QUICK; // Rocket for experienced
    } else if (userData.level >= 10) {
      rank = "Regular";
      rankEmoji = EMOJIS.FEATURES.ROLES; // Roles emoji for regular
    } else if (userData.level >= 5) {
      rank = "Active";
      rankEmoji = EMOJIS.ACTIONS.QUICK; // Rocket for active
    }

    // Determine rank color based on level
    let rankColor = THEME.SUCCESS;
    if (userData.level >= 50)
      rankColor = THEME.WARNING; // Gold for Legend
    else if (userData.level >= 30)
      rankColor = THEME.WARNING; // Orange for Veteran
    else if (userData.level >= 20)
      rankColor = THEME.ACCENT; // Purple for Experienced
    else if (userData.level >= 10)
      rankColor = THEME.INFO; // Blue for Regular
    else if (userData.level >= 5) rankColor = THEME.ERROR; // Red for Active

    const embed = new EmbedBuilder()
      .setColor(rankColor)
      .setTitle(`${rankEmoji} ${targetUser.username}'s Level Profile`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: `${EMOJIS.UI.USERS} User`,
          value: `${targetUser.tag}`,
          inline: true,
        },
        {
          name: `${rankEmoji} Rank`,
          value: `**${rank}**`,
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.ROLES} Level`,
          value: `**${userData.level}**`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.PROGRESS} Total XP`,
          value: `**${userData.totalXP.toLocaleString()}**`,
          inline: true,
        },
        {
          name: `${EMOJIS.TIME.CLOCK} Progress`,
          value: `**${progress.xpInCurrentLevel}/${progress.xpNeededForNextLevel}**`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.STAR} Next Level`,
          value: `**Level ${userData.level + 1}**`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.PROGRESS} Progress Bar`,
          value: `\`${progressBar}\` **${Math.round(progress.progress)}%**`,
          inline: false,
        },
      )
      .addFields({
        name: `${EMOJIS.UI.INFO} Activity Statistics`,
        value: [
          `${EMOJIS.UI.ANSWER} **Messages Sent:** ${userData.messagesSent || 0}`,
          `${EMOJIS.ACTIONS.QUICK} **Commands Used:** ${userData.commandsUsed || 0}`,
          `${EMOJIS.FEATURES.ROLES} **Roles Earned:** ${userData.rolesEarned || 0}`,
          `${EMOJIS.UI.PROGRESS} **Server Rank:** ${serverRank}`,
        ].join("\n"),
        inline: false,
      })
      .addFields({
        name: `${EMOJIS.UI.INFO} XP Breakdown`,
        value: [
          `${EMOJIS.UI.ANSWER} **Message XP:** 15-25 XP per message (60s cooldown)`,
          `${EMOJIS.ACTIONS.QUICK} **Command XP:** 3-15 XP per command (30s cooldown)`,
          `${EMOJIS.FEATURES.ROLES} **Role XP:** 50 XP per role assignment`,
        ].join("\n"),
        inline: false,
      })
      .setFooter(
        UI_COMPONENTS.createFooter(
          `Last updated: ${userData.lastUpdated ? new Date(userData.lastUpdated).toLocaleDateString() : "Never"} • ${interaction.guild.name}`,
          targetUser.displayAvatarURL(),
        ),
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    logger.logCommand("level", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in level command", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(THEME.ERROR)
          .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
          .setDescription(
            "Sorry, I couldn't load the level information right now.",
          ),
      ],
    });
  }
}
