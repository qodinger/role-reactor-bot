import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  scheduleTemporaryRole,
  createRecurringRoleSchedule,
  findScheduleById,
  cancelSchedule,
} from "../../../utils/discord/enhancedTemporaryRoles.js";
import {
  parseOneTimeSchedule,
  parseRecurringSchedule,
  getScheduleHelpText,
} from "../../../utils/scheduleParser.js";
import {
  createOneTimeScheduleEmbed,
  createRecurringScheduleEmbed,
} from "./embeds.js";
import {
  extractScheduleOptions,
  validateScheduleInputs,
  formatDisplayId,
} from "./utils.js";

// ============================================================================
// SCHEDULE CREATION HANDLERS
// ============================================================================

export async function handleScheduleRole(interaction, deferred = true) {
  const logger = getLogger();
  const options = extractScheduleOptions(interaction);

  logger.debug("Options received:", options);

  // Validate inputs
  const validation = await validateScheduleInputs(interaction, options);
  if (!validation.valid) {
    if (deferred) {
      return await interaction.editReply(validation.error);
    } else {
      return await interaction.reply({ ...validation.error, flags: 64 });
    }
  }

  try {
    let result;
    let embed;

    if (options.type === "one-time") {
      result = await createOneTimeSchedule(interaction, options);
      embed = createOneTimeScheduleEmbed(result, options);
    } else {
      // Parse the recurring schedule first to get the details for the embed
      const parsedSchedule = parseRecurringSchedule(
        options.type,
        options.schedule,
      );
      if (!parsedSchedule) {
        const errorResponse = {
          ...errorEmbed({
            title: "Invalid Schedule Details",
            description: getScheduleHelpText(options.type),
          }),
        };
        if (deferred) {
          return await interaction.editReply(errorResponse);
        } else {
          return await interaction.reply({ ...errorResponse, flags: 64 });
        }
      }

      result = await createRecurringSchedule(interaction, options);
      embed = createRecurringScheduleEmbed(result, options, parsedSchedule);
    }

    if (!result) {
      const errorResponse = {
        ...errorEmbed({
          title: "Creation Failed",
          description: "Failed to create the schedule. Please try again.",
        }),
      };
      if (deferred) {
        return await interaction.editReply(errorResponse);
      } else {
        return await interaction.reply({ ...errorResponse, flags: 64 });
      }
    }

    if (deferred) {
      await interaction.editReply({
        embeds: [embed],
        ephemeral: false,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        flags: 64,
      });
    }
  } catch (error) {
    logger.error("Error creating schedule:", error);
    const errorResponse = {
      ...errorEmbed({
        title: "Creation Failed",
        description:
          "An error occurred while creating the schedule. Please try again.",
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
// SCHEDULE CREATION FUNCTIONS
// ============================================================================

async function createOneTimeSchedule(interaction, options) {
  const scheduleTime = parseOneTimeSchedule(options.schedule);
  if (!scheduleTime) {
    throw new Error("Invalid schedule format");
  }

  const { userIds } = await validateScheduleInputs(interaction, options);

  return await scheduleTemporaryRole(
    interaction.guild.id,
    userIds,
    options.role.id,
    scheduleTime,
    options.duration,
    options.reason,
    interaction.user.id,
  );
}

async function createRecurringSchedule(interaction, options) {
  const schedule = parseRecurringSchedule(options.type, options.schedule);
  if (!schedule) {
    throw new Error("Invalid recurring schedule format");
  }

  const { userIds } = await validateScheduleInputs(interaction, options);

  return await createRecurringRoleSchedule(
    interaction.guild.id,
    userIds,
    options.role.id,
    schedule,
    options.duration,
    options.reason,
    interaction.user.id,
  );
}

// ============================================================================
// CANCEL HANDLERS
// ============================================================================

export async function handleCancel(interaction, deferred = true) {
  const logger = getLogger();
  const scheduleId = interaction.options.getString("id");

  try {
    const schedule = await findScheduleById(scheduleId);

    if (!schedule) {
      const errorResponse = {
        ...errorEmbed({
          title: "Schedule Not Found",
          description: `Could not find a schedule with ID \`${scheduleId}\`.`,
          solution:
            "Use `/schedule-role list` to see all available schedules and their IDs.",
        }),
      };
      if (deferred) {
        return await interaction.editReply(errorResponse);
      } else {
        return await interaction.reply({ ...errorResponse, flags: 64 });
      }
    }

    const success = await cancelSchedule(schedule.scheduleId);

    if (success) {
      const roleName =
        interaction.guild.roles.cache.get(schedule.roleId)?.name ||
        "Unknown Role";

      const successResponse = {
        embeds: [
          new (await import("discord.js")).EmbedBuilder()
            .setTitle("✅ Schedule Cancelled")
            .setDescription(
              `Successfully cancelled the schedule for **${roleName}**`,
            )
            .addFields(
              {
                name: "Schedule ID",
                value: `\`${formatDisplayId(schedule.scheduleId)}\``,
                inline: true,
              },
              { name: "Status", value: "🚫 **Cancelled**", inline: true },
              {
                name: "Users",
                value: `${schedule.userIds.length} user(s)`,
                inline: true,
              },
            )
            .setColor(0x00ff00)
            .setTimestamp(),
        ],
        ephemeral: false,
      };

      if (deferred) {
        await interaction.editReply(successResponse);
      } else {
        await interaction.reply({ ...successResponse, flags: 64 });
      }
    } else {
      const errorResponse = {
        ...errorEmbed({
          title: "Cancellation Failed",
          description: "Failed to cancel the schedule. Please try again.",
        }),
      };
      if (deferred) {
        await interaction.editReply(errorResponse);
      } else {
        await interaction.reply({ ...errorResponse, flags: 64 });
      }
    }
  } catch (error) {
    logger.error("Error cancelling schedule:", error);
    const errorResponse = {
      ...errorEmbed({
        title: "Cancellation Error",
        description: "An error occurred while trying to cancel the schedule.",
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
// VIEW HANDLERS
// ============================================================================

export async function handleView(interaction, deferred = true) {
  const logger = getLogger();
  const scheduleId = interaction.options.getString("id");

  try {
    const schedule = await findScheduleById(scheduleId);

    if (!schedule) {
      const errorResponse = {
        ...errorEmbed({
          title: "Schedule Not Found",
          description: `Could not find a schedule with ID \`${scheduleId}\`.`,
          solution:
            "Use `/schedule-role list` to see all available schedules and their IDs.",
        }),
      };
      if (deferred) {
        return await interaction.editReply(errorResponse);
      } else {
        return await interaction.reply({ ...errorResponse, flags: 64 });
      }
    }

    const { createScheduleDetailEmbed } = await import("./embeds.js");
    const embed = createScheduleDetailEmbed(schedule, interaction.guild);

    if (deferred) {
      await interaction.editReply({
        embeds: [embed],
        ephemeral: false,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        flags: 64,
      });
    }
  } catch (error) {
    logger.error("Error viewing schedule:", error);
    const errorResponse = {
      ...errorEmbed({
        title: "View Error",
        description: "An error occurred while trying to view the schedule.",
      }),
    };
    if (deferred) {
      await interaction.editReply(errorResponse);
    } else {
      await interaction.reply({ ...errorResponse, flags: 64 });
    }
  }
}
