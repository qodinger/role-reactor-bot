import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import {
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../../utils/discord/permissions.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { createWelcomeSettingsEmbed } from "./embeds.js";
import { createWelcomeSettingsComponents } from "./components.js";
import { validateWelcomeInputs, processWelcomeSettings } from "./utils.js";

/**
 * Handle the welcome setup logic
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleSetup(interaction, _client) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Validate bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
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

    // Process and validate welcome settings
    const validationResult = validateWelcomeInputs(
      interaction,
      channel,
      autoRole,
      enabled !== null ? enabled : true, // enabled
    );
    if (!validationResult.isValid) {
      return interaction.editReply(validationResult.errorEmbed);
    }

    // Process welcome settings
    const newSettings = processWelcomeSettings(
      currentSettings,
      channel,
      message,
      autoRole,
      enabled !== null ? enabled : true, // enabled
      embedEnabled !== null ? embedEnabled : true, // embedEnabled
    );

    // Save settings
    await dbManager.welcomeSettings.set(interaction.guild.id, newSettings);

    // Get channel and role objects for display
    const welcomeChannel = newSettings.channelId
      ? interaction.guild.channels.cache.get(newSettings.channelId)
      : null;
    const autoRoleObj = newSettings.autoRoleId
      ? interaction.guild.roles.cache.get(newSettings.autoRoleId)
      : null;

    // Create success embed and components
    const embed = createWelcomeSettingsEmbed(
      interaction,
      newSettings,
      welcomeChannel,
      autoRoleObj,
    );
    const components = createWelcomeSettingsComponents(newSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
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

/**
 * Handle the welcome settings logic
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleSettings(interaction, _client) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

    // Create settings embed and components
    const embed = createWelcomeSettingsEmbed(
      interaction,
      settings,
      welcomeChannel,
      autoRole,
    );
    const components = createWelcomeSettingsComponents(settings);

    await interaction.editReply({
      embeds: [embed],
      components,
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
