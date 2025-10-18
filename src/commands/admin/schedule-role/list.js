import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  getScheduledRoles,
  getRecurringSchedules,
} from "../../../utils/discord/temporaryRoles.js";
import {
  createScheduledRolesEmbed,
  createRecurringSchedulesEmbed,
} from "./embeds.js";

// Import refactored utility modules
import { validateInteraction } from "./validation.js";
import { sendResponse } from "./deferral.js";
import { handleCommandError } from "./errorHandling.js";

// ============================================================================
// LIST HANDLERS
// ============================================================================

export async function handleList(interaction, deferred = false) {
  const logger = getLogger();

  try {
    logger.debug("handleList called", {
      interactionId: interaction.id,
      deferred,
      guildId: interaction.guild?.id,
    });

    // Validate interaction only if not already deferred
    if (!deferred) {
      const validation = validateInteraction(interaction);
      if (!validation.success) {
        logger.warn("Interaction validation failed", {
          interactionId: interaction.id,
          validation,
        });
        return;
      }
    }

    // Note: deferral is handled by the main command handler
    // This function assumes the interaction is already deferred

    const guildId = interaction.guild.id;
    logger.debug("Fetching active schedules", { guildId });

    const { scheduledRoles, recurringSchedules } =
      await fetchActiveSchedules(guildId);

    if (scheduledRoles.length === 0 && recurringSchedules.length === 0) {
      logger.debug("No schedules found, creating error response", {
        scheduledRolesCount: scheduledRoles.length,
        recurringSchedulesCount: recurringSchedules.length,
      });

      const response = errorEmbed({
        title: "No Active Schedules",
        description:
          "There are no active scheduled or recurring roles in this server.",
        solution:
          "Use `/schedule-role create` to schedule your first role assignment!",
      });

      logger.debug("Error response created", {
        hasEmbeds: !!response.embeds,
        embedsCount: response.embeds?.length || 0,
        firstEmbedTitle: response.embeds?.[0]?.data?.title,
        firstEmbedDescription: response.embeds?.[0]?.data?.description,
      });

      return await sendResponse(interaction, response, deferred);
    }

    const embeds = createScheduleEmbeds(
      scheduledRoles,
      recurringSchedules,
      interaction.guild,
    );

    logger.debug("Sending schedule list response", {
      embedsCount: embeds.length,
      scheduledRolesCount: scheduledRoles.length,
      recurringSchedulesCount: recurringSchedules.length,
      deferred,
      interactionId: interaction.id,
    });

    // Debug: Check embed structure
    if (embeds.length > 0) {
      logger.debug("First embed structure", {
        title: embeds[0].data?.title,
        description: embeds[0].data?.description,
        fieldsCount: embeds[0].data?.fields?.length || 0,
      });
    }

    await sendResponse(
      interaction,
      {
        embeds,
      },
      deferred,
    );

    logger.debug("Schedule list completed successfully", {
      scheduledRolesCount: scheduledRoles.length,
      recurringSchedulesCount: recurringSchedules.length,
    });
  } catch (error) {
    await handleCommandError(interaction, error, "schedule listing", deferred);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchActiveSchedules(guildId) {
  const scheduledRoles = await getScheduledRoles(guildId);
  const recurringSchedules = await getRecurringSchedules(guildId);

  const activeScheduledRoles = scheduledRoles.filter(
    role => !["completed", "cancelled"].includes(role.status),
  );
  const activeRecurringSchedules = recurringSchedules.filter(
    schedule => !["cancelled"].includes(schedule.status),
  );

  return {
    scheduledRoles: activeScheduledRoles,
    recurringSchedules: activeRecurringSchedules,
  };
}

function createScheduleEmbeds(scheduledRoles, recurringSchedules, guild) {
  const embeds = [];

  // Always create embeds, even for empty arrays, so we can show "No active schedules" messages
  embeds.push(createScheduledRolesEmbed(scheduledRoles, guild));
  embeds.push(createRecurringSchedulesEmbed(recurringSchedules, guild));

  return embeds;
}
