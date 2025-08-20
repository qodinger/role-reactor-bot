import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { hasAdminPermissions } from "../../utils/discord/permissions.js";
import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { THEME_COLOR, EMOJIS } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";
import {
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

export const data = new SlashCommandBuilder()
  .setName("xp-settings")
  .setDescription("View and manage XP system settings")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const logger = getLogger();
  const startTime = Date.now();

  await interaction.deferReply({ flags: 64 });

  try {
    // Validate user permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply(
        permissionErrorEmbed({
          requiredPermissions: ["ManageGuild"],
          userPermissions: interaction.member.permissions.toArray(),
          tip: "You need Manage Guild permissions to view XP settings.",
        }),
      );
    }

    // Get database manager and settings
    const dbManager = await getDatabaseManager();

    // Check if guild settings repository is available
    if (!dbManager.guildSettings) {
      return interaction.editReply(
        errorEmbed({
          title: "Database Error",
          description: "Guild settings repository is not available.",
          solution:
            "Please restart the bot or contact support if the issue persists.",
        }),
      );
    }

    let settings;
    try {
      // Add timeout for database operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Database operation timed out")),
          5000,
        );
      });

      settings = await Promise.race([
        dbManager.guildSettings.getByGuild(interaction.guild.id),
        timeoutPromise,
      ]);
    } catch (error) {
      logger.error(
        `Failed to retrieve guild settings for guild ${interaction.guild.id}`,
        error,
      );
      return interaction.editReply(
        errorEmbed({
          title: "Database Error",
          description: "Failed to retrieve guild settings from database.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }

    const xpSettings = settings.experienceSystem;

    // Create settings embed
    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`${EMOJIS.FEATURES.ROLES} XP System Settings`)
      .setDescription("Current configuration for the XP system")
      .addFields([
        {
          name: `${EMOJIS.STATUS.SUCCESS} System Status`,
          value: xpSettings.enabled ? "🟢 Enabled" : "🔴 Disabled",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.MESSAGE} Message XP`,
          value: xpSettings.messageXP ? "✅ Enabled" : "❌ Disabled",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.COMMAND} Command XP`,
          value: xpSettings.commandXP ? "✅ Enabled" : "❌ Disabled",
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.ROLES} Role XP`,
          value: xpSettings.roleXP ? "✅ Enabled" : "❌ Disabled",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.MESSAGE} Message XP Range`,
          value: `${xpSettings.messageXPAmount.min}-${xpSettings.messageXPAmount.max} XP`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.COMMAND} Command XP Base`,
          value: `${xpSettings.commandXPAmount.base} XP`,
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.ROLES} Role XP Amount`,
          value: `${xpSettings.roleXPAmount} XP`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.TIME} Cooldowns`,
          value: `Message: ${xpSettings.messageCooldown}s | Command: ${xpSettings.commandCooldown}s`,
          inline: false,
        },
        {
          name: `${EMOJIS.UI.INFO} How XP Works`,
          value: [
            "💬 **Messages**: Random XP every 60 seconds",
            "⚡ **Commands**: Base XP + bonuses for engaging commands",
            "🎭 **Roles**: Fixed XP when users get roles",
            "📊 **Levels**: XP accumulates to unlock new levels",
          ].join("\n"),
          inline: false,
        },
      ])
      .setFooter({
        text: `${EMOJIS.FEATURES.ROLES} XP System • ${interaction.guild.name}`,
        iconURL: interaction.guild.iconURL(),
      })
      .setTimestamp();

    // Create action buttons
    const buttonComponents = [
      new ButtonBuilder()
        .setCustomId("xp_toggle_system")
        .setLabel(xpSettings.enabled ? "Disable System" : "Enable System")
        .setEmoji(
          xpSettings.enabled ? EMOJIS.STATUS.ERROR : EMOJIS.STATUS.SUCCESS,
        )
        .setStyle(
          xpSettings.enabled ? ButtonStyle.Danger : ButtonStyle.Success,
        ),
      new ButtonBuilder()
        .setCustomId("xp_toggle_message")
        .setLabel(
          xpSettings.messageXP ? "Disable Message XP" : "Enable Message XP",
        )
        .setEmoji(EMOJIS.UI.MESSAGE)
        .setStyle(
          xpSettings.messageXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
        ),
      new ButtonBuilder()
        .setCustomId("xp_toggle_command")
        .setLabel(
          xpSettings.commandXP ? "Disable Command XP" : "Enable Command XP",
        )
        .setEmoji(EMOJIS.UI.COMMAND)
        .setStyle(
          xpSettings.commandXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
        ),
      new ButtonBuilder()
        .setCustomId("xp_toggle_role")
        .setLabel(xpSettings.roleXP ? "Disable Role XP" : "Enable Role XP")
        .setEmoji(EMOJIS.FEATURES.ROLES)
        .setStyle(
          xpSettings.roleXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
        ),
    ];

    const buttons = new ActionRowBuilder().addComponents(...buttonComponents);

    await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    const duration = Date.now() - startTime;
    logger.info(
      `XP settings displayed for guild ${interaction.guild.name} by user ${interaction.user.tag} in ${duration}ms`,
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error displaying XP settings after ${duration}ms`, error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to display XP settings.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
