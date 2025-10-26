import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  createXpSettingsEmbed,
  createXpSourceEmbed,
  createLevelUpEmbed,
  createXpTestEmbed,
} from "./embeds.js";
import {
  createXpSettingsComponents,
  createXpSourceComponents,
  createLevelUpComponents,
  createChannelSelectMenu,
} from "./components.js";
import { EMOJIS } from "../../../config/theme.js";
import { updateXpSettings } from "./utils.js";

/**
 * Handle XP command (simplified single command)
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleXpCommand(interaction, _client) {
  const logger = getLogger();
  const startTime = Date.now();

  // Defer immediately to prevent timeout
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Get database manager
    const dbManager = await getDatabaseManager();

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

    // Get current settings
    let settings;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Database operation timed out")),
          3000,
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

    // Get level-up channel
    const levelUpChannel = xpSettings.levelUpChannel
      ? interaction.guild.channels.cache.get(xpSettings.levelUpChannel)
      : null;

    // Create settings embed and components
    const embed = createXpSettingsEmbed(
      interaction,
      xpSettings,
      levelUpChannel,
    );
    const components = createXpSettingsComponents(xpSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
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

/**
 * Handle XP general configuration (shows modal)
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleXpGeneralConfig(interaction) {
  const logger = getLogger();

  try {
    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    const xpSettings = settings.experienceSystem;

    // Get level-up channel
    const levelUpChannel = xpSettings.levelUpChannel
      ? interaction.guild.channels.cache.get(xpSettings.levelUpChannel)
      : null;

    // Import the configuration page components
    const { createXpConfigPageEmbed } = await import("./embeds.js");
    const { createXpConfigPageComponents } = await import("./components.js");

    const embed = createXpConfigPageEmbed(
      interaction,
      xpSettings,
      levelUpChannel,
    );
    const components = createXpConfigPageComponents(xpSettings);

    await interaction.update({
      embeds: [embed],
      components,
    });

    logger.info(
      `XP configuration page shown for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error showing XP configuration page:", error);

    // Defer the interaction if it hasn't been replied to yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to show configuration page.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

export async function handleXpBasicConfig(interaction) {
  const logger = getLogger();

  try {
    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    const xpSettings = settings.experienceSystem;

    // Import the basic modal
    const { createXpConfigModal } = await import("./modals.js");
    const modal = createXpConfigModal(xpSettings);

    await interaction.showModal(modal);

    logger.info(
      `XP basic configuration modal shown for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error showing XP basic configuration modal:", error);

    // Defer the interaction if it hasn't been replied to yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to show basic configuration modal.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

export async function handleXpAdvancedConfig(interaction) {
  const logger = getLogger();

  try {
    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    const xpSettings = settings.experienceSystem;

    // Import the advanced modal
    const { createXpAdvancedConfigModal } = await import("./modals.js");
    const modal = createXpAdvancedConfigModal(xpSettings);

    await interaction.showModal(modal);

    logger.info(
      `XP advanced configuration modal shown for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error showing XP advanced configuration modal:", error);

    // Defer the interaction if it hasn't been replied to yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to show advanced configuration modal.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle XP source configuration
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleXpSourceConfig(interaction) {
  const logger = getLogger();

  try {
    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    const xpSettings = settings.experienceSystem;

    const embed = createXpSourceEmbed(interaction, xpSettings);
    const components = createXpSourceComponents(xpSettings);

    await interaction.update({
      embeds: [embed],
      components,
    });

    logger.info(
      `XP source configuration displayed for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error displaying XP source configuration:", error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to display XP source configuration.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle level-up configuration
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleLevelUpConfig(interaction) {
  const logger = getLogger();

  try {
    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    const xpSettings = settings.experienceSystem;

    const levelUpChannel = xpSettings.levelUpChannel
      ? interaction.guild.channels.cache.get(xpSettings.levelUpChannel)
      : null;

    const embed = createLevelUpEmbed(interaction, xpSettings, levelUpChannel);
    const components = createLevelUpComponents(xpSettings);

    await interaction.update({
      embeds: [embed],
      components,
    });

    logger.info(
      `Level-up configuration displayed for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error displaying level-up configuration:", error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to display level-up configuration.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle XP test
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleXpTest(interaction) {
  const logger = getLogger();

  try {
    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    const xpSettings = settings.experienceSystem;

    const embed = createXpTestEmbed(interaction, xpSettings);
    const components = createXpSettingsComponents(xpSettings);

    await interaction.update({
      embeds: [embed],
      components,
    });

    logger.info(
      `XP test displayed for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error displaying XP test:", error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to display XP test.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle XP channel configuration
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleXpChannelConfig(interaction) {
  const logger = getLogger();

  try {
    // Get available text channels
    const textChannels = interaction.guild.channels.cache
      .filter(channel => channel.type === 0)
      .map(channel => ({
        id: channel.id,
        name: channel.name,
      }))
      .slice(0, 25); // Discord limit

    if (textChannels.length === 0) {
      return interaction.reply(
        errorEmbed({
          title: "No Channels Available",
          description: "No text channels found in this server.",
          solution: "Create a text channel first, then try again.",
        }),
      );
    }

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    const xpSettings = settings.experienceSystem;

    const embed = createLevelUpEmbed(
      interaction,
      xpSettings,
      null, // No channel selected yet
    );
    const channelSelectMenu = createChannelSelectMenu(
      textChannels,
      xpSettings.levelUpChannel,
    );

    // Create only the back button for channel selection
    const backButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("back_to_settings")
        .setLabel("Back to Settings")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.ACTIONS.BACK),
    );

    await interaction.update({
      embeds: [embed],
      components: [channelSelectMenu, backButton],
    });

    logger.info(
      `Channel selection displayed for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error displaying channel configuration:", error);

    // Defer the interaction if it hasn't been replied to yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to display channel configuration.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle XP configuration modal submit
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
export async function handleXpConfigModalSubmit(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferUpdate();

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    const xpSettings = settings.experienceSystem;

    // Get values from modal
    const messageXpMin = parseInt(
      interaction.fields.getTextInputValue("message_xp_min"),
    );
    const messageXpMax = parseInt(
      interaction.fields.getTextInputValue("message_xp_max"),
    );
    const commandXpAmount = parseInt(
      interaction.fields.getTextInputValue("command_xp_amount"),
    );
    const roleXpAmount = parseInt(
      interaction.fields.getTextInputValue("role_xp_amount"),
    );
    const voiceXpAmount = parseInt(
      interaction.fields.getTextInputValue("voice_xp_amount"),
    );

    // Use existing values for cooldowns (not in modal due to Discord 5 ActionRow limit)
    const messageCooldown = xpSettings.messageCooldown;
    const commandCooldown = xpSettings.commandCooldown;

    // Validate inputs - check for NaN first
    if (isNaN(messageXpMin) || messageXpMin < 1 || messageXpMin > 100) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Input",
          description:
            "Message XP minimum must be a valid number between 1 and 100.",
          solution: "Please enter a valid number and try again.",
        }),
      );
    }

    if (
      isNaN(messageXpMax) ||
      messageXpMax < 1 ||
      messageXpMax > 100 ||
      messageXpMax < messageXpMin
    ) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Input",
          description:
            "Message XP maximum must be a valid number between 1 and 100, and greater than or equal to minimum.",
          solution: "Please enter a valid number and try again.",
        }),
      );
    }

    if (
      isNaN(commandXpAmount) ||
      commandXpAmount < 1 ||
      commandXpAmount > 100
    ) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Input",
          description:
            "Command XP amount must be a valid number between 1 and 100.",
          solution: "Please enter a valid number and try again.",
        }),
      );
    }

    if (isNaN(roleXpAmount) || roleXpAmount < 1 || roleXpAmount > 1000) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Input",
          description:
            "Role XP amount must be a valid number between 1 and 1000.",
          solution: "Please enter a valid number and try again.",
        }),
      );
    }

    if (isNaN(voiceXpAmount) || voiceXpAmount < 1 || voiceXpAmount > 50) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Input",
          description:
            "Voice XP amount must be a valid number between 1 and 50.",
          solution: "Please enter a valid number and try again.",
        }),
      );
    }

    // Cooldown validation removed - using existing values due to Discord modal limit

    // Update settings
    const updatedSettings = {
      ...xpSettings,
      messageXPAmount: { min: messageXpMin, max: messageXpMax },
      commandXPAmount: { base: commandXpAmount },
      roleXPAmount: roleXpAmount,
      voiceXPAmount: voiceXpAmount,
      messageCooldown,
      commandCooldown,
    };

    await updateXpSettings(interaction.guild.id, updatedSettings, dbManager);

    // Get level-up channel
    const levelUpChannel = updatedSettings.levelUpChannel
      ? interaction.guild.channels.cache.get(updatedSettings.levelUpChannel)
      : null;

    // Create updated configuration page embed and components
    const { createXpConfigPageEmbed } = await import("./embeds.js");
    const { createXpConfigPageComponents } = await import("./components.js");

    const embed = createXpConfigPageEmbed(
      interaction,
      updatedSettings,
      levelUpChannel,
    );
    const components = createXpConfigPageComponents(updatedSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `XP configuration updated for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling XP configuration modal submit:", error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to update XP configuration.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

export async function handleXpAdvancedConfigModalSubmit(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferUpdate();

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    const xpSettings = settings.experienceSystem;

    // Get values from modal
    const messageCooldown = parseInt(
      interaction.fields.getTextInputValue("message_cooldown"),
    );
    const commandCooldown = parseInt(
      interaction.fields.getTextInputValue("command_cooldown"),
    );
    const voiceXpInterval = parseInt(
      interaction.fields.getTextInputValue("voice_xp_interval"),
    );

    // Validate inputs
    if (
      isNaN(messageCooldown) ||
      messageCooldown < 10 ||
      messageCooldown > 300
    ) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Input",
          description:
            "Message cooldown must be a valid number between 10 and 300 seconds.",
          solution: "Please enter a valid number and try again.",
        }),
      );
    }

    if (
      isNaN(commandCooldown) ||
      commandCooldown < 5 ||
      commandCooldown > 120
    ) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Input",
          description:
            "Command cooldown must be a valid number between 5 and 120 seconds.",
          solution: "Please enter a valid number and try again.",
        }),
      );
    }

    if (isNaN(voiceXpInterval) || voiceXpInterval < 1 || voiceXpInterval > 60) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Input",
          description:
            "Voice XP interval must be a valid number between 1 and 60 minutes.",
          solution: "Please enter a valid number and try again.",
        }),
      );
    }

    // Level-up validation removed - handled by Level-Up Messages button

    // Update settings
    const updatedSettings = {
      ...xpSettings,
      messageCooldown,
      commandCooldown,
      voiceXpInterval,
    };

    await updateXpSettings(interaction.guild.id, updatedSettings, dbManager);

    // Get level-up channel
    const levelUpChannelObj = updatedSettings.levelUpChannel
      ? interaction.guild.channels.cache.get(updatedSettings.levelUpChannel)
      : null;

    // Create updated configuration page embed and components
    const { createXpConfigPageEmbed } = await import("./embeds.js");
    const { createXpConfigPageComponents } = await import("./components.js");

    const embed = createXpConfigPageEmbed(
      interaction,
      updatedSettings,
      levelUpChannelObj,
    );
    const components = createXpConfigPageComponents(updatedSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `XP advanced configuration updated for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error(
      "Error handling XP advanced configuration modal submit:",
      error,
    );
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to update XP advanced configuration.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle XP channel selection
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
export async function handleXpChannelSelect(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferUpdate();

    const selectedChannelId = interaction.values[0];
    const selectedChannel =
      interaction.guild.channels.cache.get(selectedChannelId);

    if (!selectedChannel) {
      return interaction.editReply(
        errorEmbed({
          title: "Channel Not Found",
          description: "The selected channel could not be found.",
          solution: "Please try selecting a different channel.",
        }),
      );
    }

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );

    // Update the level-up channel
    const updatedSettings = {
      ...settings,
      experienceSystem: {
        ...settings.experienceSystem,
        levelUpChannel: selectedChannelId,
      },
    };

    await dbManager.guildSettings.set(interaction.guild.id, updatedSettings);

    // Create updated embed and components
    const embed = createLevelUpEmbed(
      interaction,
      updatedSettings.experienceSystem,
      selectedChannel,
    );
    const components = createLevelUpComponents(
      updatedSettings.experienceSystem,
    );

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Level-up channel set to ${selectedChannel.name} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling XP channel selection:", error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to update level-up channel.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle XP test level-up
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleXpTestLevelUp(interaction) {
  const logger = getLogger();

  try {
    // Get level-up notifier
    const { getLevelUpNotifier } = await import(
      "../../../features/experience/LevelUpNotifier.js"
    );
    const levelUpNotifier = await getLevelUpNotifier();

    // Send test level-up notification
    await levelUpNotifier.sendLevelUpNotification(
      interaction.guild,
      interaction.user,
      1, // old level
      2, // new level
      150, // total XP
    );

    await interaction.reply({
      content: "🎉 Test level-up message sent! Check the configured channel.",
      flags: MessageFlags.Ephemeral,
    });

    logger.info(
      `Test level-up message sent for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error sending test level-up message:", error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to send test level-up message.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
