import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import {
  hasAdminPermissions,
  getMissingBotPermissions,
} from "../../utils/discord/permissions.js";
import {
  getScheduledRoles,
  getRecurringSchedules,
  cancelScheduledRole,
  cancelRecurringSchedule,
} from "../../utils/discord/enhancedTemporaryRoles.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";
import {
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

export const data = new SlashCommandBuilder()
  .setName("scheduled-roles")
  .setDescription("Manage scheduled and recurring temporary role assignments")
  .addSubcommand(subcommand =>
    subcommand
      .setName("list")
      .setDescription("List all scheduled and recurring role assignments"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("view")
      .setDescription("View details of a specific scheduled role")
      .addStringOption(option =>
        option
          .setName("schedule_id")
          .setDescription("The ID of the scheduled role to view")
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("cancel")
      .setDescription("Cancel a scheduled or recurring role assignment")
      .addStringOption(option =>
        option
          .setName("schedule_id")
          .setDescription("The ID of the scheduled role to cancel")
          .setRequired(true),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  const logger = getLogger();

  try {
    // Check if interaction is still valid before proceeding
    if (!interaction.isRepliable()) {
      logger.warn("Interaction is no longer repliable, skipping execution");
      return;
    }

    // Immediately acknowledge the interaction to prevent timeout
    try {
      await interaction.deferReply({ flags: 64 }); // 64 = ephemeral flag
    } catch (deferError) {
      // Only log if it's not a common "already acknowledged" error
      if (
        deferError.message !== "Interaction has already been acknowledged." &&
        deferError.message !== "Unknown interaction"
      ) {
        logger.error("Failed to defer reply:", deferError);
      }
      // If defer fails, try to reply directly
      try {
        await interaction.reply({
          embeds: [
            errorEmbed({
              title: "Command Error",
              description: "Failed to process command. Please try again.",
            }),
          ],
          flags: 64, // ephemeral flag
        });
      } catch (replyError) {
        // Only log if it's not a common "already acknowledged" error
        if (
          replyError.message !== "Interaction has already been acknowledged."
        ) {
          logger.error("Failed to send error response:", replyError);
        }
      }
      return;
    }

    // Check permissions
    if (!(await hasAdminPermissions(interaction.member, ["ManageRoles"]))) {
      const missingPermissions = await getMissingBotPermissions(
        interaction.guild,
        ["ManageRoles"],
      );
      return await interaction.editReply({
        ...permissionErrorEmbed({
          requiredPermissions: ["ManageRoles"],
          userPermissions: missingPermissions,
        }),
      });
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "list":
        await handleList(interaction);
        break;
      case "view":
        await handleView(interaction, interaction.options);
        break;
      case "cancel":
        await handleCancel(interaction, interaction.options);
        break;
      default:
        await interaction.editReply({
          embeds: [
            errorEmbed({
              title: "Invalid Subcommand",
              description:
                "Please use a valid subcommand: list, view, or cancel.",
            }),
          ],
        });
    }
  } catch (error) {
    logger.error("Error in scheduled-roles command:", error);

    // Try to send error response, but don't fail if interaction is already handled
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          embeds: [
            errorEmbed({
              title: "Unexpected Error",
              description: "An unexpected error occurred. Please try again.",
            }),
          ],
        });
      } else {
        await interaction.reply({
          embeds: [
            errorEmbed({
              title: "Unexpected Error",
              description: "An unexpected error occurred. Please try again.",
            }),
          ],
          flags: 64, // ephemeral flag
        });
      }
    } catch (replyError) {
      logger.error("Failed to send error response:", replyError);
    }
  }
}

async function handleList(interaction) {
  const { guild } = interaction;

  try {
    // Get both scheduled and recurring roles
    const [scheduledRoles, recurringSchedules] = await Promise.all([
      getScheduledRoles(guild.id),
      getRecurringSchedules(guild.id),
    ]);

    if (scheduledRoles.length === 0 && recurringSchedules.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle("📋 Scheduled and Recurring Roles")
        .setDescription(
          "No scheduled or recurring role assignments found for this server.",
        )
        .setColor(THEME_COLOR)
        .setTimestamp();

      return await interaction.editReply({
        embeds: [embed],
      });
    }

    // Create embeds for both scheduled roles and recurring schedules
    const scheduledEmbed = createScheduledRolesEmbed(guild, scheduledRoles);
    const recurringEmbed = createRecurringSchedulesEmbed(
      guild,
      recurringSchedules,
    );

    const embeds = [scheduledEmbed];
    if (recurringSchedules.length > 0) {
      embeds.push(recurringEmbed);
    }

    await interaction.editReply({
      embeds,
    });
  } catch (error) {
    const logger = getLogger();
    logger.error("Error listing scheduled roles:", error);
    await interaction.editReply({
      ...errorEmbed({
        title: "List Failed",
        description: "Failed to retrieve scheduled roles. Please try again.",
      }),
    });
  }
}

