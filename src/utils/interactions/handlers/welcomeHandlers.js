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

/**
 * Handle welcome configure button interaction
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleWelcomeConfigure(interaction) {
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
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    const components = createChannelSelectComponents(
      interaction.guild,
      currentSettings.channelId,
    );

    const embed = {
      title: "Configure Welcome System",
      description:
        "Select a channel for welcome messages, then configure the settings.",
      color: 0x5865f2,
      fields: [
        {
          name: "Step 1: Select Channel",
          value:
            "Choose a channel from the dropdown below where welcome messages will be sent.",
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

    await interaction.editReply({
      embeds: [embed],
      components,
      ephemeral: true,
    });

    logger.info(
      `Welcome channel select opened by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error(`Error in handleWelcomeConfigure: ${error.message}`, error);
    await interaction.editReply({
      embeds: [
        errorEmbed({
          title: "Configuration Error",
          description:
            "An error occurred while opening the welcome configuration.",
        }),
      ],
      ephemeral: true,
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
        ephemeral: true,
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
        ephemeral: true,
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
        ephemeral: true,
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
      embedColor: 0x7f7bf5,
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
        ephemeral: true,
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
        ephemeral: true,
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
        ephemeral: true,
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
        ephemeral: true,
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
        ephemeral: true,
      });
    }

    // Create a mock member for testing (using the interaction user)
    const mockMember = {
      user: interaction.user,
      guild: interaction.guild,
      client: interaction.client,
      toString: () => `<@${interaction.user.id}>`,
      displayName: interaction.user.username,
      roles: {
        add: async (role, reason) => {
          // Actually assign the role for real testing
          if (settings.autoRoleId) {
            const autoRole = interaction.guild.roles.cache.get(
              settings.autoRoleId,
            );
            if (autoRole) {
              try {
                await interaction.user.roles.add(autoRole, reason);
                logger.info(
                  `Test: Auto-role ${autoRole.name} assigned to ${interaction.user.tag}`,
                );
                return true;
              } catch (error) {
                logger.error(
                  `Test: Failed to assign auto-role: ${error.message}`,
                );
                return false;
              }
            }
          }
          return false;
        },
      },
    };

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
            await mockMember.roles.add(autoRole, "Welcome System - Test");
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
        const embed = createWelcomeEmbed(settings, mockMember);
        sentMessage = await welcomeChannel.send({ embeds: [embed] });
        messageResult = "Embed message sent successfully";
      } else {
        const processedMessage = processWelcomeMessage(
          settings.message || "Welcome **{user}** to **{server}**! 🎉",
          mockMember,
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
          color: 0x00ff00,
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
        ephemeral: true,
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
        ephemeral: true,
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
        ephemeral: true,
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
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to configure the welcome auto-role.",
          }),
        ],
        ephemeral: true,
      });
    }
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
      color: 0x5865f2,
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
