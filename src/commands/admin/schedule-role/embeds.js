import { EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";
import {
  formatScheduleTime,
  formatRecurringSchedule,
  getNextExecutionTime,
} from "./utils.js";

/**
 * Create the schedule creation embed
 */
export function createScheduleEmbed(
  scheduleData,
  role,
  users,
  scheduleType,
  scheduleInput,
  client,
  isAllMembers = false,
  totalUserCount = null,
  targetRole = null,
  targetRoles = null,
  isMixed = false,
) {
  const isRecurring = scheduleType !== "one-time";
  const action = scheduleData.action === "assign" ? "Assign" : "Remove";
  const userCount = totalUserCount !== null ? totalUserCount : users.length;

  // Build target description
  let targetDescription = "";
  if (isMixed && targetRoles && targetRoles.length > 0) {
    const roleNames =
      targetRoles.length === 1
        ? targetRoles[0].name
        : targetRoles.map(r => r.name).join(", ");
    targetDescription = `Users + Members with role${targetRoles.length > 1 ? "s" : ""}: ${roleNames}`;
  } else if (targetRoles && targetRoles.length > 0) {
    if (targetRoles.length === 1) {
      targetDescription = `Members with role ${targetRoles[0].name}`;
    } else {
      targetDescription = `Members with roles: ${targetRoles.map(r => r.name).join(", ")}`;
    }
  } else if (targetRole) {
    targetDescription = `Members with role ${targetRole.name}`;
  } else if (isAllMembers) {
    targetDescription = "All server members";
  } else {
    targetDescription = `${userCount} user${userCount !== 1 ? "s" : ""}`;
  }

  const roleMention = role ? role.toString() : "Unknown Role";
  const descriptionText = `Schedule created successfully. The ${roleMention} role will be ${action.toLowerCase()}ed ${isRecurring ? "recurringly" : "once"} to ${targetDescription}.`;

  const embed = new EmbedBuilder()
    .setTitle("Schedule Created")
    .setDescription(descriptionText)
    .setColor(THEME.SUCCESS)
    .setThumbnail(role?.iconURL() || null)
    .setTimestamp()
    .setFooter({
      text: `Schedule ID: ${scheduleData.id}`,
      iconURL: client.user?.displayAvatarURL() || undefined,
    });

  // Schedule details
  const scheduleInfo = isRecurring
    ? formatRecurringSchedule(scheduleData.scheduleConfig)
    : formatScheduleTime(scheduleData.scheduledAt);

  embed.addFields(
    {
      name: "Schedule Details",
      value: `**Type:** ${isRecurring ? "Recurring" : "One-time"}\n**Action:** ${action}\n**Schedule:** ${scheduleInfo}`,
      inline: true,
    },
    {
      name: "Target",
      value: `**Role:** ${roleMention}\n**Users:** ${targetDescription}\n**Count:** ${userCount}`,
      inline: true,
    },
  );

  // Show next execution time for recurring schedules
  if (isRecurring && scheduleData.scheduleConfig) {
    const nextExecution = getNextExecutionTime(
      scheduleData.scheduleConfig,
      scheduleType,
    );
    if (nextExecution) {
      embed.addFields({
        name: "Next Execution",
        value: `<t:${Math.floor(nextExecution.getTime() / 1000)}:F>\n<t:${Math.floor(nextExecution.getTime() / 1000)}:R>`,
        inline: false,
      });
    }
  }

  // Add reason if provided
  if (scheduleData.reason && scheduleData.reason !== "No reason provided") {
    embed.addFields({
      name: "Reason",
      value: scheduleData.reason,
      inline: false,
    });
  }

  return embed;
}

/**
 * Create the schedule list embed
 */
export function createScheduleListEmbed(
  schedules,
  guild,
  currentPage,
  totalPages,
  totalSchedules,
  client,
  showAll = false,
) {
  const embed = new EmbedBuilder()
    .setTitle("Scheduled Roles")
    .setDescription(
      showAll
        ? `Showing **${totalSchedules}** scheduled role${totalSchedules !== 1 ? "s" : ""} (including executed, inactive, and cancelled)`
        : `Showing **${totalSchedules}** active scheduled role${totalSchedules !== 1 ? "s" : ""}`,
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: `${guild.name} • Page ${currentPage} of ${totalPages || 1}`,
      iconURL: client.user.displayAvatarURL(),
    });

  if (schedules.length === 0) {
    embed.addFields({
      name: "No Schedules Found",
      value:
        "No scheduled roles found. Use `/schedule-role create` to create a new schedule.",
      inline: false,
    });
    return embed;
  }

  // Group schedules into a cleaner format
  for (const schedule of schedules) {
    const scheduleType =
      schedule.type ||
      (schedule.active !== undefined ? "recurring" : "one-time");
    const isRecurring = scheduleType === "recurring";

    // Determine status
    let statusText = "";
    let statusColor = "";
    if (isRecurring) {
      if (schedule.active && !schedule.cancelled) {
        statusText = "Active";
        statusColor = "🟢";
      } else if (schedule.cancelled) {
        statusText = "Cancelled";
        statusColor = "❌";
      } else {
        statusText = "Inactive";
        statusColor = "🔴";
      }
    } else {
      if (schedule.executed) {
        statusText = "Executed";
        statusColor = "✅";
      } else if (schedule.cancelled) {
        statusText = "Cancelled";
        statusColor = "❌";
      } else {
        statusText = "Pending";
        statusColor = "⏳";
      }
    }

    // Format schedule time
    let scheduleText = "";
    if (isRecurring) {
      scheduleText = formatRecurringSchedule(
        schedule.scheduleConfig || schedule,
      );
    } else {
      scheduleText = formatScheduleTime(schedule.scheduledAt);
    }

    const usersCount = Array.isArray(schedule.userIds)
      ? schedule.userIds.length
      : 1;

    const actionText = schedule.action === "assign" ? "Assign" : "Remove";

    embed.addFields({
      name: `${statusColor} ${actionText} • ${scheduleType === "recurring" ? "Recurring" : "One-time"}`,
      value: `**ID:** \`${schedule.id}\`\n**Status:** ${statusText}\n**Users:** ${usersCount}\n**Schedule:** ${scheduleText}`,
      inline: false,
    });
  }

  return embed;
}

