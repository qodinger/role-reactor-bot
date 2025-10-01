import { getLogger } from "../../logger.js";
import { getDatabaseManager } from "../../storage/databaseManager.js";
import { errorEmbed, successEmbed } from "../../discord/responseMessages.js";
import { hasAdminPermissions } from "../../discord/permissions.js";
import { createGoodbyeSettingsEmbed } from "../../../commands/admin/goodbye/embeds.js";
import {
  createGoodbyeSettingsComponents,
  createChannelSelectComponents,
} from "../../../commands/admin/goodbye/components.js";
import {
  createGoodbyeEmbed,
  processGoodbyeMessage,
} from "../../discord/goodbyeUtils.js";

/**
 * Handle goodbye configure button
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleGoodbyeConfigure(interaction) {
  const logger = getLogger();

  try {
    // Check permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to configure the goodbye system.",
          solution: "Contact a server administrator for assistance.",
        }),
        { ephemeral: true },
      );
    }

    // Get current settings
    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

    // Create channel select components
    const components = createChannelSelectComponents(
      interaction.guild,
      currentSettings.channelId,
    );

    // Create embed for channel selection
    const embed = {
      title: "Configure Goodbye System",
      description:
        "Select a channel for goodbye messages, then configure the settings.",
      color: 0x5865f2,
      fields: [
        {
          name: "Step 1: Select Channel",
          value:
            "Choose a channel from the dropdown below where goodbye messages will be sent.",
          inline: false,
        },
        {
          name: "Step 2: Configure Settings",
          value:
            "After selecting a channel, you'll be able to configure the message, format, and other settings.",
          inline: false,
        },
      ],
    };

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });

    logger.info(
      `Goodbye channel select opened by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error("Error in handleGoodbyeConfigure:", error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to process configure request.",
          solution: "Please try again or contact support.",
        }),
      );
    }
  }
}

/**
 * Handle goodbye reset button
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleGoodbyeReset(interaction) {
  const logger = getLogger();

  try {
    // Check permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to reset the goodbye system.",
          solution: "Contact a server administrator for assistance.",
        }),
        { ephemeral: true },
      );
    }

    await interaction.deferUpdate();

    const dbManager = await getDatabaseManager();

    // Reset to default settings
    const defaultSettings = {
      guildId: interaction.guild.id,
      enabled: false,
      channelId: null,
      message: "Goodbye {user}! Thanks for being part of {server}! 👋",
      embedEnabled: true,
      embedColor: 0x7f7bf5,
      embedTitle: "👋 Goodbye from {server}!",
      embedDescription: "Thanks for being part of our community!",
      embedThumbnail: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await dbManager.goodbyeSettings.set(interaction.guild.id, defaultSettings);

    // Get updated settings
    const updatedSettings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

    const goodbyeChannel = updatedSettings.channelId
      ? interaction.guild.channels.cache.get(updatedSettings.channelId)
      : null;

    const embed = createGoodbyeSettingsEmbed(
      interaction,
      updatedSettings,
      goodbyeChannel,
    );

    const components = createGoodbyeSettingsComponents(updatedSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Goodbye system reset by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error("Error in handleGoodbyeReset:", error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to reset goodbye system.",
          solution: "Please try again or contact support.",
        }),
      );
    }
  }
}

/**
 * Handle goodbye system toggle
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleGoodbyeToggle(interaction) {
  const logger = getLogger();

  try {
    // Check permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to toggle the goodbye system.",
          solution: "Contact a server administrator for assistance.",
        }),
        { ephemeral: true },
      );
    }

    await interaction.deferUpdate();

    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

    // Toggle the enabled state
    const newSettings = {
      ...currentSettings,
      enabled: !currentSettings.enabled,
      updatedAt: new Date(),
    };

    await dbManager.goodbyeSettings.set(interaction.guild.id, newSettings);

    // Get updated settings
    const updatedSettings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

    const goodbyeChannel = updatedSettings.channelId
      ? interaction.guild.channels.cache.get(updatedSettings.channelId)
      : null;

    const embed = createGoodbyeSettingsEmbed(
      interaction,
      updatedSettings,
      goodbyeChannel,
    );

    const components = createGoodbyeSettingsComponents(updatedSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Goodbye system ${updatedSettings.enabled ? "enabled" : "disabled"} by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error("Error in handleGoodbyeToggle:", error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to toggle goodbye system.",
          solution: "Please try again or contact support.",
        }),
      );
    }
  }
}

/**
 * Handle goodbye format toggle
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleGoodbyeFormat(interaction) {
  const logger = getLogger();

  try {
    // Check permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to change the goodbye format.",
          solution: "Contact a server administrator for assistance.",
        }),
        { ephemeral: true },
      );
    }

    await interaction.deferUpdate();

    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

    // Toggle the embed format
    const newSettings = {
      ...currentSettings,
      embedEnabled: !currentSettings.embedEnabled,
      updatedAt: new Date(),
    };

    await dbManager.goodbyeSettings.set(interaction.guild.id, newSettings);

    // Get updated settings
    const updatedSettings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

    const goodbyeChannel = updatedSettings.channelId
      ? interaction.guild.channels.cache.get(updatedSettings.channelId)
      : null;

    const embed = createGoodbyeSettingsEmbed(
      interaction,
      updatedSettings,
      goodbyeChannel,
    );

    const components = createGoodbyeSettingsComponents(updatedSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Goodbye format changed to ${updatedSettings.embedEnabled ? "embed" : "text"} by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error("Error in handleGoodbyeFormat:", error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to change goodbye format.",
          solution: "Please try again or contact support.",
        }),
      );
    }
  }
}

/**
 * Handle goodbye test message
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleGoodbyeTest(interaction) {
  const logger = getLogger();

  try {
    // Check permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to test the goodbye system.",
          solution: "Contact a server administrator for assistance.",
        }),
        { ephemeral: true },
      );
    }

    await interaction.deferReply({ ephemeral: true });

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

    if (!settings.enabled || !settings.channelId) {
      return interaction.editReply(
        errorEmbed({
          title: "Goodbye System Not Configured",
          description:
            "The goodbye system is not enabled or no channel is set.",
          solution:
            "Use `/setup-goodbye` to configure the goodbye system first.",
        }),
      );
    }

    const goodbyeChannel = interaction.guild.channels.cache.get(
      settings.channelId,
    );

    if (!goodbyeChannel) {
      return interaction.editReply(
        errorEmbed({
          title: "Channel Not Found",
          description: "The configured goodbye channel no longer exists.",
          solution: "Use `/setup-goodbye` to set a new goodbye channel.",
        }),
      );
    }

    const member = interaction.member;

    // Process the test message
    const processedMessage = processGoodbyeMessage(settings.message, member);

    if (settings.embedEnabled) {
      const embed = createGoodbyeEmbed(settings, member);
      await goodbyeChannel.send({ embeds: [embed] });
    } else {
      await goodbyeChannel.send(processedMessage);
    }

    await interaction.editReply(
      successEmbed({
        title: "Test Message Sent",
        description: `A test goodbye message has been sent to ${goodbyeChannel}.`,
        solution:
          "Check the channel to see how the goodbye message will appear.",
      }),
    );

    logger.info(
      `Goodbye test message sent by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error("Error in handleGoodbyeTest:", error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to send test goodbye message.",
          solution: "Please try again or contact support.",
        }),
      );
    }
  }
}

/**
 * Handle goodbye settings edit
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleGoodbyeEdit(interaction) {
  const logger = getLogger();

  try {
    // Check permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to edit goodbye settings.",
          solution: "Contact a server administrator for assistance.",
        }),
        { ephemeral: true },
      );
    }

    await interaction.deferReply({ ephemeral: true });

    // Get database manager
    const dbManager = await getDatabaseManager();

    if (!dbManager.goodbyeSettings) {
      return interaction.editReply(
        errorEmbed({
          title: "Database Error",
          description: "Goodbye settings repository is not available.",
          solution: "Please try again later or contact support.",
        }),
      );
    }

    // Get current settings
    const settings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

    // Get goodbye channel
    const goodbyeChannel = settings.channelId
      ? interaction.guild.channels.cache.get(settings.channelId)
      : null;

    // Create response embed
    const embed = createGoodbyeSettingsEmbed(
      interaction,
      settings,
      goodbyeChannel,
    );

    // Create components
    const components = createGoodbyeSettingsComponents(settings);

    // Send response
    await interaction.editReply({
      embeds: [embed],
      components,
    });

    // Log the activity
    logger.info(
      `Goodbye settings viewed by ${interaction.user.tag} (${interaction.user.id}) in ${interaction.guild.name} (${interaction.guild.id})`,
    );
  } catch (error) {
    logger.error(
      `Failed to view goodbye settings for ${interaction.guild.name}`,
      error,
    );
    await interaction.editReply(
      errorEmbed({
        title: "Settings Error",
        description: "An error occurred while retrieving goodbye settings.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
