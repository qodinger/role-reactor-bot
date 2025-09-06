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
      components,
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
      components,
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
      components,
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
      components,
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
 * Handle message XP configuration
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleXPConfigMessage = async interaction => {
  const logger = getLogger();

  try {
    // Import required modules
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } =
      await import("discord.js");
    const { getDatabaseManager } = await import(
      "../../storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );

    const currentMin = settings.experienceSystem.messageXPAmount.min;
    const currentMax = settings.experienceSystem.messageXPAmount.max;

    // Create modal for message XP configuration
    const modal = new ModalBuilder()
      .setCustomId("xp_config_message_modal")
      .setTitle("Configure Message XP");

    const minInput = new TextInputBuilder()
      .setCustomId("message_xp_min")
      .setLabel("Minimum XP per message")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter minimum XP (1-100)")
      .setValue(currentMin.toString())
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

    const maxInput = new TextInputBuilder()
      .setCustomId("message_xp_max")
      .setLabel("Maximum XP per message")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter maximum XP (1-100)")
      .setValue(currentMax.toString())
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

    const firstActionRow = new ActionRowBuilder().addComponents(minInput);
    const secondActionRow = new ActionRowBuilder().addComponents(maxInput);

    modal.addComponents(firstActionRow, secondActionRow);

    await interaction.showModal(modal);

    logger.info(
      `Message XP configuration modal shown to ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error("Error handling message XP configuration", error);
    await handleXPError(interaction, "opening message XP configuration");
  }
};

/**
 * Handle command XP configuration
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleXPConfigCommand = async interaction => {
  const logger = getLogger();

  try {
    // Import required modules
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } =
      await import("discord.js");
    const { getDatabaseManager } = await import(
      "../../storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );

    const currentBase = settings.experienceSystem.commandXPAmount.base;

    // Create modal for command XP configuration
    const modal = new ModalBuilder()
      .setCustomId("xp_config_command_modal")
      .setTitle("Configure Command XP");

    const baseInput = new TextInputBuilder()
      .setCustomId("command_xp_base")
      .setLabel("Base XP for commands")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter base XP (1-50)")
      .setValue(currentBase.toString())
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2);

    const actionRow = new ActionRowBuilder().addComponents(baseInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);

    logger.info(
      `Command XP configuration modal shown to ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error("Error handling command XP configuration", error);
    await handleXPError(interaction, "opening command XP configuration");
  }
};

/**
 * Handle role XP configuration
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleXPConfigRole = async interaction => {
  const logger = getLogger();

  try {
    // Import required modules
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } =
      await import("discord.js");
    const { getDatabaseManager } = await import(
      "../../storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );

    const currentAmount = settings.experienceSystem.roleXPAmount;

    // Create modal for role XP configuration
    const modal = new ModalBuilder()
      .setCustomId("xp_config_role_modal")
      .setTitle("Configure Role XP");

    const amountInput = new TextInputBuilder()
      .setCustomId("role_xp_amount")
      .setLabel("XP amount for role assignments")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter XP amount (1-200)")
      .setValue(currentAmount.toString())
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

    const actionRow = new ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);

    logger.info(
      `Role XP configuration modal shown to ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error("Error handling role XP configuration", error);
    await handleXPError(interaction, "opening role XP configuration");
  }
};

/**
 * Handle toggle all XP sources
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleXPToggleAll = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferUpdate();

    // Import required modules
    const { getDatabaseManager } = await import(
      "../../storage/databaseManager.js"
    );
    const { createXpSettingsEmbed } = await import(
      "../../../commands/admin/xp-settings/embeds.js"
    );
    const { createXpSettingsComponents } = await import(
      "../../../commands/admin/xp-settings/components.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );

    // Check if all XP sources are currently enabled
    const allEnabled =
      settings.experienceSystem.messageXP &&
      settings.experienceSystem.commandXP &&
      settings.experienceSystem.roleXP;

    // Toggle all XP sources
    const newSettings = {
      ...settings,
      experienceSystem: {
        ...settings.experienceSystem,
        messageXP: !allEnabled,
        commandXP: !allEnabled,
        roleXP: !allEnabled,
      },
    };

    // Save the updated settings
    await dbManager.guildSettings.set(interaction.guild.id, newSettings);

    // Create updated embed and components
    const embed = createXpSettingsEmbed(
      interaction,
      newSettings.experienceSystem,
    );
    const components = createXpSettingsComponents(newSettings.experienceSystem);

    // Update the original message
    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `${allEnabled ? "Disabled" : "Enabled"} all XP sources for ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error("Error handling toggle all XP", error);
    await handleXPError(interaction, "toggling all XP sources");
  }
};

/**
 * Handle XP configuration modal submissions
 * @param {import('discord.js').ModalSubmitInteraction} interaction - The modal interaction
 */
export const handleXPConfigModal = async interaction => {
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

    const newSettings = { ...settings };
    let successMessage = "";

    switch (interaction.customId) {
      case "xp_config_message_modal": {
        const minXP = parseInt(
          interaction.fields.getTextInputValue("message_xp_min"),
        );
        const maxXP = parseInt(
          interaction.fields.getTextInputValue("message_xp_max"),
        );

        // Validation
        if (
          isNaN(minXP) ||
          isNaN(maxXP) ||
          minXP < 1 ||
          maxXP < 1 ||
          minXP > 100 ||
          maxXP > 100
        ) {
          throw new Error(
            "Invalid XP values. Please enter numbers between 1 and 100.",
          );
        }
        if (minXP > maxXP) {
          throw new Error("Minimum XP cannot be greater than maximum XP.");
        }

        newSettings.experienceSystem.messageXPAmount = {
          min: minXP,
          max: maxXP,
        };
        successMessage = `Message XP range updated to ${minXP}-${maxXP} XP`;
        break;
      }

      case "xp_config_command_modal": {
        const baseXP = parseInt(
          interaction.fields.getTextInputValue("command_xp_base"),
        );

        // Validation
        if (isNaN(baseXP) || baseXP < 1 || baseXP > 50) {
          throw new Error(
            "Invalid base XP value. Please enter a number between 1 and 50.",
          );
        }

        newSettings.experienceSystem.commandXPAmount.base = baseXP;
        successMessage = `Command base XP updated to ${baseXP} XP`;
        break;
      }

      case "xp_config_role_modal": {
        const roleXP = parseInt(
          interaction.fields.getTextInputValue("role_xp_amount"),
        );

        // Validation
        if (isNaN(roleXP) || roleXP < 1 || roleXP > 200) {
          throw new Error(
            "Invalid role XP value. Please enter a number between 1 and 200.",
          );
        }

        newSettings.experienceSystem.roleXPAmount = roleXP;
        successMessage = `Role XP amount updated to ${roleXP} XP`;
        break;
      }

      default:
        throw new Error("Unknown configuration modal");
    }

    // Save the updated settings
    await dbManager.guildSettings.set(interaction.guild.id, newSettings);

    // Create updated embed and components
    const embed = createXpSettingsEmbed(
      interaction,
      newSettings.experienceSystem,
    );
    const components = createXpSettingsComponents(newSettings.experienceSystem);

    await interaction.editReply({
      embeds: [embed],
      components,
      content: `✅ ${successMessage}`,
    });

    logger.info(
      `XP configuration updated by ${interaction.user.tag} in ${interaction.guild.name}: ${successMessage}`,
    );
  } catch (error) {
    logger.error("Error handling XP configuration modal", error);
    await handleXPError(interaction, "updating XP configuration");
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
