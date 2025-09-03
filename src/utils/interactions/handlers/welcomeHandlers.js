import { getLogger } from "../../logger.js";
import { THEME, THEME_COLOR, EMOJIS } from "../../../config/theme.js";

/**
 * Welcome system button interaction handlers
 * Handles all welcome-related button interactions
 */

/**
 * Handle welcome configuration button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleWelcomeConfigure = async interaction => {
  const logger = getLogger();

  try {
    // Import modules immediately to reduce response time
    const { EmbedBuilder } = await import("discord.js");

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
    await handleWelcomeError(interaction, "opening the configuration");
  }
};

/**
 * Handle welcome test button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleWelcomeTest = async interaction => {
  const logger = getLogger();

  try {
    // Import modules immediately to reduce response time
    const { getDatabaseManager } = await import(
      "../../storage/databaseManager.js"
    );
    const { EmbedBuilder } = await import("discord.js");

    await interaction.deferReply({ flags: 64 });

    const dbManager = await getDatabaseManager();

    if (!dbManager.welcomeSettings) {
      const embed = new EmbedBuilder()
        .setColor(THEME.ERROR)
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

      const embed = new EmbedBuilder()
        .setColor(THEME.WARNING)
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

      const embed = new EmbedBuilder()
        .setColor(THEME.WARNING)
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

      const embed = new EmbedBuilder()
        .setColor(THEME.WARNING)
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
    const { testWelcomeSystem } = await import("../../discord/welcomeUtils.js");
    const testResult = await testWelcomeSystem(
      settings,
      member,
      welcomeChannel,
      logger,
    );

    if (!testResult.success) {
      const embed = new EmbedBuilder()
        .setColor(THEME.ERROR)
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
      .setColor(THEME.SUCCESS)
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
    await handleWelcomeError(interaction, "testing the welcome system");
  }
};

/**
 * Handle welcome toggle button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleWelcomeToggle = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    // Import required modules first
    const { EmbedBuilder } = await import("discord.js");
    const { THEME, EMOJIS } = await import("../../../config/theme.js");

    // Get current settings and toggle enabled status
    const { getDatabaseManager } = await import(
      "../../storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();
    const settings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Check if trying to enable without a channel
    if (!settings.enabled && !settings.channelId) {
      // Trying to enable but no channel is set
      const embed = new EmbedBuilder()
        .setColor(THEME.ERROR)
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
      .setColor(THEME.SUCCESS)
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
    await handleWelcomeError(interaction, "toggling the welcome system");
  }
};

/**
 * Handle welcome reset button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleWelcomeReset = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    // Reset welcome settings to defaults
    const { getDatabaseManager } = await import(
      "../../storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    await dbManager.welcomeSettings.delete(interaction.guild.id);

    // Import required modules
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } =
      await import("discord.js");

    // Get default settings after reset
    const defaultSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Create updated settings embed with default values
    const embed = new EmbedBuilder()
      .setColor(THEME.SUCCESS)
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
    await handleWelcomeError(interaction, "resetting the welcome system");
  }
};

/**
 * Handle welcome system errors
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 * @param {string} action - The action that failed
 */
const handleWelcomeError = async (interaction, action) => {
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
