import { Events, InteractionType } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { getCommandHandler } from "../utils/core/commandHandler.js";
import {
  handleExportData,
  handleCleanupTempRoles,
  handleTestAutoCleanup,
} from "../commands/developer/storage.js";

export const name = Events.InteractionCreate;

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Diagnostic: log interaction age
    const now = Date.now();
    const created =
      interaction.createdTimestamp || interaction.createdAt?.getTime() || now;
    const age = now - created;
    logger.debug(
      `[InteractionCreate] Received interaction: ${interaction.commandName || interaction.type} | Age: ${age}ms`,
    );

    // Validate inputs
    if (!interaction || !client) {
      throw new Error("Missing required parameters");
    }

    // Handle different interaction types
    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
        await handleCommandInteraction(interaction, client);
        break;
      case InteractionType.ApplicationCommandAutocomplete:
        await handleAutocompleteInteraction(interaction, client);
        break;
      case InteractionType.MessageComponent:
        await handleButtonInteraction(interaction, client);
        break;
      default:
        // Unknown interaction type, ignore
        break;
    }
  } catch (error) {
    logger.error("Error handling interaction", error);

    // Try to reply with error message only if not already handled
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred while processing your request.",
          flags: 64, // ephemeral flag
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: "❌ An error occurred while processing your request.",
          flags: 64,
        });
      }
    } catch (replyError) {
      logger.error("Error sending error reply", replyError);
    }
  }
}

// Handle command interactions
const handleCommandInteraction = async (interaction, client) => {
  const logger = getLogger();
  const commandHandler = getCommandHandler();

  try {
    await commandHandler.executeCommand(interaction, client);
    logger.info(
      `Command executed: ${interaction.commandName} by ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}`, error);

    // Only try to reply if we haven't already and the command didn't handle it
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error executing command.",
          flags: 64,
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: "❌ Error executing command.",
          flags: 64,
        });
      }
    } catch (replyError) {
      logger.error("Failed to send error response", replyError);
    }
  }
};

// Handle autocomplete interactions
const handleAutocompleteInteraction = async (interaction, client) => {
  const logger = getLogger();
  const command = client.commands.get(interaction.commandName);

  if (command && command.autocomplete) {
    try {
      await command.autocomplete(interaction, client);
    } catch (error) {
      logger.error(
        `Error in autocomplete for ${interaction.commandName}`,
        error,
      );
      await interaction.respond([]);
    }
  } else {
    await interaction.respond([]);
  }
};

// Handle button interactions
const handleButtonInteraction = async (interaction, _client) => {
  const logger = getLogger();

  try {
    // Handle leaderboard time filter buttons
    if (interaction.customId.startsWith("leaderboard_")) {
      await handleLeaderboardButton(interaction);
      return;
    }

    switch (interaction.customId) {
      // Storage command buttons (developer only)
      case "export_data":
        await handleExportData(interaction);
        break;
      case "cleanup_temp_roles":
        await handleCleanupTempRoles(interaction);
        break;
      case "test_auto_cleanup":
        await handleTestAutoCleanup(interaction);
        break;

      // Welcome system buttons
      case "welcome_configure":
      case "welcome_edit":
        await handleWelcomeConfigure(interaction);
        break;
      case "welcome_test":
        await handleWelcomeTest(interaction);
        break;
      case "welcome_toggle":
        await handleWelcomeToggle(interaction);
        break;
      case "welcome_reset":
        await handleWelcomeReset(interaction);
        break;

      // XP system buttons
      case "xp_toggle_system":
        await handleXPToggleSystem(interaction);
        break;
      case "xp_toggle_message":
        await handleXPToggleMessage(interaction);
        break;
      case "xp_toggle_command":
        await handleXPToggleCommand(interaction);
        break;
      case "xp_toggle_role":
        await handleXPToggleRole(interaction);
        break;

      // Sponsor command buttons
      case "sponsor_perks":
        await handleSponsorPerks(interaction);
        break;

      default:
        logger.debug(`Unknown button interaction: ${interaction.customId}`);
        break;
    }
  } catch (error) {
    logger.error(
      `Error handling button interaction ${interaction.customId}`,
      error,
    );

    // Only reply if the interaction hasn't been responded to yet
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ An error occurred while processing your request.",
          flags: 64,
        });
      } catch (replyError) {
        logger.error("Error sending error reply", replyError);
      }
    }
  }
};

