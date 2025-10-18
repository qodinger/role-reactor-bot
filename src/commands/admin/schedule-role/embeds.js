import { EmbedBuilder } from "discord.js";
import { THEME_COLOR, EMOJIS } from "../../../config/theme.js";
import {
  formatDateTime,
  formatDisplayId,
  formatStatus,
  formatRecurringScheduleDetails,
  formatTimeRemaining,
} from "./utils.js";

// ============================================================================
// SCHEDULE CREATION EMBEDS
// ============================================================================

export function createOneTimeScheduleEmbed(result, options) {
  return new EmbedBuilder()
    .setTitle("⏰ One-Time Role Schedule Created")
    .setDescription(
      `Role **${options.role.name}** has been scheduled for assignment.`,
    )
    .setColor(THEME_COLOR)
    .addFields(
      {
        name: "📅 Schedule Time",
        value: formatDateTime(new Date(result.scheduleTime)),
        inline: true,
      },
      {
        name: "⏱️ Duration",
        value: options.duration,
        inline: true,
      },
      {
        name: "👥 Users",
        value: `${options.users.split(",").length} user(s)`,
        inline: true,
      },
      {
        name: "🎯 Role",
        value: options.role.name,
        inline: true,
      },
      {
        name: "📝 Reason",
        value: options.reason,
        inline: true,
      },
      {
        name: "🆔 Schedule ID",
        value: `\`${formatDisplayId(result.scheduleId)}\``,
        inline: true,
      },
    )
    .setTimestamp();
}

export function createRecurringScheduleEmbed(result, options, parsedSchedule) {
  return new EmbedBuilder()
    .setTitle("🔄 Recurring Role Schedule Created")
    .setDescription(
      `Recurring schedule for **${options.role.name}** has been created successfully.`,
    )
    .setColor(THEME_COLOR)
    .addFields(
      {
        name: "📅 Schedule Type",
        value: formatScheduleType(options.type),
        inline: true,
      },
      {
        name: "⏰ Schedule Details",
        value: formatScheduleDetails(parsedSchedule, options.type),
        inline: true,
      },
      {
        name: "⏱️ Duration",
        value: options.duration,
        inline: true,
      },
      {
        name: "👥 Users",
        value: `${options.users.split(",").length} user(s)`,
        inline: true,
      },
      {
        name: "🎯 Role",
        value: options.role.name,
        inline: true,
      },
      {
        name: "📝 Reason",
        value: options.reason,
        inline: true,
      },
      {
        name: "🆔 Schedule ID",
        value: `\`${formatDisplayId(result.scheduleId)}\``,
        inline: true,
      },
    )
    .setTimestamp();
}

// ============================================================================
// LIST EMBEDS
// ============================================================================

export function createScheduledRolesEmbed(scheduledRoles, guild) {
  const now = new Date();
  const sortedRoles = scheduledRoles.sort(
    (a, b) => new Date(a.scheduleTime) - new Date(b.scheduleTime),
  );

  const embed = new EmbedBuilder()
    .setTitle("⏰ Scheduled Roles")
    .setColor(THEME_COLOR)
    .setTimestamp();

  if (sortedRoles.length === 0) {
    embed.setDescription("No active scheduled roles found.");
    return embed;
  }

  const roleList = sortedRoles
    .map(role => formatScheduledRoleEntry(role, guild, now))
    .join("\n\n");

  embed.setDescription(roleList);
  return embed;
}

export function createRecurringSchedulesEmbed(recurringSchedules, guild) {
  const embed = new EmbedBuilder()
    .setTitle("🔄 Recurring Schedules")
    .setColor(THEME_COLOR)
    .setTimestamp();

  if (recurringSchedules.length === 0) {
    embed.setDescription("No active recurring schedules found.");
    return embed;
  }

  const scheduleList = recurringSchedules
    .map(schedule => formatRecurringScheduleEntry(schedule, guild))
    .join("\n\n");

  embed.setDescription(scheduleList);
  return embed;
}

// ============================================================================
// DETAIL EMBED
// ============================================================================