/**
 * Create the schedule view embed
 */
export function createScheduleViewEmbed(schedule, scheduleType, guild, client) {
  const isRecurring = scheduleType === "recurring";
  const action = schedule.action === "assign" ? "Assign" : "Remove";

  // Determine status
  let statusText = "";
  let statusColor = "";
  if (isRecurring) {
    if (schedule.active && !schedule.cancelled) {
      statusText = "Active";
      statusColor = "🟢";
    } else if (schedule.cancelled) {
      statusText = "Cancelled";
      statusColor = "❌";
    } else {
      statusText = "Inactive";
      statusColor = "🔴";
    }
  } else {
    if (schedule.executed) {
      statusText = "Executed";
      statusColor = "✅";
    } else if (schedule.cancelled) {
      statusText = "Cancelled";
      statusColor = "❌";
    } else {
      statusText = "Pending";
      statusColor = "⏳";
    }
  }

  // Get role info
  const role = guild.roles.cache.get(schedule.roleId);
  const roleMention = role ? role.toString() : `\`${schedule.roleId}\``;

  // Get users info
  const userIds = Array.isArray(schedule.userIds)
    ? schedule.userIds
    : [schedule.userId].filter(Boolean);

  const embed = new EmbedBuilder()
    .setTitle(`Schedule: ${schedule.id}`)
    .setDescription(
      `${statusColor} **${statusText}** • ${action} ${isRecurring ? "Recurring" : "One-time"} Schedule`,
    )
    .setColor(
      statusText === "Active" || statusText === "Pending"
        ? THEME.SUCCESS
        : statusText === "Executed"
          ? THEME.INFO
          : THEME.ERROR,
    )
    .setThumbnail(role ? role.iconURL() : null)
    .setTimestamp()
    .setFooter({
      text: `Role Reactor • Scheduled Roles`,
      iconURL: client.user.displayAvatarURL(),
    });

  // Basic information
  embed.addFields(
    {
      name: "Schedule Information",
      value: `**ID:** \`${schedule.id}\`\n**Type:** ${isRecurring ? "Recurring" : "One-time"}\n**Action:** ${action}\n**Status:** ${statusText}`,
      inline: true,
    },
    {
      name: "Role & Target",
      value: `**Role:** ${roleMention}\n**Users:** ${userIds.length} user${userIds.length !== 1 ? "s" : ""}`,
      inline: true,
    },
  );

  // Schedule-specific information
  if (isRecurring) {
    const scheduleText = formatRecurringSchedule(
      schedule.scheduleConfig || schedule,
    );
    const nextExecution = getNextExecutionTime(
      schedule.scheduleConfig || schedule,
      scheduleType,
    );

    const scheduleValue = [`**Schedule:** ${scheduleText}`];

    if (schedule.lastExecutedAt) {
      scheduleValue.push(
        `**Last executed:** <t:${Math.floor(new Date(schedule.lastExecutedAt).getTime() / 1000)}:R>`,
      );
    } else {
      scheduleValue.push("**Last executed:** Never");
    }

    if (nextExecution) {
      scheduleValue.push(
        `**Next execution:** <t:${Math.floor(nextExecution.getTime() / 1000)}:R>`,
      );
    }

    embed.addFields({
      name: "Recurring Schedule",
      value: scheduleValue.join("\n"),
      inline: false,
    });
  } else {
    const scheduleValue = [
      `**Scheduled for:** <t:${Math.floor(new Date(schedule.scheduledAt).getTime() / 1000)}:F>`,
      `**Time until execution:** <t:${Math.floor(new Date(schedule.scheduledAt).getTime() / 1000)}:R>`,
    ];

    if (schedule.executedAt) {
      scheduleValue.push(
        `**Executed at:** <t:${Math.floor(new Date(schedule.executedAt).getTime() / 1000)}:F>`,
      );
    }

    embed.addFields({
      name: "One-time Schedule",
      value: scheduleValue.join("\n"),
      inline: false,
    });
  }

  // Reason if provided
  if (schedule.reason && schedule.reason !== "No reason provided") {
    embed.addFields({
      name: "Reason",
      value: schedule.reason,
      inline: false,
    });
  }

  // Metadata
  embed.addFields({
    name: "Metadata",
    value: `**Created by:** <@${schedule.createdBy}>\n**Created:** <t:${Math.floor(new Date(schedule.createdAt).getTime() / 1000)}:R>`,
    inline: false,
  });

  // Add users list if not too many
  if (userIds.length <= 10 && userIds.length > 0) {
    const usersMentions = userIds.map(id => `<@${id}>`).join(", ");
    embed.addFields({
      name: "Target Users",
      value: usersMentions,
      inline: false,
    });
  }

  return embed;
}