async function handleView(interaction, options) {
  const shortId = options.getString("schedule_id");

  try {
    // Check both scheduled and recurring roles
    const [scheduledRoles, recurringSchedules] = await Promise.all([
      getScheduledRoles(interaction.guild.id),
      getRecurringSchedules(interaction.guild.id),
    ]);

    // Find the actual schedule using the ID (handles both full and short IDs)
    const { scheduledRole, recurringSchedule } = findScheduleById(
      shortId,
      scheduledRoles,
      recurringSchedules,
    );

    if (!scheduledRole && !recurringSchedule) {
      return await interaction.editReply({
        ...errorEmbed({
          title: "Schedule Not Found",
          description:
            "No scheduled or recurring role found with that ID. Please check the ID and try again.",
        }),
      });
    }

    if (scheduledRole) {
      const embed = createScheduledRoleDetailEmbed(
        interaction.guild,
        scheduledRole,
      );
      await interaction.editReply({
        embeds: [embed],
      });
    } else {
      const embed = createRecurringScheduleDetailEmbed(
        interaction.guild,
        recurringSchedule,
      );
      await interaction.editReply({
        embeds: [embed],
      });
    }
  } catch (error) {
    const logger = getLogger();
    logger.error("Error viewing scheduled role:", error);
    await interaction.editReply({
      ...errorEmbed({
        title: "View Failed",
        description: "Failed to retrieve schedule details. Please try again.",
      }),
    });
  }
}