// Handle leaderboard button interactions
const handleLeaderboardButton = async interaction => {
  const logger = getLogger();

  try {
    // Parse the button customId: leaderboard_timeframe_userId
    const parts = interaction.customId.split("_");
    if (parts.length !== 3) {
      logger.error(
        `Invalid leaderboard button format: ${interaction.customId}`,
      );
      return;
    }

    const timeframe = parts[1];
    const userId = parts[2];

    // Check if the button was clicked by the same user
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ You can only use your own leaderboard buttons.",
        flags: 64,
      });
      return;
    }

    // Import the leaderboard command and execute it with the new timeframe
    const { execute } = await import("../commands/general/leaderboard.js");

    // Temporarily set the timeframe option
    interaction.options = {
      getString: () => timeframe,
    };

    await execute(interaction, null);
  } catch (error) {
    logger.error("Error handling leaderboard button", error);

    // Only reply if the interaction hasn't been responded to yet
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ An error occurred while updating the leaderboard.",
          flags: 64,
        });
      } catch (replyError) {
        logger.error("Error sending error reply", replyError);
      }
    }
  }
};

// Handle welcome system button interactions
const handleWelcomeConfigure = async interaction => {
  const logger = getLogger();

  try {
    // Import modules immediately to reduce response time
    const { EmbedBuilder } = await import("discord.js");
    const { THEME_COLOR, EMOJIS } = await import("../config/theme.js");

    await interaction.deferReply({ flags: 64 });

    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`${EMOJIS.STATUS.INFO} Welcome System Configuration`)
      .setDescription(
        "Use the `/setup-welcome` command to configure your welcome system.",
      )
      .addFields([
        {
          name: `${EMOJIS.UI.CHANNELS} Required`,
          value:
            "• Channel: Select a channel for welcome messages\n• Enabled: Toggle the welcome system on/off",
          inline: false,
        },
        {
          name: `${EMOJIS.UI.IMAGE} Optional`,
          value:
            "• Message: Custom welcome message with placeholders\n• Auto-Role: Automatically assign a role to new members\n• Embed: Toggle embed format on/off",
          inline: false,
        },
        {
          name: `${EMOJIS.UI.QUESTION} Placeholders`,
          value:
            "• `{user}` - User mention\n• `{user.name}` - Username\n• `{user.tag}` - User tag\n• `{server}` - Server name\n• `{memberCount}` - Member count",
          inline: false,
        },
      ])
      .setFooter({
        text: "Use /setup-welcome to configure • /welcome-settings to view current settings",
        iconURL: interaction.guild.iconURL(),
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    logger.error("Error handling welcome configure button", error);

    // Only respond if the interaction hasn't been responded to yet
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ An error occurred while opening the configuration.",
          flags: 64,
        });
      } catch (replyError) {
        logger.error("Error sending error reply", replyError);
      }
    } else if (interaction.deferred) {
      try {
        await interaction.editReply({
          content: "❌ An error occurred while opening the configuration.",
        });
      } catch (editError) {
        logger.error("Error sending error edit reply", editError);
      }
    }
  }
};

