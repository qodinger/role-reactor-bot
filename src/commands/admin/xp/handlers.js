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
import { EMOJIS, THEME } from "../../../config/theme.js";
import { updateXpSettings } from "./utils.js";
import {
  validateModalInput,
  createFormValidationErrorEmbed,
} from "../../../utils/validation/formValidation.js";

/**
 * Handle XP command (simplified single command)
 * @param {import('discord.js').CommandInteraction | import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').Client} _client
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
      components: components.map(c => c.toJSON()),
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
      components: components.map(c => c.toJSON()),
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
      components: components.map(c => c.toJSON()),
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
    await interaction.deferUpdate();

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

    await interaction.editReply({
      embeds: [embed],
      components: components.map(c => c.toJSON()),
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
      components: components.map(c => c.toJSON()),
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

    // Get current level-up channel if set
    const currentChannel = xpSettings.levelUpChannel
      ? interaction.guild.channels.cache.get(xpSettings.levelUpChannel)
      : null;

    const embed = createLevelUpEmbed(interaction, xpSettings, currentChannel);
    const channelSelectMenu = createChannelSelectMenu(
      textChannels,
      xpSettings.levelUpChannel,
    );

    // Create only the back button for channel selection
    const backButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("back_to_settings")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.ACTIONS.BACK),
    );

    await interaction.update({
      embeds: [embed],
      components: [channelSelectMenu.toJSON(), backButton.toJSON()],
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

    // Get and validate values from modal
    const rawMessageXpMin =
      interaction.fields.getTextInputValue("message_xp_min");
    const rawMessageXpMax =
      interaction.fields.getTextInputValue("message_xp_max");
    const rawCommandXpAmount =
      interaction.fields.getTextInputValue("command_xp_amount");
    const rawRoleXpAmount =
      interaction.fields.getTextInputValue("role_xp_amount");
    const rawVoiceXpAmount =
      interaction.fields.getTextInputValue("voice_xp_amount");

    // Validate all inputs with specific error messages
    const messageXpMinValidation = validateModalInput(
      rawMessageXpMin,
      "Message XP Minimum",
      {
        required: true,
        maxLength: 10,
        customValidation: val => {
          const num = parseInt(val);
          if (isNaN(num)) return "Must be a valid number";
          if (num < 1 || num > 100) return "Must be between 1 and 100";
          return true;
        },
      },
    );
    if (!messageXpMinValidation.valid) {
      return interaction.editReply({ embeds: [messageXpMinValidation.error] });
    }

    const messageXpMaxValidation = validateModalInput(
      rawMessageXpMax,
      "Message XP Maximum",
      {
        required: true,
        maxLength: 10,
        customValidation: val => {
          const num = parseInt(val);
          if (isNaN(num)) return "Must be a valid number";
          if (num < 1 || num > 100) return "Must be between 1 and 100";
          return true;
        },
      },
    );
    if (!messageXpMaxValidation.valid) {
      return interaction.editReply({ embeds: [messageXpMaxValidation.error] });
    }

    const commandXpValidation = validateModalInput(
      rawCommandXpAmount,
      "Command XP Amount",
      {
        required: true,
        maxLength: 10,
        customValidation: val => {
          const num = parseInt(val);
          if (isNaN(num)) return "Must be a valid number";
          if (num < 1 || num > 100) return "Must be between 1 and 100";
          return true;
        },
      },
    );
    if (!commandXpValidation.valid) {
      return interaction.editReply({ embeds: [commandXpValidation.error] });
    }

    const roleXpValidation = validateModalInput(
      rawRoleXpAmount,
      "Role XP Amount",
      {
        required: true,
        maxLength: 10,
        customValidation: val => {
          const num = parseInt(val);
          if (isNaN(num)) return "Must be a valid number";
          if (num < 1 || num > 1000) return "Must be between 1 and 1000";
          return true;
        },
      },
    );
    if (!roleXpValidation.valid) {
      return interaction.editReply({ embeds: [roleXpValidation.error] });
    }

    const voiceXpValidation = validateModalInput(
      rawVoiceXpAmount,
      "Voice XP Amount",
      {
        required: true,
        maxLength: 10,
        customValidation: val => {
          const num = parseInt(val);
          if (isNaN(num)) return "Must be a valid number";
          if (num < 1 || num > 50) return "Must be between 1 and 50";
          return true;
        },
      },
    );
    if (!voiceXpValidation.valid) {
      return interaction.editReply({ embeds: [voiceXpValidation.error] });
    }

    // Parse validated values
    const messageXpMin = parseInt(messageXpMinValidation.sanitized);
    const messageXpMax = parseInt(messageXpMaxValidation.sanitized);
    const commandXpAmount = parseInt(commandXpValidation.sanitized);
    const roleXpAmount = parseInt(roleXpValidation.sanitized);
    const voiceXpAmount = parseInt(voiceXpValidation.sanitized);

    // Additional cross-field validation: max must be >= min
    if (messageXpMax < messageXpMin) {
      return interaction.editReply(
        createFormValidationErrorEmbed(
          "Invalid XP Range",
          "Message XP maximum must be greater than or equal to minimum.",
          "Please ensure the maximum XP value is not less than the minimum.",
        ),
      );
    }

    // Use existing values for cooldowns (not in modal due to Discord 5 ActionRow limit)
    const messageCooldown = xpSettings.messageCooldown;
    const commandCooldown = xpSettings.commandCooldown;

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
      components: components.map(c => c.toJSON()),
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

    // Get and validate values from modal
    const rawMessageCooldown =
      interaction.fields.getTextInputValue("message_cooldown");
    const rawCommandCooldown =
      interaction.fields.getTextInputValue("command_cooldown");
    const rawVoiceXpInterval =
      interaction.fields.getTextInputValue("voice_xp_interval");

    const messageCooldownValidation = validateModalInput(
      rawMessageCooldown,
      "Message Cooldown",
      {
        required: true,
        maxLength: 10,
        customValidation: val => {
          const num = parseInt(val);
          if (isNaN(num)) return "Must be a valid number";
          if (num < 10 || num > 300)
            return "Must be between 10 and 300 seconds";
          return true;
        },
      },
    );
    if (!messageCooldownValidation.valid) {
      return interaction.editReply({
        embeds: [messageCooldownValidation.error],
      });
    }

    const commandCooldownValidation = validateModalInput(
      rawCommandCooldown,
      "Command Cooldown",
      {
        required: true,
        maxLength: 10,
        customValidation: val => {
          const num = parseInt(val);
          if (isNaN(num)) return "Must be a valid number";
          if (num < 5 || num > 120) return "Must be between 5 and 120 seconds";
          return true;
        },
      },
    );
    if (!commandCooldownValidation.valid) {
      return interaction.editReply({
        embeds: [commandCooldownValidation.error],
      });
    }

    const voiceXpIntervalValidation = validateModalInput(
      rawVoiceXpInterval,
      "Voice XP Interval",
      {
        required: true,
        maxLength: 10,
        customValidation: val => {
          const num = parseInt(val);
          if (isNaN(num)) return "Must be a valid number";
          if (num < 1 || num > 60) return "Must be between 1 and 60 minutes";
          return true;
        },
      },
    );
    if (!voiceXpIntervalValidation.valid) {
      return interaction.editReply({
        embeds: [voiceXpIntervalValidation.error],
      });
    }

    // Parse validated values
    const messageCooldown = parseInt(messageCooldownValidation.sanitized);
    const commandCooldown = parseInt(commandCooldownValidation.sanitized);
    const voiceXpInterval = parseInt(voiceXpIntervalValidation.sanitized);

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
      components: components.map(c => c.toJSON()),
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
 * @param {import('discord.js').AnySelectMenuInteraction} interaction
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
      components: components.map(c => c.toJSON()),
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
    const { getLevelUpNotifier } =
      await import("../../../features/experience/LevelUpNotifier.js");
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

// ============================================================================
// LEVEL REWARDS SUBCOMMANDS
// ============================================================================

/**
 * Handle /xp rewards subcommand group
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} subcommand - add, remove, list, mode
 * @param {import('discord.js').Client} _client
 */