export function createScheduleDetailEmbed(schedule, guild) {
  const roleObj = guild.roles.cache.get(schedule.roleId);
  const roleName = roleObj ? roleObj.name : "Unknown Role";
  const roleColor = roleObj ? roleObj.hexColor : "#5865F2";

  // Create a beautiful embed with better formatting
  const embed = new EmbedBuilder()
    .setTitle(`✨ Schedule Details: ${roleName} Role`)
    .setDescription(`📊 **Comprehensive information about your role schedule**`)
    .setColor(roleColor)
    .setTimestamp()
    .setFooter({
      text: `Schedule ID: ${formatDisplayId(schedule.scheduleId)}`,
      iconURL: guild.iconURL({ dynamic: true, size: 32 }),
    });

  // Basic Information with better formatting
  const basicFields = [
    {
      name: "🆔 **Schedule ID**",
      value: `\`${formatDisplayId(schedule.scheduleId)}\``,
      inline: true,
    },
    {
      name: "📊 **Status**",
      value: formatStatus(schedule.status, schedule.scheduleTime),
      inline: true,
    },
    {
      name: "👥 **Users**",
      value: `**${schedule.userIds.length}** user(s) affected`,
      inline: true,
    },
  ];

  // Schedule Type and Details with better formatting
  let scheduleDetails = "";
  let scheduleIcon = "";

  if (schedule.type === "scheduled") {
    // One-time scheduled role
    const scheduleTime = new Date(schedule.scheduleTime);
    scheduleIcon = EMOJIS.TIME.CALENDAR;
    scheduleDetails = `**One-Time Schedule**\n${EMOJIS.TIME.ALARM} **Assignment Time:** ${formatDateTime(scheduleTime)}`;
  } else {
    // Recurring schedule
    scheduleIcon = EMOJIS.ACTIONS.REFRESH;
    scheduleDetails = `**Recurring Schedule**\n${EMOJIS.TIME.ALARM} **Frequency:** ${formatRecurringScheduleDetails(schedule)}`;
  }

  const scheduleFields = [
    {
      name: `${scheduleIcon} **Schedule Information**`,
      value: scheduleDetails,
      inline: false,
    },
    {
      name: "⏱️ **Duration**",
      value: `**${schedule.duration}** per assignment`,
      inline: true,
    },
    {
      name: "📝 **Reason**",
      value: schedule.reason || "*No reason provided*",
      inline: true,
    },
  ];

  // Timing Information with better formatting
  const timingFields = [];

  if (schedule.createdAt) {
    const createdDate = new Date(schedule.createdAt);
    const timeAgo = formatTimeRemaining(createdDate);
    timingFields.push({
      name: "📅 **Created**",
      value: `${formatDateTime(createdDate)}\n⏰ *${timeAgo}*`,
      inline: true,
    });
  }

  if (schedule.lastRun) {
    const lastRunDate = new Date(schedule.lastRun);
    const timeSince = formatTimeRemaining(lastRunDate);
    timingFields.push({
      name: "🔄 **Last Run**",
      value: `${formatDateTime(lastRunDate)}\n⏰ *${timeSince}*`,
      inline: true,
    });
  }

  if (schedule.nextRun) {
    const nextRun = new Date(schedule.nextRun);
    const now = new Date();
    const timeUntil =
      nextRun > now ? `in ${formatTimeRemaining(nextRun)}` : "**Overdue**";
    const statusIcon =
      nextRun > now ? EMOJIS.TIME.ALARM : EMOJIS.STATUS.WARNING;
    timingFields.push({
      name: `${statusIcon} **Next Run**`,
      value: `${formatDateTime(nextRun)}\n${EMOJIS.TIME.ALARM} *${timeUntil}*`,
      inline: true,
    });
  }

  // Add all fields with beautiful separators
  embed.addFields(basicFields);

  // Add a separator field
  embed.addFields({
    name: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    value: "**Schedule Configuration**",
    inline: false,
  });

  embed.addFields(scheduleFields);

  if (timingFields.length > 0) {
    // Add another separator
    embed.addFields({
      name: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      value: "**Execution Timeline**",
      inline: false,
    });

    embed.addFields(timingFields);
  }

  // Add user details if there are users
  if (schedule.userIds && schedule.userIds.length > 0) {
    const userDetails = schedule.userIds
      .map((userId, index) => {
        const member = guild.members.cache.get(userId);
        const userInfo = member
          ? `${member.user.username}#${member.user.discriminator}`
          : `User ${userId}`;
        return `**${index + 1}.** ${userInfo}`;
      })
      .join("\n");

    embed.addFields({
      name: "👤 **User Details**",
      value: userDetails,
      inline: false,
    });
  }

  return embed;
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

function formatScheduledRoleEntry(role, guild, now) {
  const roleObj = guild.roles.cache.get(role.roleId);
  const roleName = roleObj ? roleObj.name : "Unknown Role";
  const scheduleTime = new Date(role.scheduleTime);
  const timeUntil =
    scheduleTime > now
      ? `in ${formatTimeRemaining(scheduleTime)}`
      : formatTimeRemaining(scheduleTime);

  const statusInfo = formatStatus(role.status, role.scheduleTime);
  let debugInfo = "";

  if (role.status === "active") {
    const timeDiff = now - scheduleTime;
    debugInfo = `\n⚠️ **Debug**: Schedule time: ${scheduleTime.toLocaleString()}, Time since: ${Math.round(timeDiff / 1000)}s ago`;
  }

  return (
    `**${roleName}** - ${timeUntil}\n` +
    `👥 ${role.userIds.length} user(s) • ⏱️ ${role.duration} • 📝 ${role.reason || "No reason"}\n` +
    `📊 **Status:** ${statusInfo}${debugInfo}\n` +
    `🆔 \`${formatDisplayId(role.scheduleId)}\``
  );
}

function formatRecurringScheduleEntry(schedule, guild) {
  const roleObj = guild.roles.cache.get(schedule.roleId);
  const roleName = roleObj ? roleObj.name : "Unknown Role";
  const scheduleDetails = formatRecurringScheduleDetails(schedule);

  return (
    `**${roleName}** - ${scheduleDetails}\n` +
    `👥 ${schedule.userIds.length} user(s) • ⏱️ ${schedule.duration} • 📝 ${schedule.reason || "No reason"}\n` +
    `📊 **Status:** ${formatStatus(schedule.status)}\n` +
    `🆔 \`${formatDisplayId(schedule.scheduleId)}\``
  );
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

/**
 * Creates an embed for schedule update confirmation
 * @param {Object} data - Update result data
 * @param {Object} updateOptions - Fields that were updated
 * @param {Object} guild - Discord guild object
 * @returns {EmbedBuilder}
 */
export function createScheduleUpdateEmbed(data, updateOptions, guild) {
  const { original, updated, changes } = data;
  const embed = new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.STATUS.SUCCESS} Schedule Updated Successfully`)
    .setDescription(
      `Schedule \`${original.scheduleId.substring(0, 8)}...\` has been updated.`,
    )
    .setTimestamp();

  // Add fields showing what was changed
  const changesList = [];

  if (changes.schedule) {
    const oldTime =
      original.type === "one-time"
        ? formatScheduleTime(original.scheduleTime)
        : formatRecurringSchedule(original.schedule);
    const newTime =
      original.type === "one-time"
        ? formatScheduleTime(updated.scheduleTime)
        : formatRecurringSchedule(updated.schedule);
    changesList.push(`**Schedule**: \`${oldTime}\` → \`${newTime}\``);
  }

  if (changes.duration) {
    changesList.push(
      `**Duration**: \`${original.duration}\` → \`${updated.duration}\``,
    );
  }

  if (changes.users) {
    const oldUsers = original.userIds.length;
    const newUsers = updated.userIds.length;
    changesList.push(
      `**Users**: \`${oldUsers} users\` → \`${newUsers} users\``,
    );
  }

  if (changes.role) {
    const oldRole =
      guild.roles.cache.get(original.roleId)?.name || "Unknown Role";
    const newRole =
      guild.roles.cache.get(updated.roleId)?.name || "Unknown Role";
    changesList.push(`**Role**: \`${oldRole}\` → \`${newRole}\``);
  }

  if (changes.reason !== null) {
    const oldReason = original.reason || "No reason";
    const newReason = updated.reason || "No reason";
    changesList.push(`**Reason**: \`${oldReason}\` → \`${newReason}\``);
  }

  if (changesList.length > 0) {
    embed.addFields({
      name: "📝 Changes Made",
      value: changesList.join("\n"),
      inline: false,
    });
  }

  // Add updated schedule details
  const scheduleDetails = [];
  scheduleDetails.push(`**Type**: ${formatScheduleType(updated.type)}`);
  scheduleDetails.push(`**Duration**: ${updated.duration}`);
  scheduleDetails.push(`**Users**: ${updated.userIds.length} user(s)`);
  scheduleDetails.push(
    `**Role**: ${guild.roles.cache.get(updated.roleId)?.name || "Unknown Role"}`,
  );

  if (updated.reason) {
    scheduleDetails.push(`**Reason**: ${updated.reason}`);
  }

  embed.addFields({
    name: "📋 Updated Schedule Details",
    value: scheduleDetails.join("\n"),
    inline: false,
  });

  // Add next run time for recurring schedules
  if (updated.type !== "one-time" && updated.nextRun) {
    embed.addFields({
      name: "⏰ Next Run",
      value: `<t:${Math.floor(new Date(updated.nextRun).getTime() / 1000)}:F>`,
      inline: true,
    });
  } else if (updated.type === "one-time") {
    embed.addFields({
      name: "⏰ Scheduled Time",
      value: `<t:${Math.floor(new Date(updated.scheduleTime).getTime() / 1000)}:F>`,
      inline: true,
    });
  }

  embed.setFooter({
    text: `Updated by ${guild.members.cache.get(updated.updatedBy)?.displayName || "Unknown User"}`,
    iconURL: guild.members.cache
      .get(updated.updatedBy)
      ?.user.displayAvatarURL(),
  });

  return embed;
}

