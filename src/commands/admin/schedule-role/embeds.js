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
  const actionEmoji = scheduleData.action === "assign" ? "➕" : "➖";
  const userCount = totalUserCount !== null ? totalUserCount : users.length;
  let userDisplay;
  if (isMixed && targetRoles && targetRoles.length > 0) {
    // Mixed: users + roles
    const roleNames =
      targetRoles.length === 1
        ? targetRoles[0].name
        : targetRoles.map(r => r.name).join(", ");
    userDisplay = `Users + Members with role${targetRoles.length > 1 ? "s" : ""}: ${roleNames}`;
  } else if (targetRoles && targetRoles.length > 0) {
    // Multiple roles or single role
    if (targetRoles.length === 1) {
      userDisplay = `Members with role ${targetRoles[0].name}`;
    } else {
      const roleNames = targetRoles.map(r => r.name).join(", ");
      userDisplay = `Members with roles: ${roleNames}`;
    }
  } else if (targetRole) {
    // Backward compatibility
    userDisplay = `Members with role ${targetRole.name}`;
  } else if (isAllMembers) {
    userDisplay = "All server members";
  } else {
    userDisplay = `${userCount} user${userCount !== 1 ? "s" : ""}`;
  }

  // Ensure role and description are valid
  const roleName = role?.name || "Unknown Role";
  const descriptionText = `Successfully created a ${isRecurring ? "recurring" : "one-time"} schedule to ${action.toLowerCase()} the **${roleName}** role`;

  // Ensure description is always a non-empty string (Discord requirement)
  // CRITICAL: Description is required by Discord API - must never be empty or undefined
  let safeDescription = descriptionText || "";
  if (
    typeof safeDescription !== "string" ||
    safeDescription.trim().length === 0
  ) {
    safeDescription = "Schedule created successfully";
  } else {
    safeDescription = safeDescription.trim();
  }

  // Build embed - description MUST be set before any other operations
  const embed = new EmbedBuilder()
    .setTitle("Scheduled Role Assignment")
    .setColor(THEME.PRIMARY);

  // Set description explicitly - this is required by Discord
  embed.setDescription(safeDescription);

  // Continue building embed
  embed
    .setThumbnail(role?.iconURL() || null)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Scheduled Roles",
      iconURL: client.user?.displayAvatarURL() || undefined,
    });

  // Validate description was set correctly
  const testJson = embed.toJSON();
  if (!testJson.description || testJson.description.trim().length === 0) {
    // If somehow description is missing, force it
    embed.setDescription("Schedule created successfully");
  }

  // Schedule details
  embed.addFields([
    {
      name: "Schedule Information",
      value: [
        `**Type:** ${isRecurring ? "Recurring" : "One-time"}`,
        `**Action:** ${actionEmoji} ${action}`,
        `**Schedule:** ${isRecurring ? formatRecurringSchedule(scheduleData.scheduleConfig) : formatScheduleTime(scheduleData.scheduledAt)}`,
        `**Schedule ID:** \`${scheduleData.id}\``,
      ].join("\n"),
      inline: true,
    },
    {
      name: "Role & Target",
      value: [
        `**Role:** ${roleName}`,
        `**Target:** ${userDisplay}${isAllMembers || targetRole || (targetRoles && targetRoles.length > 0) ? ` (${userCount} total)` : ""}`,
        isMixed && targetRoles && targetRoles.length > 0
          ? `**Mixed Targeting:** Users + Role${targetRoles.length > 1 ? "s" : ""} (${targetRoles.map(r => r.name).join(", ")})`
          : targetRoles && targetRoles.length > 0
            ? targetRoles.length === 1
              ? `**Filter Role:** ${targetRoles[0].name}`
              : `**Filter Roles:** ${targetRoles.map(r => r.name).join(", ")}`
            : targetRole
              ? `**Filter Role:** ${targetRole.name}`
              : "",
        `**Reason:** ${scheduleData.reason || "No reason provided"}`,
      ]
        .filter(Boolean)
        .join("\n"),
      inline: true,
    },
  ]);

  // Show next execution time for recurring schedules
  if (isRecurring && scheduleData.scheduleConfig) {
    const nextExecution = getNextExecutionTime(
      scheduleData.scheduleConfig,
      scheduleType,
    );
    if (nextExecution) {
      embed.addFields({
        name: "Next Execution",
        value: `<t:${Math.floor(nextExecution.getTime() / 1000)}:F> (<t:${Math.floor(nextExecution.getTime() / 1000)}:R>)`,
        inline: false,
      });
    }
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
) {
  const embed = new EmbedBuilder()
    .setTitle("Scheduled Roles")
    .setDescription(
      `**${totalSchedules}** active scheduled role${totalSchedules !== 1 ? "s" : ""} in this server`,
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: `Role Reactor • Page ${currentPage} of ${totalPages || 1}`,
      iconURL: client.user.displayAvatarURL(),
    });

  if (schedules.length === 0) {
    embed.addFields({
      name: "No Active Schedules",
      value:
        "No scheduled roles found. Use `/schedule-role create` to create one!",
      inline: false,
    });
  } else {
    // Group schedules by type
    for (const schedule of schedules) {
      const scheduleType =
        schedule.type ||
        (schedule.active !== undefined ? "recurring" : "one-time");
      const isRecurring = scheduleType === "recurring";
      const action = schedule.action === "assign" ? "➕ Assign" : "➖ Remove";
      const status = isRecurring
        ? schedule.active && !schedule.cancelled
          ? "🟢 Active"
          : "🔴 Inactive"
        : schedule.executed
          ? "✅ Executed"
          : schedule.cancelled
            ? "❌ Cancelled"
            : "⏳ Pending";

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

      embed.addFields({
        name: `${action} ${scheduleType === "recurring" ? "• Recurring" : "• One-time"}`,
        value: [
          `**ID:** \`${schedule.id.substring(0, 8)}\``,
          `**Status:** ${status}`,
          `**Users:** ${usersCount} user${usersCount !== 1 ? "s" : ""}`,
          `**Schedule:** ${scheduleText}`,
          isRecurring && schedule.lastExecutedAt
            ? `**Last executed:** <t:${Math.floor(new Date(schedule.lastExecutedAt).getTime() / 1000)}:R>`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        inline: true,
      });
    }
  }

  return embed;
}