export async function handleRewardsCommand(interaction, subcommand, _client) {
  const logger = getLogger();

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { getLevelRewardsManager } =
      await import("../../../features/experience/LevelRewardsManager.js");
    const { FREE_TIER } = await import("../../../features/premium/config.js");
    const rewardsManager = await getLevelRewardsManager();
    const { EmbedBuilder } = await import("discord.js");

    switch (subcommand) {
      case "add": {
        const level = interaction.options.getInteger("level");
        const role = interaction.options.getRole("role");

        // Validate role
        if (role.managed || role.id === interaction.guild.id) {
          return interaction.editReply(
            errorEmbed({
              title: "Invalid Role",
              description:
                "You cannot use bot-managed roles or @everyone as a reward.",
              solution: "Choose a regular role.",
            }),
          );
        }

        const result = await rewardsManager.addReward(
          interaction.guild.id,
          level,
          role.id,
        );

        if (!result.success) {
          if (result.premiumRequired) {
            return interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setTitle(`${EMOJIS.lock || "🔒"} Premium Required`)
                  .setDescription(result.message)
                  .setColor(THEME.WARNING)
                  .setFooter({
                    text: "Enable Pro Engine from the dashboard to unlock unlimited rewards.",
                  }),
              ],
            });
          }
          return interaction.editReply(
            errorEmbed({
              title: "Could Not Add Reward",
              description: result.message,
            }),
          );
        }

        const embed = new EmbedBuilder()
          .setTitle("🎁 Level Reward Added")
          .setDescription(result.message)
          .addFields(
            {
              name: "Level",
              value: `\`${level}\``,
              inline: true,
            },
            {
              name: "Role",
              value: `<@&${role.id}>`,
              inline: true,
            },
            {
              name: "Slots Remaining",
              value: `${result.remaining === "unlimited" ? "♾️ Unlimited (Pro)" : `${result.remaining} / ${FREE_TIER.LEVEL_REWARDS_MAX}`}`,
              inline: true,
            },
          )
          .setColor(THEME.SUCCESS)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "remove": {
        const level = interaction.options.getInteger("level");
        const role = interaction.options.getRole("role");

        const result = await rewardsManager.removeReward(
          interaction.guild.id,
          level,
          role.id,
        );

        if (!result.success) {
          return interaction.editReply(
            errorEmbed({
              title: "Could Not Remove Reward",
              description: result.message,
            }),
          );
        }

        const embed = new EmbedBuilder()
          .setTitle("🗑️ Level Reward Removed")
          .setDescription(result.message)
          .addFields(
            {
              name: "Level",
              value: `\`${level}\``,
              inline: true,
            },
            {
              name: "Role",
              value: `<@&${role.id}>`,
              inline: true,
            },
          )
          .setColor(THEME.ERROR)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "list": {
        const rewards = await rewardsManager.getRewards(interaction.guild.id);
        const mode = await rewardsManager.getRewardMode(interaction.guild.id);
        const isPro = await rewardsManager._isProActive(interaction.guild.id);

        if (!rewards.length) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle("🎁 Level Rewards")
                .setDescription(
                  "No level rewards configured yet.\n\nUse `/xp rewards add` to get started!",
                )
                .setColor(THEME.DISABLED)
                .setFooter({
                  text: `Mode: ${mode === "stack" ? "Stack (keep all roles)" : "Replace (highest only)"} • ${isPro ? "Pro Engine Active" : `Free tier: ${FREE_TIER.LEVEL_REWARDS_MAX} rewards max`}`,
                }),
            ],
          });
        }

        const rewardLines = rewards.map((r, i) => {
          const role = interaction.guild.roles.cache.get(r.roleId);
          const roleName = role ? `<@&${r.roleId}>` : `*Deleted Role*`;

          // Check if this reward is active (within free limit)
          const isInactive = !isPro && i >= FREE_TIER.LEVEL_REWARDS_MAX;

          if (isInactive) {
            return `**${i + 1}.** Level \`${r.level}\` → ${roleName} ${EMOJIS.lock || "🔒"} *(Premium Only)*`;
          }
          return `**${i + 1}.** Level \`${r.level}\` → ${roleName}`;
        });

        const embed = new EmbedBuilder()
          .setTitle("🎁 Level Rewards")
          .setDescription(rewardLines.join("\n"))
          .addFields(
            {
              name: "Mode",
              value:
                mode === "stack"
                  ? "📚 **Stack** — Users keep all earned roles"
                  : `🔄 **Replace** — Users only keep the highest role${!isPro ? "\n⚠️ *Reverts to Stack without Pro Engine*" : ""}`,
              inline: true,
            },
            {
              name: "Slots Used",
              value: isPro
                ? `${rewards.length} / ♾️`
                : `${rewards.length} / ${FREE_TIER.LEVEL_REWARDS_MAX}${rewards.length > FREE_TIER.LEVEL_REWARDS_MAX ? " ⚠️" : ""}`,
              inline: true,
            },
          )
          .setColor(THEME.PRIMARY)
          .setTimestamp()
          .setFooter({
            text: isPro
              ? "Pro Engine — Unlimited rewards & all modes"
              : `Free tier: Only first ${FREE_TIER.LEVEL_REWARDS_MAX} rewards active`,
          });

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "mode": {
        const mode = interaction.options.getString("mode");

        const result = await rewardsManager.setRewardMode(
          interaction.guild.id,
          mode,
        );

        if (!result.success) {
          if (result.premiumRequired) {
            return interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setTitle(`${EMOJIS.lock || "🔒"} Premium Required`)
                  .setDescription(result.message)
                  .setColor(THEME.WARNING)
                  .setFooter({
                    text: "Enable Pro Engine from the dashboard to use Replace mode.",
                  }),
              ],
            });
          }
          return interaction.editReply(
            errorEmbed({
              title: "Could Not Set Mode",
              description: result.message,
            }),
          );
        }

        const modeEmoji = mode === "stack" ? "📚" : "🔄";
        const modeDesc =
          mode === "stack"
            ? "Users will **keep all** earned level reward roles."
            : "Users will **only keep the highest** earned level reward role. Lower roles are removed.";

        const embed = new EmbedBuilder()
          .setTitle(`${modeEmoji} Reward Mode Updated`)
          .setDescription(result.message)
          .addFields({
            name: "How It Works",
            value: modeDesc,
          })
          .setColor(THEME.PRIMARY)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      default:
        await interaction.editReply(
          errorEmbed({
            title: "Unknown Subcommand",
            description: "The requested rewards subcommand is not available.",
          }),
        );
    }
  } catch (error) {
    logger.error("Error in rewards command:", error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to process rewards command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
