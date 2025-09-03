import { getLogger } from "../../logger.js";

/**
 * Button interaction router
 * Routes button interactions to appropriate handlers based on customId patterns
 */

/**
 * Route button interaction to appropriate handler
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 * @param {import('discord.js').Client} _client - The Discord client (unused but kept for consistency)
 */
export async function routeButtonInteraction(interaction, _client) {
  const logger = getLogger();
  const { customId } = interaction;

  try {
    // Route based on customId patterns
    if (customId.startsWith("leaderboard_")) {
      const { handleLeaderboardButton } = await import(
        "../handlers/leaderboardHandlers.js"
      );
      await handleLeaderboardButton(interaction);
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

      // XP system buttons
      case "xp_toggle_system": {
        const { handleXPToggleSystem } = await import(
          "../handlers/xpHandlers.js"
        );
        await handleXPToggleSystem(interaction);
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

      default: {
        // Check if it's a help interaction that wasn't caught above
        if (
          customId === "help_category_select" ||
          customId.startsWith("help_cmd_")
        ) {
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