const handleWelcomeTest = async interaction => {
  const logger = getLogger();

  try {
    // Import modules immediately to reduce response time
    const { getDatabaseManager } = await import(
      "../utils/storage/databaseManager.js"
    );
    const { EmbedBuilder } = await import("discord.js");
    const { THEME_COLOR, EMOJIS } = await import("../config/theme.js");

    await interaction.deferReply({ flags: 64 });

    const dbManager = await getDatabaseManager();

    if (!dbManager.welcomeSettings) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle(`${EMOJIS.STATUS.ERROR} Database Connection Issue`)
        .setDescription(
          "The welcome system database is not available at the moment.",
        )
        .addFields([
          {
            name: `${EMOJIS.UI.WARNING} What Happened`,
            value:
              "The bot's database connection may have been interrupted or is still initializing.",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.INFO} How to Fix`,
            value:
              "• Wait a moment and try again\n• If the issue persists, contact an administrator\n• The bot may need to be restarted",
            inline: false,
          },
        ])
        .setFooter({
          text: "This is usually a temporary issue",
          iconURL: interaction.guild.iconURL(),
        })
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
      });
    }

    const settings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    if (!settings.enabled) {
      const { EmbedBuilder } = await import("discord.js");
      const { THEME_COLOR, EMOJIS } = await import("../config/theme.js");

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle(`${EMOJIS.STATUS.WARNING} Welcome System Not Configured`)
        .setDescription(
          "Your welcome system needs to be set up before you can test it.",
        )
        .addFields([
          {
            name: `${EMOJIS.UI.CHANNELS} Quick Setup`,
            value:
              "Use `/setup-welcome` to configure your welcome system with a channel and enable it.",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.QUESTION} What You Can Configure`,
            value:
              "• **Channel**: Where welcome messages are sent\n• **Message**: Custom welcome message with placeholders\n• **Auto-Role**: Automatically assign roles to new members\n• **Embed Format**: Rich embed or simple text",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.INFO} Example Setup`,
            value:
              "`/setup-welcome channel:#welcome enabled:true message:Welcome {user} to {server}! 🎉`",
            inline: false,
          },
        ])
        .setFooter({
          text: "Need help? Use /welcome-settings to view current configuration",
          iconURL: interaction.guild.iconURL(),
        })
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
      });
    }

    if (!settings.channelId) {
      const { EmbedBuilder } = await import("discord.js");
      const { THEME_COLOR, EMOJIS } = await import("../config/theme.js");

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle(`${EMOJIS.STATUS.WARNING} No Welcome Channel Set`)
        .setDescription("You need to configure a channel for welcome messages.")
        .addFields([
          {
            name: `${EMOJIS.UI.CHANNELS} How to Fix`,
            value:
              "Use `/setup-welcome` and select a channel where welcome messages should be sent.",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.INFO} Example`,
            value: "`/setup-welcome channel:#welcome enabled:true`",
            inline: false,
          },
        ])
        .setFooter({
          text: "The channel should be visible to new members",
          iconURL: interaction.guild.iconURL(),
        })
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
      });
    }

    const welcomeChannel = interaction.guild.channels.cache.get(
      settings.channelId,
    );
    if (!welcomeChannel) {
      const { EmbedBuilder } = await import("discord.js");
      const { THEME_COLOR, EMOJIS } = await import("../config/theme.js");

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle(`${EMOJIS.STATUS.ERROR} Welcome Channel Missing`)
        .setDescription("The configured welcome channel no longer exists.")
        .addFields([
          {
            name: `${EMOJIS.UI.WARNING} What Happened`,
            value:
              "The channel that was set for welcome messages has been deleted or you no longer have access to it.",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.CHANNELS} How to Fix`,
            value:
              "Use `/setup-welcome` to select a new channel for welcome messages.",
            inline: false,
          },
        ])
        .setFooter({
          text: "Make sure the new channel is visible to new members",
          iconURL: interaction.guild.iconURL(),
        })
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Use the actual interaction member for testing (has real roles functionality)
    const member = interaction.member;

    // Test the welcome system using the reusable function
    const { testWelcomeSystem } = await import(
      "../utils/discord/welcomeUtils.js"
    );
    const testResult = await testWelcomeSystem(
      settings,
      member,
      welcomeChannel,
      logger,
    );

    if (!testResult.success) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle(`${EMOJIS.STATUS.ERROR} Test Failed`)
        .setDescription(testResult.error)
        .addFields([
          {
            name: `${EMOJIS.UI.INFO} How to Fix`,
            value: testResult.solution,
            inline: false,
          },
        ])
        .setFooter({
          text: "Welcome System Test",
          iconURL: interaction.guild.iconURL(),
        })
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Create success embed with role test results
    const successEmbed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`${EMOJIS.STATUS.SUCCESS} Welcome Test Successful`)
      .setDescription(
        `Test welcome message sent to ${welcomeChannel.toString()}`,
      )
      .addFields([
        {
          name: `${EMOJIS.UI.CHANNELS} Channel`,
          value: welcomeChannel.toString(),
          inline: true,
        },
        {
          name: `${EMOJIS.UI.IMAGE} Format`,
          value: testResult.format,
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.ROLES} Auto-Role Test`,
          value: settings.autoRoleId
            ? testResult.roleTestResult
              ? "✅ Role assignment would work"
              : `❌ Role assignment failed: ${testResult.roleTestDetails}`
            : "No auto-role configured",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.QUESTION} Message`,
          value: settings.message || "Default welcome message",
          inline: false,
        },
      ])
      .setFooter({
        text: "Your welcome system is working correctly!",
        iconURL: interaction.guild.iconURL(),
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [successEmbed],
    });
  } catch (error) {
    logger.error("Error handling welcome test button", error);

    // Only respond if the interaction hasn't been responded to yet
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ An error occurred while testing the welcome system.",
          flags: 64,
        });
      } catch (replyError) {
        logger.error("Error sending error reply", replyError);
      }
    } else if (interaction.deferred) {
      try {
        await interaction.editReply({
          content: "❌ An error occurred while testing the welcome system.",
        });
      } catch (editError) {
        logger.error("Error sending error edit reply", editError);
      }
    }
  }
};

const handleWelcomeToggle = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    // Import required modules first
    const { EmbedBuilder } = await import("discord.js");
    const { THEME_COLOR, EMOJIS } = await import("../config/theme.js");

    // Get current settings and toggle enabled status
    const { getDatabaseManager } = await import(
      "../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();
    const settings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Check if trying to enable without a channel
    if (!settings.enabled && !settings.channelId) {
      // Trying to enable but no channel is set
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle(`${EMOJIS.STATUS.ERROR} Cannot Enable Welcome System`)
        .setDescription(
          "You need to set a welcome channel before enabling the system.",
        )
        .addFields([
          {
            name: `${EMOJIS.UI.CHANNELS} How to Fix`,
            value:
              "Use `/setup-welcome channel:#your-channel enabled:true` to set a channel and enable the system.",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.INFO} Why This Happens`,
            value:
              "The welcome system needs a channel to send messages to. Without a channel, it cannot function.",
            inline: false,
          },
        ])
        .setFooter({
          text: `Welcome System • ${interaction.guild.name}`,
          iconURL: interaction.guild.iconURL(),
        })
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Toggle the enabled status
    const newSettings = {
      ...settings,
      enabled: !settings.enabled,
    };

    await dbManager.welcomeSettings.set(interaction.guild.id, newSettings);

    // Import additional required modules
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import(
      "discord.js"
    );

    // Get updated channel and role info
    const welcomeChannel = newSettings.channelId
      ? interaction.guild.channels.cache.get(newSettings.channelId)
      : null;
    const autoRole = newSettings.autoRoleId
      ? interaction.guild.roles.cache.get(newSettings.autoRoleId)
      : null;

    // Create updated settings embed
    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`${EMOJIS.FEATURES.ROLES} Welcome System Settings`)
      .setDescription("Current configuration for the welcome system")
      .addFields([
        {
          name: `${EMOJIS.STATUS.SUCCESS} Status`,
          value: newSettings.enabled ? "🟢 Enabled" : "🔴 Disabled",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.CHANNELS} Welcome Channel`,
          value: welcomeChannel ? welcomeChannel.toString() : "Not set",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.IMAGE} Message Format`,
          value: newSettings.embedEnabled ? "📋 Embed" : "💬 Text",
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

    // Create updated action buttons with proper logic
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
    if (newSettings.enabled && newSettings.channelId) {
      buttonComponents.push(
        new ButtonBuilder()
          .setCustomId("welcome_test")
          .setLabel("Test Welcome")
          .setEmoji(EMOJIS.ACTIONS.QUICK)
          .setStyle(ButtonStyle.Secondary),
      );
    }

    // Show toggle button (disabled if no channel and system is disabled)
    const canToggle = newSettings.channelId || newSettings.enabled;
    buttonComponents.push(
      new ButtonBuilder()
        .setCustomId("welcome_toggle")
        .setLabel(newSettings.enabled ? "Disable" : "Enable")
        .setEmoji(
          newSettings.enabled ? EMOJIS.STATUS.ERROR : EMOJIS.STATUS.SUCCESS,
        )
        .setStyle(
          newSettings.enabled ? ButtonStyle.Danger : ButtonStyle.Success,
        )
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
  } catch (error) {
    logger.error("Error handling welcome toggle button", error);

    // Only respond if the interaction hasn't been responded to yet
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ An error occurred while toggling the welcome system.",
          flags: 64,
        });
      } catch (replyError) {
        logger.error("Error sending error reply", replyError);
      }
    } else if (interaction.deferred) {
      try {
        await interaction.editReply({
          content: "❌ An error occurred while toggling the welcome system.",
        });
      } catch (editError) {
        logger.error("Error sending error edit reply", editError);
      }
    }
  }
};

