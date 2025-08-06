import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import {
  hasAdminPermissions,
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../utils/discord/permissions.js";
import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { THEME_COLOR, EMOJIS } from "../../config/theme.js";
import { sanitizeInput } from "../../utils/discord/inputUtils.js";
import { getLogger } from "../../utils/logger.js";
import {
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

export const data = new SlashCommandBuilder()
  .setName("setup-welcome")
  .setDescription("Configure the welcome system for new members")
  .addChannelOption(option =>
    option
      .setName("channel")
      .setDescription("Channel where welcome messages will be sent")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("message")
      .setDescription(
        "Welcome message (use placeholders like {user}, {server})",
      )
      .setRequired(false),
  )
  .addRoleOption(option =>
    option
      .setName("auto-role")
      .setDescription("Role to automatically assign to new members")
      .setRequired(false),
  )
  .addBooleanOption(option =>
    option
      .setName("enabled")
      .setDescription("Enable or disable the welcome system")
      .setRequired(false),
  )
  .addBooleanOption(option =>
    option
      .setName("embed")
      .setDescription("Use embed format for welcome messages")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction, _client) {
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
          tip: "You need Manage Guild permissions to configure the welcome system.",
        }),
      );
    }

    // Validate bot permissions
    const requiredPermissions = ["SendMessages", "ManageRoles"];
    if (!botHasRequiredPermissions(interaction.guild, requiredPermissions)) {
      const missingPermissions = getMissingBotPermissions(
        interaction.guild,
        requiredPermissions,
      );
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      return interaction.editReply(
        errorEmbed({
          title: "Missing Bot Permissions",
          description: `I need the following permissions to configure the welcome system: **${permissionNames}**`,
          solution:
            "Please ask a server administrator to grant me these permissions and try again.",
          fields: [
            {
              name: "🔧 How to Fix",
              value:
                "Go to Server Settings → Roles → Find my role → Enable the missing permissions",
              inline: false,
            },
            {
              name: "📋 Required Permissions",
              value:
                "• Send Messages (to send welcome messages)\n• Manage Roles (to assign auto-roles)",
              inline: false,
            },
          ],
        }),
      );
    }

    // Get and validate inputs
    const channel = interaction.options.getChannel("channel");
    const message = interaction.options.getString("message");
    const autoRole = interaction.options.getRole("auto-role");
    const enabled = interaction.options.getBoolean("enabled");
    const embedEnabled = interaction.options.getBoolean("embed");

    // Validate channel permissions
    if (!channel.permissionsFor(interaction.client.user).has("SendMessages")) {
      return interaction.editReply(
        errorEmbed({
          title: "Channel Permission Error",
          description: `I don't have permission to send messages in ${channel.toString()}`,
          solution:
            "Please grant me Send Messages permission in the selected channel.",
        }),
      );
    }

    // Get database manager
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

    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Prepare new settings
    const newSettings = {
      ...currentSettings,
      channelId: channel.id,
      embedEnabled:
        embedEnabled !== null ? embedEnabled : currentSettings.embedEnabled,
    };

    // Handle enabled status - only allow enabling if channel is provided
    if (enabled !== null) {
      if (enabled && !channel) {
        return interaction.editReply(
          errorEmbed({
            title: "Cannot Enable Without Channel",
            description:
              "You must specify a channel to enable the welcome system.",
            solution:
              "Use `/setup-welcome channel:#your-channel enabled:true` to enable with a channel.",
          }),
        );
      }
      newSettings.enabled = enabled;
    } else {
      // If no enabled option provided, only enable if channel is being set
      newSettings.enabled = channel ? currentSettings.enabled || true : false;
    }

    // Update message if provided
    if (message) {
      newSettings.message = sanitizeInput(message);
    }

    // Update auto-role if provided
    if (autoRole) {
      // Validate auto-role permissions
      if (
        autoRole.position >= interaction.guild.members.me.roles.highest.position
      ) {
        return interaction.editReply(
          errorEmbed({
            title: "Auto-Role Permission Error",
            description: `I cannot assign the role ${autoRole.toString()} because it's higher than or equal to my highest role.`,
            solution:
              "Please move my role above the auto-role or choose a different role.",
          }),
        );
      }
      newSettings.autoRoleId = autoRole.id;
    }

    // Save settings
    await dbManager.welcomeSettings.set(interaction.guild.id, newSettings);

    // Create success embed
    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`${EMOJIS.STATUS.SUCCESS} Welcome System Configured`)
      .setDescription("Your welcome system has been successfully configured!")
      .addFields([
        {
          name: `${EMOJIS.UI.CHANNELS} Welcome Channel`,
          value: channel.toString(),
          inline: true,
        },
        {
          name: `${EMOJIS.STATUS.SUCCESS} Status`,
          value: newSettings.enabled ? "Enabled" : "Disabled",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.IMAGE} Format`,
          value: newSettings.embedEnabled ? "Embed" : "Text",
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.ROLES} Auto-Role`,
          value: autoRole ? autoRole.toString() : "None",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.QUESTION} Welcome Message`,
          value: newSettings.message || "Default message",
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

    // Only add test button if welcome system is enabled and channel is configured
    if (newSettings.enabled && newSettings.channelId) {
      buttonComponents.push(
        new ButtonBuilder()
          .setCustomId("welcome_test")
          .setLabel("Test Welcome")
          .setEmoji(EMOJIS.ACTIONS.QUICK)
          .setStyle(ButtonStyle.Primary),
      );
    }

    // Always show edit and toggle buttons
    buttonComponents.push(
      new ButtonBuilder()
        .setCustomId("welcome_edit")
        .setLabel("Edit Settings")
        .setEmoji(EMOJIS.ACTIONS.EDIT)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("welcome_disable")
        .setLabel(newSettings.enabled ? "Disable" : "Enable")
        .setEmoji(
          newSettings.enabled ? EMOJIS.STATUS.ERROR : EMOJIS.STATUS.SUCCESS,
        )
        .setStyle(
          newSettings.enabled ? ButtonStyle.Danger : ButtonStyle.Success,
        ),
    );

    const buttons = new ActionRowBuilder().addComponents(...buttonComponents);

    await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    logger.info(
      `Welcome system configured for ${interaction.guild.name} by ${interaction.user.tag} (${Date.now() - startTime}ms)`,
    );
  } catch (error) {
    logger.error(
      `Failed to configure welcome system for ${interaction.guild.name}`,
      error,
    );
    await interaction.editReply(
      errorEmbed({
        title: "Configuration Error",
        description: "An error occurred while configuring the welcome system.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