async function handleCancel(interaction, options) {
  const shortId = options.getString("schedule_id");

  try {
    // Get all schedules to find the one with matching short ID
    const [scheduledRoles, recurringSchedules] = await Promise.all([
      getScheduledRoles(interaction.guild.id),
      getRecurringSchedules(interaction.guild.id),
    ]);

    // Find the actual schedule using the ID (handles both full and short IDs)
    const { scheduledRole, recurringSchedule } = findScheduleById(
      shortId,
      scheduledRoles,
      recurringSchedules,
    );

    if (!scheduledRole && !recurringSchedule) {
      return await interaction.editReply({
        ...errorEmbed({
          title: "Schedule Not Found",
          description: "No scheduled or recurring role found with that ID.",
        }),
      });
    }

    // Cancel the found schedule
    let scheduledCancelled = false;
    let recurringCancelled = false;

    if (scheduledRole) {
      scheduledCancelled = await cancelScheduledRole(scheduledRole.scheduleId);
    }
    if (recurringSchedule) {
      recurringCancelled = await cancelRecurringSchedule(
        recurringSchedule.scheduleId,
      );
    }

    if (!scheduledCancelled && !recurringCancelled) {
      return await interaction.editReply({
        ...errorEmbed({
          title: "Schedule Not Found",
          description: "No scheduled or recurring role found with that ID.",
        }),
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("❌ Schedule Cancelled")
      .setDescription(
        "The scheduled or recurring role has been cancelled successfully.",
      )
      .setColor(THEME_COLOR)
      .addFields({
        name: "🆔 Schedule ID",
        value: `\`${shortId}\``,
        inline: true,
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    const logger = getLogger();
    logger.error("Error cancelling scheduled role:", error);
    await interaction.editReply({
      ...errorEmbed({
        title: "Cancellation Failed",
        description: "Failed to cancel the schedule. Please try again.",
      }),
    });
  }
}

function formatDisplayId(id) {
  // For display purposes, show a shorter, more readable format
  if (id.length <= 12) {
    return id; // If ID is already short, return as-is
  }
  // Show first 8 + last 4 characters with a separator for readability
  return `${id.substring(0, 8)}...${id.substring(id.length - 4)}`;
}

function findScheduleById(id, scheduledRoles, recurringSchedules) {
  // Handle display format like "2802a998...7f7a"
  if (id.includes("...")) {
    const parts = id.split("...");
    if (parts.length === 2) {
      // Reconstruct the full ID from display format
      const firstPart = parts[0];
      const lastPart = parts[1];

      // Find schedules that start with first part and end with last part
      const scheduledRole = scheduledRoles.find(
        role =>
          role.scheduleId.startsWith(firstPart) &&
          role.scheduleId.endsWith(lastPart),
      );
      const recurringSchedule = recurringSchedules.find(
        schedule =>
          schedule.scheduleId.startsWith(firstPart) &&
          schedule.scheduleId.endsWith(lastPart),
      );

      if (scheduledRole || recurringSchedule) {
        return { scheduledRole, recurringSchedule };
      }
    }
  }

  // First try exact match (handles both full and short IDs)
  let scheduledRole = scheduledRoles.find(role => role.scheduleId === id);
  let recurringSchedule = recurringSchedules.find(
    schedule => schedule.scheduleId === id,
  );

  // If no exact match, try partial match (handles short IDs)
  if (!scheduledRole && !recurringSchedule) {
    scheduledRole = scheduledRoles.find(role => role.scheduleId.startsWith(id));
    recurringSchedule = recurringSchedules.find(schedule =>
      schedule.scheduleId.startsWith(id),
    );
  }

  return { scheduledRole, recurringSchedule };
}

function createScheduledRolesEmbed(guild, scheduledRoles) {
  if (scheduledRoles.length === 0) {
    return new EmbedBuilder()
      .setTitle("⏰ Scheduled Roles")
      .setDescription("No scheduled role assignments found.")
      .setColor(THEME_COLOR);
  }

  const embed = new EmbedBuilder()
    .setTitle("⏰ Scheduled Roles")
    .setDescription(
      `Found **${scheduledRoles.length}** scheduled role assignment(s).`,
    )
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Scheduled Roles",
      iconURL: guild.iconURL(),
    });

  // Group by status
  const pending = scheduledRoles.filter(r => r.status === "scheduled");
  const completed = scheduledRoles.filter(r => r.status === "completed");
  const failed = scheduledRoles.filter(r => r.status === "failed");

  if (pending.length > 0) {
    const pendingList = pending
      .sort((a, b) => new Date(a.scheduleTime) - new Date(b.scheduleTime))
      .map(role => {
        const roleObj = guild.roles.cache.get(role.roleId);
        const roleName = roleObj ? roleObj.name : "Unknown Role";
        const timeUntil = formatTimeUntil(new Date(role.scheduleTime));
        return `• **${roleName}** - ${timeUntil} (ID: \`${formatDisplayId(role.scheduleId)}\`)`;
      })
      .join("\n");

    embed.addFields({
      name: "⏳ Pending",
      value: pendingList,
      inline: false,
    });
  }

  if (completed.length > 0) {
    const completedList = completed
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 5)
      .map(role => {
        const roleObj = guild.roles.cache.get(role.roleId);
        const roleName = roleObj ? roleObj.name : "Unknown Role";
        const completedTime = formatTimeAgo(new Date(role.completedAt));
        return `• **${roleName}** - ${completedTime} (ID: \`${formatDisplayId(role.scheduleId)}\`)`;
      })
      .join("\n");

    embed.addFields({
      name: "✅ Completed",
      value: completedList + (completed.length > 5 ? "\n*... and more*" : ""),
      inline: false,
    });
  }

  if (failed.length > 0) {
    const failedList = failed
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 3)
      .map(role => {
        const roleObj = guild.roles.cache.get(role.roleId);
        const roleName = roleObj ? roleObj.name : "Unknown Role";
        const failedTime = formatTimeAgo(new Date(role.completedAt));
        return `• **${roleName}** - ${failedTime} (ID: \`${formatDisplayId(role.scheduleId)}\`)`;
      })
      .join("\n");

    embed.addFields({
      name: "❌ Failed",
      value: failedList + (failed.length > 3 ? "\n*... and more*" : ""),
      inline: false,
    });
  }

  return embed;
}

function createRecurringSchedulesEmbed(guild, recurringSchedules) {
  if (recurringSchedules.length === 0) {
    return new EmbedBuilder()
      .setTitle("🔄 Recurring Schedules")
      .setDescription("No recurring role schedules found.")
      .setColor(THEME_COLOR);
  }

  const embed = new EmbedBuilder()
    .setTitle("🔄 Recurring Schedules")
    .setDescription(
      `Found **${recurringSchedules.length}** recurring role schedule(s).`,
    )
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Recurring Schedules",
      iconURL: guild.iconURL(),
    });

  // Group by status
  const active = recurringSchedules.filter(r => r.status === "active");
  const paused = recurringSchedules.filter(r => r.status === "paused");
  const cancelled = recurringSchedules.filter(r => r.status === "cancelled");

  if (active.length > 0) {
    const activeList = active
      .sort((a, b) => new Date(a.nextRun || 0) - new Date(b.nextRun || 0))
      .map(schedule => {
        const roleObj = guild.roles.cache.get(schedule.roleId);
        const roleName = roleObj ? roleObj.name : "Unknown Role";
        const nextRun = schedule.nextRun
          ? formatTimeUntil(new Date(schedule.nextRun))
          : "No next run";
        return `• **${roleName}** - ${nextRun} (ID: \`${formatDisplayId(schedule.scheduleId)}\`)`;
      })
      .join("\n");

    embed.addFields({
      name: "🟢 Active",
      value: activeList,
      inline: false,
    });
  }

  if (paused.length > 0) {
    const pausedList = paused
      .slice(0, 5)
      .map(schedule => {
        const roleObj = guild.roles.cache.get(schedule.roleId);
        const roleName = roleObj ? roleObj.name : "Unknown Role";
        return `• **${roleName}** (ID: \`${formatDisplayId(schedule.scheduleId)}\`)`;
      })
      .join("\n");

    embed.addFields({
      name: "⏸️ Paused",
      value: pausedList + (paused.length > 5 ? "\n*... and more*" : ""),
      inline: false,
    });
  }

  if (cancelled.length > 0) {
    const cancelledList = cancelled
      .slice(0, 3)
      .map(schedule => {
        const roleObj = guild.roles.cache.get(schedule.roleId);
        const roleName = roleObj ? roleObj.name : "Unknown Role";
        return `• **${roleName}** (ID: \`${formatDisplayId(schedule.scheduleId)}\`)`;
      })
      .join("\n");

    embed.addFields({
      name: "❌ Cancelled",
      value: cancelledList + (cancelled.length > 3 ? "\n*... and more*" : ""),
      inline: false,
    });
  }

  return embed;
}

