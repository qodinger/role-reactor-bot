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
  .setName("welcome-settings")
  .setDescription("View and manage welcome system settings")
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
          tip: "You need Manage Guild permissions to view welcome settings.",
        }),
      );
    }

    // Get database manager and settings
    const dbManager = await getDatabaseManager();

    // Check if welcome settings repository is available
    if (!dbManager.welcomeSettings) {
      return interaction.editReply(
        errorEmbed({
          title: "Database Error",
          description: "Welcome settings repository is not available.",
          solution:
            "Please restart the bot or contact support if the issue persists.",
        }),
      );
    }

    let settings;
    try {
      settings = await dbManager.welcomeSettings.getByGuild(
        interaction.guild.id,
      );
    } catch (error) {
      logger.error(
        `Failed to retrieve welcome settings for guild ${interaction.guild.id}`,
        error,
      );
      return interaction.editReply(
        errorEmbed({
          title: "Database Error",
          description: "Failed to retrieve welcome settings from database.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }

    // Get channel and role objects
    const welcomeChannel = settings.channelId
      ? interaction.guild.channels.cache.get(settings.channelId)
      : null;
    const autoRole = settings.autoRoleId
      ? interaction.guild.roles.cache.get(settings.autoRoleId)
      : null;

    // Create settings embed
    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`${EMOJIS.FEATURES.ROLES} Welcome System Settings`)
      .setDescription("Current configuration for the welcome system")
      .addFields([
        {
          name: `${EMOJIS.STATUS.SUCCESS} Status`,
          value: settings.enabled ? "🟢 Enabled" : "🔴 Disabled",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.CHANNELS} Welcome Channel`,
          value: welcomeChannel ? welcomeChannel.toString() : "Not set",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.IMAGE} Message Format`,
          value: settings.embedEnabled ? "📋 Embed" : "💬 Text",
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.ROLES} Auto-Role`,
          value: autoRole ? autoRole.toString() : "None",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.QUESTION} Welcome Message`,
          value: settings.message || "Default message",
          inline: false,
        },
        {
          name: `${EMOJIS.UI.INFO} Available Placeholders`,
          value:
            "`{user}` - User mention\n`{user.name}` - Username\n`{user.tag}` - User tag\n`{user.id}` - User ID\n`{server}` - Server name\n`{server.id}` - Server ID\n`{memberCount}` - Member count\n`{memberCount.ordinal}` - Ordinal member count",
          inline: false,
        },
      ])
      .setFooter({
        text: `${EMOJIS.FEATURES.ROLES} Welcome System • ${interaction.guild.name}`,
        iconURL: interaction.guild.iconURL(),
      })
      .setTimestamp();

    // Create action buttons - only show test button if system is properly configured
    const buttonComponents = [];

    // Always show configure button
    buttonComponents.push(
      new ButtonBuilder()
        .setCustomId("welcome_configure")
        .setLabel("Configure")
        .setEmoji(EMOJIS.ACTIONS.EDIT)
        .setStyle(ButtonStyle.Primary),
    );

    // Only add test button if welcome system is enabled and channel is configured
    if (settings.enabled && settings.channelId) {
      buttonComponents.push(
        new ButtonBuilder()
          .setCustomId("welcome_test")
          .setLabel("Test Welcome")
          .setEmoji(EMOJIS.ACTIONS.QUICK)
          .setStyle(ButtonStyle.Secondary),
      );
    }

    // Show toggle button (disabled if no channel and system is disabled)
    const canToggle = settings.channelId || settings.enabled;
    buttonComponents.push(
      new ButtonBuilder()
        .setCustomId("welcome_toggle")
        .setLabel(settings.enabled ? "Disable" : "Enable")
        .setEmoji(
          settings.enabled ? EMOJIS.STATUS.ERROR : EMOJIS.STATUS.SUCCESS,
        )
        .setStyle(settings.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
        .setDisabled(!canToggle),
      new ButtonBuilder()
        .setCustomId("welcome_reset")
        .setLabel("Reset")
        .setEmoji(EMOJIS.ACTIONS.DELETE)
        .setStyle(ButtonStyle.Secondary),
    );

    const buttons = new ActionRowBuilder().addComponents(...buttonComponents);

    await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    logger.info(
      `Welcome settings viewed for ${interaction.guild.name} by ${interaction.user.tag} (${Date.now() - startTime}ms)`,
    );
  } catch (error) {
    logger.error(
      `Failed to view welcome settings for ${interaction.guild.name}`,
      error,
    );
    await interaction.editReply(
      errorEmbed({
        title: "Settings Error",
        description: "An error occurred while retrieving welcome settings.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
