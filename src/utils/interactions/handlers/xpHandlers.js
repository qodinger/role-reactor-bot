import { getLogger } from "../../logger.js";
import { createXpSettingsEmbed } from "../../../commands/admin/xp-settings/embeds.js";
import { createXpSettingsComponents } from "../../../commands/admin/xp-settings/components.js";

/**
 * XP system button interaction handlers
 * Handles all XP-related button interactions
 */

/**
 * Handle XP system toggle button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleXPToggleSystem = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferUpdate();

    // Import required modules
    const { getDatabaseManager } = await import(
      "../../storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );

    // Toggle the enabled status
    const newSettings = {
      ...settings,
      experienceSystem: {
        ...settings.experienceSystem,
        enabled: !settings.experienceSystem.enabled,
      },
    };

    await dbManager.guildSettings.set(interaction.guild.id, newSettings);

    // Create updated embed and components
    const embed = createXpSettingsEmbed(
      interaction,
      newSettings.experienceSystem,
    );
    const components = createXpSettingsComponents(newSettings.experienceSystem);

    await interaction.editReply({
      embeds: [embed],
      components: [components],
    });

    logger.info(
      `XP system ${newSettings.experienceSystem.enabled ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling XP system toggle", error);
    await handleXPError(interaction, "toggling the XP system");
  }
};

/**
 * Handle message XP toggle button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleXPToggleMessage = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferUpdate();

    const { getDatabaseManager } = await import(
      "../../storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );

    const newSettings = {
      ...settings,
      experienceSystem: {
        ...settings.experienceSystem,
        messageXP: !settings.experienceSystem.messageXP,
      },
    };

    await dbManager.guildSettings.set(interaction.guild.id, newSettings);

    // Create updated embed and components
    const embed = createXpSettingsEmbed(
      interaction,
      newSettings.experienceSystem,
    );
    const components = createXpSettingsComponents(newSettings.experienceSystem);

    await interaction.editReply({
      embeds: [embed],
      components: [components],
    });

    logger.info(
      `Message XP ${newSettings.experienceSystem.messageXP ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling message XP toggle", error);
    await handleXPError(interaction, "toggling message XP");
  }
};

/**
 * Handle command XP toggle button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleXPToggleCommand = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferUpdate();

    const { getDatabaseManager } = await import(
      "../../storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );

    const newSettings = {
      ...settings,
      experienceSystem: {
        ...settings.experienceSystem,
        commandXP: !settings.experienceSystem.commandXP,
      },
    };

    await dbManager.guildSettings.set(interaction.guild.id, newSettings);

    // Create updated embed and components
    const embed = createXpSettingsEmbed(
      interaction,
      newSettings.experienceSystem,
    );
    const components = createXpSettingsComponents(newSettings.experienceSystem);

    await interaction.editReply({
      embeds: [embed],
      components: [components],
    });

    logger.info(
      `Command XP ${newSettings.experienceSystem.commandXP ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling command XP toggle", error);
    await handleXPError(interaction, "toggling command XP");
  }
};

/**
 * Handle role XP toggle button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleXPToggleRole = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferUpdate();

    const { getDatabaseManager } = await import(
      "../../storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );

    const newSettings = {
      ...settings,
      experienceSystem: {
        ...settings.experienceSystem,
        roleXP: !settings.experienceSystem.roleXP,
      },
    };

    await dbManager.guildSettings.set(interaction.guild.id, newSettings);

    // Create updated embed and components
    const embed = createXpSettingsEmbed(
      interaction,
      newSettings.experienceSystem,
    );
    const components = createXpSettingsComponents(newSettings.experienceSystem);

    await interaction.editReply({
      embeds: [embed],
      components: [components],
    });

    logger.info(
      `Role XP ${newSettings.experienceSystem.roleXP ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling role XP toggle", error);
    await handleXPError(interaction, "toggling role XP");
  }
};

/**
 * Handle XP system errors
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 * @param {string} action - The action that failed
 */
const handleXPError = async (interaction, action) => {
  const logger = getLogger();

  // Only respond if the interaction hasn't been responded to yet
  if (!interaction.replied && !interaction.deferred) {
    try {
      await interaction.reply({
        content: `❌ An error occurred while ${action}.`,
        flags: 64,
      });
    } catch (replyError) {
      logger.error("Error sending error reply", replyError);
    }
  } else if (interaction.deferred) {
    try {
      await interaction.editReply({
        content: `❌ An error occurred while ${action}.`,
      });
    } catch (editError) {
      logger.error("Error sending error edit reply", editError);
    }
  }
};