function createScheduledRoleDetailEmbed(guild, scheduledRole) {
  const role = guild.roles.cache.get(scheduledRole.roleId);
  const roleName = role ? role.name : "Unknown Role";
  const scheduledBy = guild.members.cache.get(scheduledRole.scheduledBy);
  const scheduledByName = scheduledBy
    ? scheduledBy.displayName
    : "Unknown User";

  const embed = new EmbedBuilder()
    .setTitle("⏰ Scheduled Role Details")
    .setDescription(`Details for scheduled role assignment **${roleName}**`)
    .setColor(THEME_COLOR)
    .addFields(
      {
        name: "🆔 Schedule ID",
        value: `\`${formatDisplayId(scheduledRole.scheduleId)}\``,
        inline: true,
      },
      {
        name: "🎯 Role",
        value: roleName,
        inline: true,
      },
      {
        name: "📅 Schedule Time",
        value: formatDateTime(new Date(scheduledRole.scheduleTime)),
        inline: true,
      },
      {
        name: "⏱️ Duration",
        value: scheduledRole.duration,
        inline: true,
      },
      {
        name: "👥 Users",
        value: `${scheduledRole.userIds.length} user(s)`,
        inline: true,
      },
      {
        name: "📝 Reason",
        value: scheduledRole.reason || "No reason specified",
        inline: true,
      },
      {
        name: "👤 Scheduled By",
        value: scheduledByName,
        inline: true,
      },
      {
        name: "📊 Status",
        value: formatStatus(scheduledRole.status),
        inline: true,
      },
      {
        name: "🕐 Created",
        value: formatDateTime(new Date(scheduledRole.createdAt)),
        inline: true,
      },
    )
    .setTimestamp();

  if (scheduledRole.status === "completed" && scheduledRole.completedAt) {
    embed.addFields({
      name: "✅ Completed At",
      value: formatDateTime(new Date(scheduledRole.completedAt)),
      inline: true,
    });
  }

  if (scheduledRole.result) {
    embed.addFields({
      name: "📋 Result",
      value: scheduledRole.result,
      inline: false,
    });
  }

  return embed;
}

