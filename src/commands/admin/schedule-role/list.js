import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  getScheduledRoles,
  getRecurringSchedules,
} from "../../../utils/discord/enhancedTemporaryRoles.js";
import {
  createScheduledRolesEmbed,
  createRecurringSchedulesEmbed,
} from "./embeds.js";

// ============================================================================
// LIST HANDLERS
// ============================================================================

export async function handleList(interaction, deferred = true) {
  const logger = getLogger();

  try {
    const guildId = interaction.guild.id;
    const { scheduledRoles, recurringSchedules } =
      await fetchActiveSchedules(guildId);

    if (scheduledRoles.length === 0 && recurringSchedules.length === 0) {
      const response = {
        ...errorEmbed({
          title: "No Active Schedules",
          description:
            "There are no active scheduled or recurring roles in this server.",
          solution:
            "Use `/schedule-role create` to schedule your first role assignment!",
        }),
      };

      if (deferred) {
        return await interaction.editReply(response);
      } else {
        return await interaction.reply({ ...response, flags: 64 });
      }
    }

    const embeds = createScheduleEmbeds(
      scheduledRoles,
      recurringSchedules,
      interaction.guild,
    );

    if (deferred) {
      await interaction.editReply({ embeds, ephemeral: false });
    } else {
      await interaction.reply({ embeds, flags: 64 });
    }
  } catch (error) {
    logger.error("Error listing schedules:", error);
    const errorResponse = {
      ...errorEmbed({
        title: "Error Loading Schedules",
        description: "Failed to load the schedule list. Please try again.",
      }),
    };

    if (deferred) {
      await interaction.editReply(errorResponse);
    } else {
      await interaction.reply({ ...errorResponse, flags: 64 });
    }
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

  if (scheduledRoles.length > 0) {
    embeds.push(createScheduledRolesEmbed(scheduledRoles, guild));
  }

  if (recurringSchedules.length > 0) {
    embeds.push(createRecurringSchedulesEmbed(recurringSchedules, guild));
  }

  return embeds;
}