/**
 * Create the schedule view embed
 */
export function createScheduleViewEmbed(schedule, scheduleType, guild, client) {
  const isRecurring = scheduleType === "recurring";
  const action = schedule.action === "assign" ? "Assign" : "Remove";
  const actionEmoji = schedule.action === "assign" ? "➕" : "➖";
  const status = isRecurring
    ? schedule.active && !schedule.cancelled
      ? "🟢 Active"
      : "🔴 Inactive"
    : schedule.executed
      ? "✅ Executed"
      : schedule.cancelled
        ? "❌ Cancelled"
        : "⏳ Pending";

  // Get role info
  const role = guild.roles.cache.get(schedule.roleId);
  const roleMention = role ? role.toString() : `\`${schedule.roleId}\``;

  // Get users info
  const userIds = Array.isArray(schedule.userIds)
    ? schedule.userIds
    : [schedule.userId].filter(Boolean);
  const usersMentions = userIds.map(id => `<@${id}>`).join(", ");

  const embed = new EmbedBuilder()
    .setTitle("Schedule Details")
    .setDescription(
      `Viewing details for schedule **${schedule.id.substring(0, 8)}**`,
    )
    .setColor(THEME.PRIMARY)
    .setThumbnail(role ? role.iconURL() : null)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Scheduled Roles",
      iconURL: client.user.displayAvatarURL(),
    });

  embed.addFields([
    {
      name: "Schedule Information",
      value: [
        `**ID:** \`${schedule.id}\``,
        `**Type:** ${isRecurring ? "Recurring" : "One-time"}`,
        `**Action:** ${actionEmoji} ${action}`,
        `**Status:** ${status}`,
      ].join("\n"),
      inline: true,
    },
    {
      name: "Role & Users",
      value: [
        `**Role:** ${roleMention}`,
        `**Users:** ${userIds.length} user${userIds.length !== 1 ? "s" : ""}`,
        `**Reason:** ${schedule.reason || "No reason provided"}`,
      ].join("\n"),
      inline: true,
    },
  ]);

  // Add schedule-specific fields
  if (isRecurring) {
    const scheduleText = formatRecurringSchedule(
      schedule.scheduleConfig || schedule,
    );
    const nextExecution = getNextExecutionTime(
      schedule.scheduleConfig || schedule,
      scheduleType,
    );

    embed.addFields({
      name: "Recurring Schedule",
      value: [
        `**Schedule:** ${scheduleText}`,
        schedule.lastExecutedAt
          ? `**Last executed:** <t:${Math.floor(new Date(schedule.lastExecutedAt).getTime() / 1000)}:F> (<t:${Math.floor(new Date(schedule.lastExecutedAt).getTime() / 1000)}:R>)`
          : "**Last executed:** Never",
        nextExecution
          ? `**Next execution:** <t:${Math.floor(nextExecution.getTime() / 1000)}:F> (<t:${Math.floor(nextExecution.getTime() / 1000)}:R>)`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      inline: false,
    });
  } else {
    embed.addFields({
      name: "One-time Schedule",
      value: [
        `**Scheduled for:** <t:${Math.floor(new Date(schedule.scheduledAt).getTime() / 1000)}:F>`,
        `**Time until execution:** <t:${Math.floor(new Date(schedule.scheduledAt).getTime() / 1000)}:R>`,
        schedule.executedAt
          ? `**Executed at:** <t:${Math.floor(new Date(schedule.executedAt).getTime() / 1000)}:F>`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      inline: false,
    });
  }

  // Add metadata
  embed.addFields({
    name: "Metadata",
    value: [
      `**Created by:** <@${schedule.createdBy}>`,
      `**Created at:** <t:${Math.floor(new Date(schedule.createdAt).getTime() / 1000)}:F>`,
      schedule.updatedAt
        ? `**Updated at:** <t:${Math.floor(new Date(schedule.updatedAt).getTime() / 1000)}:F>`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    inline: false,
  });

  // Add users list if not too many
  if (userIds.length <= 10) {
    embed.addFields({
      name: "Target Users",
      value: usersMentions || "No users specified",
      inline: false,
    });
  }

  return embed;
}
