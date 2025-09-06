import { EmbedBuilder } from "discord.js";
import { THEME_COLOR } from "../../../config/theme.js";
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
    scheduleIcon = "📅";
    scheduleDetails = `**One-Time Schedule**\n⏰ **Assignment Time:** ${formatDateTime(scheduleTime)}`;
  } else {
    // Recurring schedule
    scheduleIcon = "🔄";
    scheduleDetails = `**Recurring Schedule**\n⏰ **Frequency:** ${formatRecurringScheduleDetails(schedule)}`;
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
    const statusIcon = nextRun > now ? "⏰" : "⚠️";
    timingFields.push({
      name: `${statusIcon} **Next Run**`,
      value: `${formatDateTime(nextRun)}\n⏰ *${timeUntil}*`,
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