function createRecurringScheduleDetailEmbed(guild, recurringSchedule) {
  const role = guild.roles.cache.get(recurringSchedule.roleId);
  const roleName = role ? role.name : "Unknown Role";
  const createdBy = guild.members.cache.get(recurringSchedule.createdBy);
  const createdByName = createdBy ? createdBy.displayName : "Unknown User";

  const embed = new EmbedBuilder()
    .setTitle("🔄 Recurring Schedule Details")
    .setDescription(`Details for recurring role schedule **${roleName}**`)
    .setColor(THEME_COLOR)
    .addFields(
      {
        name: "🆔 Schedule ID",
        value: `\`${formatDisplayId(recurringSchedule.scheduleId)}\``,
        inline: true,
      },
      {
        name: "🎯 Role",
        value: roleName,
        inline: true,
      },
      {
        name: "📅 Schedule Type",
        value: formatScheduleType(recurringSchedule.schedule.type),
        inline: true,
      },
      {
        name: "⏰ Schedule Details",
        value: formatScheduleDetails(
          recurringSchedule.schedule,
          recurringSchedule.schedule.type,
        ),
        inline: true,
      },
      {
        name: "⏱️ Duration",
        value: recurringSchedule.duration,
        inline: true,
      },
      {
        name: "👥 Users",
        value: `${recurringSchedule.userIds.length} user(s)`,
        inline: true,
      },
      {
        name: "📝 Reason",
        value: recurringSchedule.reason || "No reason specified",
        inline: true,
      },
      {
        name: "👤 Created By",
        value: createdByName,
        inline: true,
      },
      {
        name: "📊 Status",
        value: formatStatus(recurringSchedule.status),
        inline: true,
      },
      {
        name: "🕐 Created",
        value: formatDateTime(new Date(recurringSchedule.createdAt)),
        inline: true,
      },
    )
    .setTimestamp();

  if (recurringSchedule.lastRun) {
    embed.addFields({
      name: "🔄 Last Run",
      value: formatDateTime(new Date(recurringSchedule.lastRun)),
      inline: true,
    });
  }

  if (recurringSchedule.nextRun) {
    embed.addFields({
      name: "⏰ Next Run",
      value: formatDateTime(new Date(recurringSchedule.nextRun)),
      inline: true,
    });
  }

  return embed;
}

// Utility functions
function formatTimeUntil(date) {
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return `in ${diffDays} day(s)`;
  } else if (diffHours > 0) {
    return `in ${diffHours} hour(s)`;
  } else if (diffMinutes > 0) {
    return `in ${diffMinutes} minute(s)`;
  } else {
    return "now";
  }
}

function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays} day(s) ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour(s) ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute(s) ago`;
  } else {
    return "just now";
  }
}

function formatDateTime(date) {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatStatus(status) {
  const statusMap = {
    scheduled: "⏳ Scheduled",
    completed: "✅ Completed",
    failed: "❌ Failed",
    active: "🔄 Active",
    cancelled: "❌ Cancelled",
  };
  return statusMap[status] || status;
}

function formatScheduleType(type) {
  const types = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    custom: "Custom Interval",
  };
  return types[type] || type;
}

function formatScheduleDetails(schedule, type) {
  switch (type) {
    case "daily":
      return `${schedule.hour}:${schedule.minute.toString().padStart(2, "0")} daily`;
    case "weekly": {
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      return `${dayNames[schedule.dayOfWeek]} at ${schedule.hour}:${schedule.minute.toString().padStart(2, "0")}`;
    }
    case "monthly":
      return `${schedule.dayOfMonth}${getOrdinalSuffix(schedule.dayOfMonth)} at ${schedule.hour}:${schedule.minute.toString().padStart(2, "0")}`;
    case "custom":
      if (schedule.intervalMinutes < 60) {
        return `Every ${schedule.intervalMinutes} minute(s)`;
      } else if (schedule.intervalMinutes < 1440) {
        const hours = Math.floor(schedule.intervalMinutes / 60);
        return `Every ${hours} hour(s)`;
      } else {
        const days = Math.floor(schedule.intervalMinutes / 1440);
        return `Every ${days} day(s)`;
      }
    default:
      return "Unknown schedule";
  }
}

function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
