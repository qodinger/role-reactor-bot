import { getLogger } from "../../logger.js";

/**
 * Message component interaction router
 * Routes button and select menu interactions to appropriate handlers based on customId patterns
 */

/**
 * Route message component interaction to appropriate handler
 * @param {import('discord.js').MessageComponentInteraction} interaction - The message component interaction
 * @param {import('discord.js').Client} _client - The Discord client (unused but kept for consistency)
 */
export async function routeButtonInteraction(interaction, _client) {
  const logger = getLogger();
  const { customId } = interaction;

  try {
    logger.debug(
      `Routing interaction: ${customId}, type: ${interaction.type}, isStringSelectMenu: ${interaction.isStringSelectMenu()}`,
    );

    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
      // Add more select menu routing patterns here as needed
      logger.debug(`Unknown select menu interaction: ${customId}`);
      return;
    }

    // Handle button interactions
    // Route based on customId patterns
    if (customId.startsWith("leaderboard_")) {
      const { handleLeaderboardButton } = await import(
        "../handlers/leaderboardHandlers.js"
      );
      await handleLeaderboardButton(interaction);
      return;
    }

    // Role-reactions pagination buttons
    if (customId.startsWith("rolelist_")) {
      const { handlePagination } = await import(
        "../../../commands/admin/role-reactions/handlers.js"
      );
      await handlePagination(interaction, _client);
      return;
    }

    if (
      customId.startsWith("cancel_schedule_") ||
      customId.startsWith("view_schedule_") ||
      customId.startsWith("modify_schedule_")
    ) {
      const { handleCancelSchedule, handleViewSchedule, handleModifySchedule } =
        await import("../handlers/scheduleHandlers.js");

      if (customId.startsWith("cancel_schedule_")) {
        await handleCancelSchedule(interaction);
      } else if (customId.startsWith("view_schedule_")) {
        await handleViewSchedule(interaction);
      } else if (customId.startsWith("modify_schedule_")) {
        await handleModifySchedule(interaction);
      }
      return;
    }

    // Route specific button types
    switch (customId) {
      // Welcome system buttons
      case "welcome_configure":
      case "welcome_edit": {
        const { handleWelcomeConfigure } = await import(
          "../handlers/welcomeHandlers.js"
        );
        await handleWelcomeConfigure(interaction);
        break;
      }
      case "welcome_configure_message": {
        const { handleWelcomeConfigureMessage } = await import(
          "../handlers/welcomeHandlers.js"
        );
        await handleWelcomeConfigureMessage(interaction);
        break;
      }
      case "welcome_select_channel": {
        const { handleWelcomeSelectChannel } = await import(
          "../handlers/welcomeHandlers.js"
        );
        await handleWelcomeSelectChannel(interaction);
        break;
      }
      case "welcome_test": {
        const { handleWelcomeTest } = await import(
          "../handlers/welcomeHandlers.js"
        );
        await handleWelcomeTest(interaction);
        break;
      }
      case "welcome_toggle": {
        const { handleWelcomeToggle } = await import(
          "../handlers/welcomeHandlers.js"
        );
        await handleWelcomeToggle(interaction);
        break;
      }
      case "welcome_reset": {
        const { handleWelcomeReset } = await import(
          "../handlers/welcomeHandlers.js"
        );
        await handleWelcomeReset(interaction);
        break;
      }
      case "welcome_format": {
        const { handleWelcomeFormat } = await import(
          "../handlers/welcomeHandlers.js"
        );
        await handleWelcomeFormat(interaction);
        break;
      }
      case "welcome_configure_role": {
        const { handleWelcomeConfigureRole } = await import(
          "../handlers/welcomeHandlers.js"
        );
        await handleWelcomeConfigureRole(interaction);
        break;
      }
      case "welcome_clear_role": {
        const { handleWelcomeClearRole } = await import(
          "../handlers/welcomeHandlers.js"
        );
        await handleWelcomeClearRole(interaction);
        break;
      }

      // XP system buttons
      case "xp_toggle_system": {
        const { handleXPToggleSystem } = await import(
          "../handlers/xpHandlers.js"
        );
        await handleXPToggleSystem(interaction);
        break;
      }
      case "xp_toggle_all": {
        const { handleXPToggleAll } = await import("../handlers/xpHandlers.js");
        await handleXPToggleAll(interaction);
        break;
      }
      case "xp_toggle_message": {
        const { handleXPToggleMessage } = await import(
          "../handlers/xpHandlers.js"
        );
        await handleXPToggleMessage(interaction);
        break;
      }
      case "xp_toggle_command": {
        const { handleXPToggleCommand } = await import(
          "../handlers/xpHandlers.js"
        );
        await handleXPToggleCommand(interaction);
        break;
      }
      case "xp_toggle_role": {
        const { handleXPToggleRole } = await import(
          "../handlers/xpHandlers.js"
        );
        await handleXPToggleRole(interaction);
        break;
      }
      case "xp_toggle_voice": {
        const { handleXPToggleVoice } = await import(
          "../handlers/xpHandlers.js"
        );
        await handleXPToggleVoice(interaction);
        break;
      }

      // XP configuration buttons
      case "xp_configure": {
        const { handleXpGeneralConfig } = await import(
          "../../../commands/admin/xp/handlers.js"
        );
        await handleXpGeneralConfig(interaction);
        break;
      }
      case "xp_configure_basic": {
        const { handleXpBasicConfig } = await import(
          "../../../commands/admin/xp/handlers.js"
        );
        await handleXpBasicConfig(interaction);
        break;
      }
      case "xp_configure_advanced": {
        const { handleXpAdvancedConfig } = await import(
          "../../../commands/admin/xp/handlers.js"
        );
        await handleXpAdvancedConfig(interaction);
        break;
      }
      case "xp_configure_sources": {
        const { handleXpSourceConfig } = await import(
          "../../../commands/admin/xp/handlers.js"
        );
        await handleXpSourceConfig(interaction);
        break;
      }
      case "xp_configure_levelup": {
        const { handleLevelUpConfig } = await import(
          "../../../commands/admin/xp/handlers.js"
        );
        await handleLevelUpConfig(interaction);
        break;
      }
      case "xp_toggle": {
        const { handleXPToggleSystem } = await import(
          "../handlers/xpHandlers.js"
        );
        await handleXPToggleSystem(interaction);
        break;
      }
      case "xp_test": {
        const { handleXpTest } = await import(
          "../../../commands/admin/xp/handlers.js"
        );
        await handleXpTest(interaction);
        break;
      }
      case "xp_toggle_levelup": {
        const { handleXPToggleLevelUp } = await import(
          "../handlers/xpHandlers.js"
        );
        await handleXPToggleLevelUp(interaction);
        break;
      }
      case "xp_configure_channel": {
        const { handleXpChannelConfig } = await import(
          "../../../commands/admin/xp/handlers.js"
        );
        await handleXpChannelConfig(interaction);
        break;
      }
      case "xp_test_levelup": {
        const { handleXpTestLevelUp } = await import(
          "../../../commands/admin/xp/handlers.js"
        );
        await handleXpTestLevelUp(interaction);
        break;
      }
      case "welcome_back_to_settings": {
        const { handleSettings } = await import(
          "../../../commands/admin/welcome/handlers.js"
        );
        await handleSettings(interaction, interaction.client);
        break;
      }
      case "back_to_settings": {
        const { handleSettings } = await import(
          "../../../commands/admin/xp/handlers.js"
        );
        await handleSettings(interaction, interaction.client);
        break;
      }

      // XP configuration buttons
      case "xp_config_message": {
        const { handleXPConfigMessage } = await import(
          "../handlers/xpHandlers.js"
        );
        await handleXPConfigMessage(interaction);
        break;
      }
      case "xp_config_command": {
        const { handleXPConfigCommand } = await import(
          "../handlers/xpHandlers.js"
        );
        await handleXPConfigCommand(interaction);
        break;
      }
      case "xp_config_role": {
        const { handleXPConfigRole } = await import(
          "../handlers/xpHandlers.js"
        );
        await handleXPConfigRole(interaction);
        break;
      }

      // Help command buttons and interactions
      case "help_back_main":
      case "help_view_overview":
      case "help_view_all": {
        const { handleHelpInteraction } = await import(
          "../handlers/helpHandlers.js"
        );
        await handleHelpInteraction(interaction);
        break;
      }

      // Sponsor command buttons
      case "sponsor_perks": {
        const { handleSponsorPerks } = await import(
          "../handlers/sponsorHandlers.js"
        );
        await handleSponsorPerks(interaction);
        break;
      }

      // Goodbye system buttons
      case "goodbye_configure":
      case "goodbye_edit": {
        const { handleGoodbyeConfigure } = await import(
          "../handlers/goodbyeHandlers.js"
        );
        await handleGoodbyeConfigure(interaction);
        break;
      }
      case "goodbye_configure_message": {
        const { handleGoodbyeConfigureMessage } = await import(
          "../handlers/goodbyeHandlers.js"
        );
        await handleGoodbyeConfigureMessage(interaction);
        break;
      }
      case "goodbye_select_channel": {
        const { handleGoodbyeSelectChannel } = await import(
          "../handlers/goodbyeHandlers.js"
        );
        await handleGoodbyeSelectChannel(interaction);
        break;
      }
      case "goodbye_toggle": {
        const { handleGoodbyeToggle } = await import(
          "../handlers/goodbyeHandlers.js"
        );
        await handleGoodbyeToggle(interaction);
        break;
      }
      case "goodbye_reset": {
        const { handleGoodbyeReset } = await import(
          "../handlers/goodbyeHandlers.js"
        );
        await handleGoodbyeReset(interaction);
        break;
      }
      case "goodbye_format": {
        const { handleGoodbyeFormat } = await import(
          "../handlers/goodbyeHandlers.js"
        );
        await handleGoodbyeFormat(interaction);
        break;
      }
      case "goodbye_test": {
        const { handleGoodbyeTest } = await import(
          "../handlers/goodbyeHandlers.js"
        );
        await handleGoodbyeTest(interaction);
        break;
      }
      case "goodbye_back_to_settings": {
        const { handleSettings } = await import(
          "../../../commands/admin/goodbye/handlers.js"
        );
        await handleSettings(interaction, interaction.client);
        break;
      }
      case "goodbye_settings": {
        const { handleGoodbyeEdit } = await import(
          "../handlers/goodbyeHandlers.js"
        );
        await handleGoodbyeEdit(interaction);
        break;
      }

      default: {
        // Check if it's a help interaction that wasn't caught above
        if (customId.startsWith("help_cmd_")) {
          const { handleHelpInteraction } = await import(
            "../handlers/helpHandlers.js"
          );
          await handleHelpInteraction(interaction);
        } else {
          logger.debug(`Unknown button interaction: ${customId}`);
        }
        break;
      }
    }
  } catch (error) {
    logger.error(`Error routing button interaction ${customId}`, error);
    throw error; // Re-throw to be handled by the main interaction manager
  }
}