const handleWelcomeReset = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    // Reset welcome settings to defaults
    const { getDatabaseManager } = await import(
      "../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    await dbManager.welcomeSettings.delete(interaction.guild.id);

    // Import required modules
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } =
      await import("discord.js");
    const { THEME_COLOR, EMOJIS } = await import("../config/theme.js");

    // Get default settings after reset
    const defaultSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Create updated settings embed with default values
    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`${EMOJIS.FEATURES.ROLES} Welcome System Settings`)
      .setDescription("Current configuration for the welcome system")
      .addFields([
        {
          name: `${EMOJIS.STATUS.SUCCESS} Status`,
          value: defaultSettings.enabled ? "🟢 Enabled" : "🔴 Disabled",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.CHANNELS} Welcome Channel`,
          value: "Not set",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.IMAGE} Message Format`,
          value: defaultSettings.embedEnabled ? "📋 Embed" : "💬 Text",
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.ROLES} Auto-Role`,
          value: "None",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.QUESTION} Welcome Message`,
          value: defaultSettings.message || "Default message",
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

    // Create updated action buttons with proper logic
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
    if (defaultSettings.enabled && defaultSettings.channelId) {
      buttonComponents.push(
        new ButtonBuilder()
          .setCustomId("welcome_test")
          .setLabel("Test Welcome")
          .setEmoji(EMOJIS.ACTIONS.QUICK)
          .setStyle(ButtonStyle.Secondary),
      );
    }

    // Show toggle button (disabled if no channel and system is disabled)
    const canToggle = defaultSettings.channelId || defaultSettings.enabled;
    buttonComponents.push(
      new ButtonBuilder()
        .setCustomId("welcome_toggle")
        .setLabel(defaultSettings.enabled ? "Disable" : "Enable")
        .setEmoji(
          defaultSettings.enabled ? EMOJIS.STATUS.ERROR : EMOJIS.STATUS.SUCCESS,
        )
        .setStyle(
          defaultSettings.enabled ? ButtonStyle.Danger : ButtonStyle.Success,
        )
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
  } catch (error) {
    logger.error("Error handling welcome reset button", error);

    // Only respond if the interaction hasn't been responded to yet
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ An error occurred while resetting the welcome system.",
          flags: 64,
        });
      } catch (replyError) {
        logger.error("Error sending error reply", replyError);
      }
    } else if (interaction.deferred) {
      try {
        await interaction.editReply({
          content: "❌ An error occurred while resetting the welcome system.",
        });
      } catch (editError) {
        logger.error("Error sending error edit reply", editError);
      }
    }
  }
};