/**
 * Creates an embed for bulk schedule cancellation confirmation
 * @param {Object} data - Bulk cancellation result data
 * @param {Object} guild - Discord guild object
 * @returns {EmbedBuilder}
 */
export function createBulkCancelEmbed(data, guild) {
  const { results, summary, reason, cancelledBy } = data;
  const embed = new EmbedBuilder()
    .setColor(summary.failed > 0 ? THEME.WARNING : THEME.SUCCESS)
    .setTitle(`${EMOJIS.STATUS.SUCCESS} Bulk Cancellation Completed`)
    .setDescription(`Processed ${summary.total} schedule(s) for cancellation.`)
    .setTimestamp();

  // Add summary
  const summaryText = [];
  if (summary.successful > 0) {
    summaryText.push(`✅ **Successful**: ${summary.successful}`);
  }
  if (summary.failed > 0) {
    summaryText.push(`❌ **Failed**: ${summary.failed}`);
  }
  if (summary.notFound > 0) {
    summaryText.push(`🔍 **Not Found**: ${summary.notFound}`);
  }

  embed.addFields({
    name: "📊 Summary",
    value: summaryText.join("\n"),
    inline: false,
  });

  // Add successful cancellations
  if (results.successful.length > 0) {
    const successfulList = results.successful
      .map(item => `• \`${item.scheduleId.substring(0, 8)}...\``)
      .join("\n");

    embed.addFields({
      name: "✅ Successfully Cancelled",
      value:
        successfulList.length > 1000
          ? successfulList.substring(0, 1000) + "..."
          : successfulList,
      inline: false,
    });
  }

  // Add failed cancellations
  if (results.failed.length > 0) {
    const failedList = results.failed
      .map(
        item => `• \`${item.scheduleId.substring(0, 8)}...\` - ${item.error}`,
      )
      .join("\n");

    embed.addFields({
      name: "❌ Failed to Cancel",
      value:
        failedList.length > 1000
          ? failedList.substring(0, 1000) + "..."
          : failedList,
      inline: false,
    });
  }

  // Add not found schedules
  if (results.notFound.length > 0) {
    const notFoundList = results.notFound
      .map(id => `• \`${id.substring(0, 8)}...\``)
      .join("\n");

    embed.addFields({
      name: "🔍 Not Found",
      value:
        notFoundList.length > 1000
          ? notFoundList.substring(0, 1000) + "..."
          : notFoundList,
      inline: false,
    });
  }

  // Add reason if provided
  if (reason && reason !== "Bulk cancellation") {
    embed.addFields({
      name: "📝 Reason",
      value: reason,
      inline: false,
    });
  }

  embed.setFooter({
    text: `Cancelled by ${guild.members.cache.get(cancelledBy)?.displayName || "Unknown User"}`,
    iconURL: guild.members.cache.get(cancelledBy)?.user.displayAvatarURL(),
  });

  return embed;
}
