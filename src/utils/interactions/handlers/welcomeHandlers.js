import { MessageFlags } from "discord.js";
import { getLogger } from "../../logger.js";
import { getDatabaseManager } from "../../storage/databaseManager.js";
import { errorEmbed } from "../../discord/responseMessages.js";
import { hasAdminPermissions } from "../../discord/permissions.js";
import { createWelcomeSettingsEmbed } from "../../../commands/admin/welcome/embeds.js";
import {
  createWelcomeSettingsComponents,
  createChannelSelectComponents,
  createRoleSelectComponents,
} from "../../../commands/admin/welcome/components.js";
import {
  processWelcomeMessage,
  createWelcomeEmbed,
} from "../../discord/welcomeUtils.js";
import { THEME, THEME_COLOR } from "../../../config/theme.js";

/**
 * Handle welcome configure button interaction
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleWelcomeConfigure(interaction) {
  const logger = getLogger();

  try {
    // Defer the interaction immediately to prevent timeout
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to configure the welcome system.",
          }),
        ],
      });
    }

    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Create and show the configuration page
    const { createWelcomeConfigPageEmbed } = await import(
      "../../../commands/admin/welcome/modals.js"
    );
    const { createWelcomeConfigPageComponents } = await import(
      "../../../commands/admin/welcome/components.js"
    );

    const embed = createWelcomeConfigPageEmbed(interaction, currentSettings);
    const components = createWelcomeConfigPageComponents(
      interaction.guild,
      currentSettings,
    );

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Welcome configuration page opened by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error(`Error in handleWelcomeConfigure: ${error.message}`, error);
    await interaction.reply(
      errorEmbed({
        title: "Configuration Error",
        description:
          "An error occurred while opening the welcome configuration.",
      }),
    );
  }
}

/**
 * Handle welcome message configuration button interaction
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleWelcomeConfigureMessage(interaction) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to configure the welcome system.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Create and show the message configuration modal
    const { createWelcomeConfigModal } = await import(
      "../../../commands/admin/welcome/modals.js"
    );
    const modal = createWelcomeConfigModal(currentSettings);

    await interaction.showModal(modal);

    logger.info(
      `Welcome message configuration modal opened by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error(
      `Error in handleWelcomeConfigureMessage: ${error.message}`,
      error,
    );
    await interaction.reply(
      errorEmbed({
        title: "Configuration Error",
        description:
          "An error occurred while opening the welcome message configuration.",
      }),
    );
  }
}

/**
 * Handle welcome channel selection button interaction
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleWelcomeSelectChannel(interaction) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to configure the welcome system.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    const components = createChannelSelectComponents(
      interaction.guild,
      currentSettings.channelId,
    );

    const embed = {
      title: "📝 Select Welcome Channel",
      description:
        "Choose where to send welcome messages for new members joining your server.",
      color: THEME_COLOR,
      fields: [
        {
          name: "📋 What This Does",
          value:
            "Select a channel from the dropdown below where welcome messages will be sent. Make sure the bot has permission to send messages in the selected channel.",
          inline: false,
        },
        {
          name: "💡 Pro Tips",
          value:
            "• Choose a channel that new members can see\n• Consider using a dedicated #welcome channel\n• Make sure the bot has proper permissions",
          inline: false,
        },
      ],
    };

    await interaction.editReply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral,
    });

    logger.info(
      `Welcome channel select opened by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error(
      `Error in handleWelcomeSelectChannel: ${error.message}`,
      error,
    );
    await interaction.editReply({
      embeds: [
        errorEmbed({
          title: "Configuration Error",
          description:
            "An error occurred while opening the welcome channel selection.",
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle welcome toggle button interaction
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleWelcomeToggle(interaction) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to toggle the welcome system.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    if (!currentSettings.channelId) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            title: "No Channel Configured",
            description:
              "Please configure a welcome channel first before enabling the system.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const newSettings = {
      ...currentSettings,
      enabled: !currentSettings.enabled,
      updatedAt: new Date(),
    };

    await dbManager.welcomeSettings.set(interaction.guild.id, newSettings);

    const welcomeChannel = interaction.guild.channels.cache.get(
      newSettings.channelId,
    );
    const autoRole = newSettings.autoRoleId
      ? interaction.guild.roles.cache.get(newSettings.autoRoleId)
      : null;

    const embed = createWelcomeSettingsEmbed(
      interaction,
      newSettings,
      welcomeChannel,
      autoRole,
    );
    const components = createWelcomeSettingsComponents(newSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Welcome system ${newSettings.enabled ? "enabled" : "disabled"} by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error(`Error in handleWelcomeToggle: ${error.message}`, error);
    await interaction.editReply({
      embeds: [
        errorEmbed({
          title: "Toggle Error",
          description: "An error occurred while toggling the welcome system.",
        }),
      ],
      ephemeral: true,
    });
  }
}

/**
 * Handle welcome reset button interaction
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleWelcomeReset(interaction) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to reset the welcome system.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const dbManager = await getDatabaseManager();

    // Reset to default settings
    const defaultSettings = {
      guildId: interaction.guild.id,
      enabled: false,
      channelId: null,
      message: "Welcome **{user}** to **{server}**! 🎉",
      embedEnabled: true,
      embedColor: THEME_COLOR,
      embedTitle: "👋 Welcome to {server}!",
      embedDescription: "Thanks for joining our community!",
      embedThumbnail: true,
      autoRoleId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await dbManager.welcomeSettings.set(interaction.guild.id, defaultSettings);

    const embed = createWelcomeSettingsEmbed(
      interaction,
      defaultSettings,
      null, // channel
      null, // autoRole
    );
    const components = createWelcomeSettingsComponents(defaultSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Welcome system reset by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error(`Error in handleWelcomeReset: ${error.message}`, error);
    await interaction.editReply({
      embeds: [
        errorEmbed({
          title: "Reset Error",
          description: "An error occurred while resetting the welcome system.",
        }),
      ],
      ephemeral: true,
    });
  }
}

/**
 * Handle welcome test button interaction
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleWelcomeTest(interaction) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to test the welcome system.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    if (!settings.enabled || !settings.channelId) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            title: "System Not Configured",
            description:
              "The welcome system is not enabled or no channel is configured.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Get the welcome channel
    const welcomeChannel = interaction.guild.channels.cache.get(
      settings.channelId,
    );
    if (!welcomeChannel) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Channel Not Found",
            description:
              "The configured welcome channel could not be found. Please reconfigure.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check bot permissions in the welcome channel
    const botMember = interaction.guild.members.me;
    const channelPermissions = welcomeChannel.permissionsFor(botMember);

    if (!channelPermissions.has("SendMessages")) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Permission Error",
            description: `I don't have permission to send messages in ${welcomeChannel.toString()}`,
            solution:
              "Please grant me Send Messages permission in the welcome channel.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // If using embeds, also check for EmbedLinks permission
    if (settings.embedEnabled && !channelPermissions.has("EmbedLinks")) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Permission Error",
            description: `I don't have permission to embed links in ${welcomeChannel.toString()}`,
            solution:
              "Please grant me Embed Links permission in the welcome channel.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Use the actual interaction member for testing
    const testMember = interaction.member;

    // Test auto-role assignment first
    let roleTestDetails = "";

    if (settings.autoRoleId) {
      const autoRole = interaction.guild.roles.cache.get(settings.autoRoleId);
      if (autoRole) {
        // Check if bot has permission to manage roles
        const hasManageRoles = botMember.permissions.has("ManageRoles");
        const botHighestRole = botMember.roles.highest;
        const canAssignRole = autoRole.position < botHighestRole.position;

        if (!hasManageRoles) {
          roleTestDetails = "Bot lacks ManageRoles permission";
        } else if (!canAssignRole) {
          roleTestDetails =
            "Auto-role is higher than or equal to bot's highest role";
        } else {
          // Try actual role assignment
          try {
            await testMember.roles.add(autoRole, "Welcome System - Test");
            roleTestDetails = "✅ Role assigned successfully";
          } catch (error) {
            roleTestDetails = `❌ Role assignment failed: ${error.message}`;
          }
        }
      } else {
        roleTestDetails = "Auto-role not found";
      }
    }

    // Send the actual welcome message to the configured channel
    let messageResult = null;
    let sentMessage = null;
    try {
      if (settings.embedEnabled) {
        const embed = createWelcomeEmbed(settings, testMember);
        sentMessage = await welcomeChannel.send({ embeds: [embed] });
        messageResult = "Embed message sent successfully";
      } else {
        const processedMessage = processWelcomeMessage(
          settings.message || "Welcome **{user}** to **{server}**! 🎉",
          testMember,
        );
        sentMessage = await welcomeChannel.send(processedMessage);
        messageResult = "Text message sent successfully";
      }
    } catch (error) {
      messageResult = `Failed to send message: ${error.message}`;
    }

    // Send test results back to the user
    const testResults = [];
    testResults.push(`**Message Test:** ${messageResult}`);
    if (settings.autoRoleId) {
      testResults.push(`**Auto-Role Test:** ${roleTestDetails}`);
    } else {
      testResults.push("**Auto-Role Test:** No auto-role configured");
    }

    // Create direct link to the sent message if available
    let messageLink = "";
    if (sentMessage) {
      messageLink = `\n\n🔗 [**View Test Message**](${sentMessage.url})`;
    }

    await interaction.editReply({
      embeds: [
        {
          title: "🎉 Welcome System Test Results",
          description: `Test completed in ${welcomeChannel.toString()}${messageLink}\n\n${testResults.join("\n")}`,
          color: THEME.SUCCESS,
          fields: [
            {
              name: "📋 Test Details",
              value: `**Format:** ${settings.embedEnabled ? "Embed" : "Text"}\n**Channel:** ${welcomeChannel.toString()}\n**Message:** ${settings.message || "Default message"}`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
      ephemeral: true,
    });

    logger.info(
      `Welcome system test completed by ${interaction.user.tag} in ${interaction.guild.name} - Message: ${messageResult}, Role: ${roleTestDetails}`,
    );
  } catch (error) {
    logger.error(`Error in handleWelcomeTest: ${error.message}`, error);
    await interaction.editReply({
      embeds: [
        errorEmbed({
          title: "Test Error",
          description: "An error occurred while testing the welcome system.",
        }),
      ],
      ephemeral: true,
    });
  }
}

/**
 * Handle welcome settings button interaction
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleWelcomeEdit(interaction) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to view welcome settings.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const dbManager = await getDatabaseManager();
    if (!dbManager.welcomeSettings) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Database Error",
            description: "Welcome settings repository is not available.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const settings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    const welcomeChannel = settings.channelId
      ? interaction.guild.channels.cache.get(settings.channelId)
      : null;
    const autoRole = settings.autoRoleId
      ? interaction.guild.roles.cache.get(settings.autoRoleId)
      : null;

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
      `Welcome settings viewed by ${interaction.user.tag} (${interaction.user.id}) in ${interaction.guild.name} (${interaction.guild.id})`,
    );
  } catch (error) {
    logger.error(`Error in handleWelcomeEdit: ${error.message}`, error);
    await interaction.editReply({
      embeds: [
        errorEmbed({
          title: "Settings Error",
          description: "An error occurred while retrieving welcome settings.",
        }),
      ],
      ephemeral: true,
    });
  }
}

/**
 * Handle the welcome format switch button interaction.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleWelcomeFormat(interaction) {
  const logger = getLogger();

  try {
    // Check permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to change the welcome format.",
          solution: "Contact a server administrator for assistance.",
        }),
        { ephemeral: true },
      );
    }

    await interaction.deferUpdate();

    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Toggle the embed format
    const newSettings = {
      ...currentSettings,
      embedEnabled: !currentSettings.embedEnabled,
      updatedAt: new Date(),
    };

    await dbManager.welcomeSettings.set(interaction.guild.id, newSettings);

    // Get updated settings
    const updatedSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    const welcomeChannel = updatedSettings.channelId
      ? interaction.guild.channels.cache.get(updatedSettings.channelId)
      : null;
    const autoRole = updatedSettings.autoRoleId
      ? interaction.guild.roles.cache.get(updatedSettings.autoRoleId)
      : null;

    const embed = createWelcomeSettingsEmbed(
      interaction,
      updatedSettings,
      welcomeChannel,
      autoRole,
    );

    const components = createWelcomeSettingsComponents(updatedSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Welcome format changed to ${updatedSettings.embedEnabled ? "embed" : "text"} by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error("Error in handleWelcomeFormat:", error);
    await interaction.editReply({
      embeds: [
        errorEmbed({
          title: "Format Error",
          description: "An error occurred while changing the welcome format.",
        }),
      ],
      ephemeral: true,
    });
  }
}

/**
 * Handle the welcome clear role button interaction.
 * Removes the auto-role from welcome settings.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleWelcomeClearRole(interaction) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to clear the welcome auto-role.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply({ ephemeral: true });

    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    const newSettings = {
      ...currentSettings,
      autoRoleId: null,
      updatedAt: new Date(),
    };

    await dbManager.welcomeSettings.set(interaction.guild.id, newSettings);

    // Get updated settings for display
    const updatedSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    const welcomeChannel = updatedSettings.channelId
      ? interaction.guild.channels.cache.get(updatedSettings.channelId)
      : null;

    const embed = createWelcomeSettingsEmbed(
      interaction,
      updatedSettings,
      welcomeChannel,
      null,
    );
    const components = createWelcomeSettingsComponents(updatedSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Welcome auto-role cleared by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error(`Error in handleWelcomeClearRole: ${error.message}`, error);
    await interaction.editReply({
      embeds: [
        errorEmbed({
          title: "Clear Error",
          description:
            "An error occurred while clearing the welcome auto-role.",
        }),
      ],
      ephemeral: true,
    });
  }
}

/**
 * Handle the welcome role configure button interaction.
 * Shows a role select menu for the auto-role.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleWelcomeConfigureRole(interaction) {
  const logger = getLogger();

  try {
    logger.debug(
      `Welcome configure role button clicked by ${interaction.user.tag}`,
    );

    if (!hasAdminPermissions(interaction.member)) {
      logger.warn(
        `Permission denied for ${interaction.user.tag} in welcome configure role`,
      );
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to configure the welcome auto-role.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    logger.debug(`Deferring reply for welcome configure role`);
    await interaction.deferReply({ ephemeral: true });

    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    const components = createRoleSelectComponents(
      interaction.guild,
      currentSettings.autoRoleId,
    );

    const embed = {
      title: "Configure Welcome Auto-Role",
      description:
        "Select a role from the dropdown below to automatically assign to new members, or use the 'Clear Auto-Role' button to remove the current one.",
      color: THEME_COLOR,
      fields: [
        {
          name: "Select Role",
          value:
            "Choose a role from the dropdown below. Selecting a role will automatically save it as the auto-role.",
          inline: false,
        },
      ],
    };

    await interaction.editReply({
      embeds: [embed],
      components,
      ephemeral: true,
    });

    logger.info(
      `Welcome role select opened by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error(
      `Error in handleWelcomeConfigureRole: ${error.message}`,
      error,
    );
    await interaction.editReply({
      embeds: [
        errorEmbed({
          title: "Configuration Error",
          description:
            "An error occurred while opening the role configuration.",
        }),
      ],
      ephemeral: true,
    });
  }
}