// XP System Button Handlers
const handleXPToggleSystem = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    // Import required modules
    const { EmbedBuilder } = await import("discord.js");
    const { THEME_COLOR, EMOJIS } = await import("../config/theme.js");
    const { getDatabaseManager } = await import(
      "../utils/storage/databaseManager.js"
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

    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(
        `${EMOJIS.STATUS.SUCCESS} XP System ${newSettings.experienceSystem.enabled ? "Enabled" : "Disabled"}`,
      )
      .setDescription(
        newSettings.experienceSystem.enabled
          ? "🎉 The XP system is now active! Users can earn XP for messages, commands, and role assignments."
          : "🔴 The XP system is now disabled. Users will no longer earn XP.",
      )
      .addFields([
        {
          name: `${EMOJIS.UI.MESSAGE} Message XP`,
          value: newSettings.experienceSystem.messageXP
            ? "✅ Enabled"
            : "❌ Disabled",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.COMMAND} Command XP`,
          value: newSettings.experienceSystem.commandXP
            ? "✅ Enabled"
            : "❌ Disabled",
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.ROLES} Role XP`,
          value: newSettings.experienceSystem.roleXP
            ? "✅ Enabled"
            : "❌ Disabled",
          inline: true,
        },
      ])
      .setFooter({
        text: `${EMOJIS.FEATURES.ROLES} XP System • ${interaction.guild.name}`,
        iconURL: interaction.guild.iconURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      `XP system ${newSettings.experienceSystem.enabled ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling XP system toggle", error);
    await interaction.editReply({
      content: "❌ An error occurred while toggling the XP system.",
    });
  }
};

const handleXPToggleMessage = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    const { EmbedBuilder } = await import("discord.js");
    const { THEME_COLOR, EMOJIS } = await import("../config/theme.js");
    const { getDatabaseManager } = await import(
      "../utils/storage/databaseManager.js"
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

    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(
        `${EMOJIS.UI.MESSAGE} Message XP ${newSettings.experienceSystem.messageXP ? "Enabled" : "Disabled"}`,
      )
      .setDescription(
        newSettings.experienceSystem.messageXP
          ? "✅ Users will now earn XP for sending messages."
          : "❌ Users will no longer earn XP for sending messages.",
      )
      .setFooter({
        text: `${EMOJIS.FEATURES.ROLES} XP System • ${interaction.guild.name}`,
        iconURL: interaction.guild.iconURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      `Message XP ${newSettings.experienceSystem.messageXP ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling message XP toggle", error);
    await interaction.editReply({
      content: "❌ An error occurred while toggling message XP.",
    });
  }
};

const handleXPToggleCommand = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    const { EmbedBuilder } = await import("discord.js");
    const { THEME_COLOR, EMOJIS } = await import("../config/theme.js");
    const { getDatabaseManager } = await import(
      "../utils/storage/databaseManager.js"
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

    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(
        `${EMOJIS.UI.COMMAND} Command XP ${newSettings.experienceSystem.commandXP ? "Enabled" : "Disabled"}`,
      )
      .setDescription(
        newSettings.experienceSystem.commandXP
          ? "✅ Users will now earn XP for using commands."
          : "❌ Users will no longer earn XP for using commands.",
      )
      .setFooter({
        text: `${EMOJIS.FEATURES.ROLES} XP System • ${interaction.guild.name}`,
        iconURL: interaction.guild.iconURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      `Command XP ${newSettings.experienceSystem.commandXP ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling command XP toggle", error);
    await interaction.editReply({
      content: "❌ An error occurred while toggling command XP.",
    });
  }
};

const handleXPToggleRole = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    const { EmbedBuilder } = await import("discord.js");
    const { THEME_COLOR, EMOJIS } = await import("../config/theme.js");
    const { getDatabaseManager } = await import(
      "../utils/storage/databaseManager.js"
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

    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(
        `${EMOJIS.FEATURES.ROLES} Role XP ${newSettings.experienceSystem.roleXP ? "Enabled" : "Disabled"}`,
      )
      .setDescription(
        newSettings.experienceSystem.roleXP
          ? "✅ Users will now earn XP for role assignments."
          : "❌ Users will no longer earn XP for role assignments.",
      )
      .setFooter({
        text: `${EMOJIS.FEATURES.ROLES} XP System • ${interaction.guild.name}`,
        iconURL: interaction.guild.iconURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      `Role XP ${newSettings.experienceSystem.roleXP ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling role XP toggle", error);
    await interaction.editReply({
      content: "❌ An error occurred while toggling role XP.",
    });
  }
};

// Handle sponsor command button interactions
const handleSponsorPerks = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    const { EmbedBuilder } = await import("discord.js");
    const { THEME } = await import("../config/theme.js");
    const { EMOJIS } = await import("../config/theme.js");

    const perksEmbed = new EmbedBuilder()
      .setColor(THEME.INFO)
      .setTitle(`${EMOJIS.FEATURES.PREMIUM} Supporter Benefits`)
      .setDescription(
        "Here's what you get when you support the bot development:",
      )
      .addFields(
        {
          name: "🎯 Supporter Benefits",
          value: [
            "• 🎯 **Priority Support** - Get help faster when you need it",
            "• 🆕 **Early Access** - Try new features before everyone else",
            "• 🏷️ **Supporter Badge** - Show your support in the community",
            "• 💬 **Direct Feedback** - Help shape the bot's future",
            "• 🎁 **Exclusive Features** - Access to special commands and tools",
          ].join("\n"),
          inline: false,
        },
        {
          name: "💝 How to Support",
          value: [
            "• 💳 **Any Amount** - Give what you can afford",
            "• 🔄 **One-Time or Regular** - Donate once or set up recurring",
            "• 🌟 **No Pressure** - Support only if you want to",
            "• 🎯 **Every Bit Helps** - Even small donations make a difference",
          ].join("\n"),
          inline: false,
        },
      )
      .setFooter({
        text: "Support the bot development at your own pace! ❤️",
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.editReply({ embeds: [perksEmbed] });

    logger.info(
      `Sponsor perks viewed by ${interaction.user.tag} in ${interaction.guild?.name || "DM"}`,
    );
  } catch (error) {
    logger.error("Error handling sponsor perks", error);
    await interaction.editReply({
      content: "❌ An error occurred while loading sponsor perks.",
    });
  }
};
