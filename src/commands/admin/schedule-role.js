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
  scheduleTemporaryRole,
  createRecurringRoleSchedule,
  getScheduledRoles,
  getRecurringSchedules,
} from "../../utils/discord/enhancedTemporaryRoles.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";
import {
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

export const data = new SlashCommandBuilder()
  .setName("schedule-role")
  .setDescription("Schedule a role assignment")
  .addSubcommand(subcommand =>
    subcommand
      .setName("create")
      .setDescription("Create a new role schedule")
      .addStringOption(option =>
        option
          .setName("users")
          .setDescription("Comma-separated list of user IDs or mentions")
          .setRequired(true),
      )
      .addRoleOption(option =>
        option
          .setName("role")
          .setDescription("The role to assign")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("type")
          .setDescription("Type of schedule")
          .setRequired(true)
          .addChoices(
            { name: "One Time", value: "one-time" },
            { name: "Daily", value: "daily" },
            { name: "Weekly", value: "weekly" },
            { name: "Monthly", value: "monthly" },
            { name: "Custom Interval", value: "custom" },
          ),
      )
      .addStringOption(option =>
        option
          .setName("schedule")
          .setDescription(
            "When to assign: 'tomorrow 9am', '9am', 'monday 6pm', '15 2pm', '120'",
          )
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("duration")
          .setDescription("How long the role should last (e.g., 1h, 2d, 1w)")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for the role assignment")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("list")
      .setDescription("List all scheduled and recurring roles"),
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
      case "create":
        await handleScheduleRole(interaction);
        break;
      case "list":
        await handleList(interaction);
        break;
      default:
        await interaction.editReply({
          ...errorEmbed({
            title: "Invalid Subcommand",
            description:
              "Please use 'create' to schedule a role or 'list' to view schedules.",
          }),
        });
    }
  } catch (error) {
    logger.error("Error in schedule-role command:", error);

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

async function handleScheduleRole(interaction) {
  const { guild } = interaction;
  const logger = getLogger();

  // Debug logging
  logger.debug("Options received:", {
    users: interaction.options.getString("users"),
    role: interaction.options.getRole("role"),
    type: interaction.options.getString("type"),
    schedule: interaction.options.getString("schedule"),
    duration: interaction.options.getString("duration"),
    reason: interaction.options.getString("reason"),
  });

  const usersInput = interaction.options.getString("users");
  const role = interaction.options.getRole("role");
  const scheduleType = interaction.options.getString("type");
  const scheduleDetails = interaction.options.getString("schedule");
  const duration = interaction.options.getString("duration");
  const reason =
    interaction.options.getString("reason") || "Scheduled role assignment";

  // Validate role
  if (!role) {
    return await interaction.editReply({
      ...errorEmbed({
        title: "Invalid Role",
        description: "Please select a valid role to assign.",
      }),
    });
  }

  if (role.managed || (role.tags && role.tags.botId)) {
    return await interaction.editReply({
      ...errorEmbed({
        title: "Invalid Role",
        description:
          "Cannot assign managed roles or bot roles as temporary roles.",
      }),
    });
  }

  // Parse users
  const userIds = usersInput
    .split(",")
    .map(user => user.trim())
    .filter(user => user.length > 0)
    .map(user => {
      const match = user.match(/<@!?(\d+)>/);
      return match ? match[1] : user;
    });

  if (userIds.length === 0) {
    return await interaction.editReply({
      ...errorEmbed({
        title: "Invalid Users",
        description: "Please provide valid user mentions or IDs.",
      }),
    });
  }

  try {
    let result;
    let embed;

    if (scheduleType === "one-time") {
      // Handle one-time scheduled role
      const scheduleTime = parseOneTimeSchedule(scheduleDetails);
      if (!scheduleTime) {
        return await interaction.editReply({
          ...errorEmbed({
            title: "Invalid Schedule",
            description:
              "**Supported formats:**\n" +
              "• **Relative:** 'in 5 minutes', 'in 2 hours', 'in 1 day'\n" +
              "• **Today/Tomorrow:** 'today 2pm', 'tomorrow 9am', 'tonight 7pm'\n" +
              "• **Day names:** 'monday 2pm', 'friday 9am'\n" +
              "• **Time periods:** 'morning', 'afternoon', 'evening', 'midnight', 'noon'\n" +
              "• **Next:** 'next monday', 'next week', 'next month'\n" +
              "• **Absolute:** '2024-01-15 14:30', '15 Jan 2024 2:30pm'\n" +
              "• **24-hour:** '14:04', '14:04:30'\n" +
              "• **Immediate:** 'now', 'asap', 'immediately'",
          }),
        });
      }

      result = await scheduleTemporaryRole(
        guild.id,
        userIds,
        role.id,
        scheduleTime,
        duration,
        reason,
        interaction.user.id,
      );

      if (!result) {
        return await interaction.editReply({
          ...errorEmbed({
            title: "Creation Failed",
            description:
              "Failed to create the scheduled role. Please try again.",
          }),
        });
      }

      embed = new EmbedBuilder()
        .setTitle("⏰ One-Time Role Schedule Created")
        .setDescription(
          `Role **${role.name}** has been scheduled for assignment.`,
        )
        .setColor(THEME_COLOR)
        .addFields(
          {
            name: "📅 Schedule Time",
            value: formatDateTime(scheduleTime),
            inline: true,
          },
          {
            name: "⏱️ Duration",
            value: duration,
            inline: true,
          },
          {
            name: "👥 Users",
            value: `${userIds.length} user(s)`,
            inline: true,
          },
          {
            name: "🎯 Role",
            value: role.name,
            inline: true,
          },
          {
            name: "📝 Reason",
            value: reason,
            inline: true,
          },
          {
            name: "🆔 Schedule ID",
            value: `\`${formatDisplayId(result.scheduleId)}\``,
            inline: true,
          },
        )
        .setTimestamp();
    } else {
      // Handle recurring role schedule
      const schedule = parseRecurringSchedule(scheduleType, scheduleDetails);
      if (!schedule) {
        return await interaction.editReply({
          ...errorEmbed({
            title: "Invalid Schedule Details",
            description: getScheduleHelpText(scheduleType),
          }),
        });
      }

      result = await createRecurringRoleSchedule(
        guild.id,
        userIds,
        role.id,
        schedule,
        duration,
        reason,
        interaction.user.id,
      );

      if (!result) {
        return await interaction.editReply({
          ...errorEmbed({
            title: "Creation Failed",
            description:
              "Failed to create the recurring schedule. Please try again.",
          }),
        });
      }

      embed = new EmbedBuilder()
        .setTitle("🔄 Recurring Role Schedule Created")
        .setDescription(
          `Recurring schedule for **${role.name}** has been created successfully.`,
        )
        .setColor(THEME_COLOR)
        .addFields(
          {
            name: "📅 Schedule Type",
            value: formatScheduleType(scheduleType),
            inline: true,
          },
          {
            name: "⏰ Schedule Details",
            value: formatScheduleDetails(schedule, scheduleType),
            inline: true,
          },
          {
            name: "⏱️ Duration",
            value: duration,
            inline: true,
          },
          {
            name: "👥 Users",
            value: `${userIds.length} user(s)`,
            inline: true,
          },
          {
            name: "🎯 Role",
            value: role.name,
            inline: true,
          },
          {
            name: "📝 Reason",
            value: reason,
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

    await interaction.editReply({
      embeds: [embed],
      ephemeral: false,
    });
  } catch (error) {
    const logger = getLogger();
    logger.error("Error creating schedule:", error);
    await interaction.editReply({
      ...errorEmbed({
        title: "Creation Failed",
        description:
          "An error occurred while creating the schedule. Please try again.",
      }),
    });
  }
}

// Helper functions
function parseOneTimeSchedule(scheduleInput) {
  try {
    const input = scheduleInput.toLowerCase().trim();

    // Handle relative time formats
    if (input.startsWith("in ")) {
      const timeStr = input.substring(3);
      return parseRelativeTime(timeStr);
    }

    // Handle "now", "immediately", "asap"
    if (["now", "immediately", "asap", "right now"].includes(input)) {
      return new Date();
    }

    // Handle "today" with various time formats
    if (input.startsWith("today ")) {
      const timeStr = input.substring(6);
      return parseTimeOnDate(timeStr, new Date());
    }

    // Handle "tomorrow" with various time formats
    if (input.startsWith("tomorrow ")) {
      const timeStr = input.substring(9);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return parseTimeOnDate(timeStr, tomorrow);
    }

    // Handle "next" formats
    if (input.startsWith("next ")) {
      return parseNextFormat(input.substring(5));
    }

    // Handle day names (e.g., "monday 2pm", "friday 9am")
    const dayMatch = input.match(
      /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(.+)$/i,
    );
    if (dayMatch) {
      const dayName = dayMatch[1];
      const timeStr = dayMatch[2];
      return parseDayAndTime(dayName, timeStr);
    }

    // Handle "tonight" (6pm to 11pm)
    if (input.startsWith("tonight ")) {
      const timeStr = input.substring(8);
      const tonight = new Date();
      // Default to 6pm if no time specified
      if (!timeStr.trim()) {
        tonight.setHours(18, 0, 0, 0);
        return tonight;
      }
      return parseTimeOnDate(timeStr, tonight);
    }

    // Handle "morning" (6am to 11am)
    if (input.startsWith("morning ")) {
      const timeStr = input.substring(8);
      const morning = new Date();
      // Default to 9am if no time specified
      if (!timeStr.trim()) {
        morning.setHours(9, 0, 0, 0);
        return morning;
      }
      return parseTimeOnDate(timeStr, morning);
    }

    // Handle "afternoon" (12pm to 5pm)
    if (input.startsWith("afternoon ")) {
      const timeStr = input.substring(10);
      const afternoon = new Date();
      // Default to 2pm if no time specified
      if (!timeStr.trim()) {
        afternoon.setHours(14, 0, 0, 0);
        return afternoon;
      }
      return parseTimeOnDate(timeStr, afternoon);
    }

    // Handle "evening" (6pm to 11pm)
    if (input.startsWith("evening ")) {
      const timeStr = input.substring(8);
      const evening = new Date();
      // Default to 7pm if no time specified
      if (!timeStr.trim()) {
        evening.setHours(19, 0, 0, 0);
        return evening;
      }
      return parseTimeOnDate(timeStr, evening);
    }

    // Handle "midnight" and "noon"
    if (input === "midnight") {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      return midnight;
    }

    if (input === "noon") {
      const noon = new Date();
      noon.setHours(12, 0, 0, 0);
      return noon;
    }

    // Handle absolute date-time with more flexible parsing
    const parsed = parseFlexibleDateTime(input);
    if (parsed) {
      return parsed;
    }

    return null;
  } catch (_error) {
    return null;
  }
}

function parseRelativeTime(timeStr) {
  const now = new Date();
  const match = timeStr.match(/^(\d+)\s*(minute|hour|day|week)s?$/i);

  if (!match) return null;

  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "minute":
      return new Date(now.getTime() + amount * 60 * 1000);
    case "hour":
      return new Date(now.getTime() + amount * 60 * 60 * 1000);
    case "day":
      return new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
    case "week":
      return new Date(now.getTime() + amount * 7 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

function parseTimeOnDate(timeStr, date) {
  // Enhanced time parsing - supports multiple formats
  const timeStrLower = timeStr.toLowerCase().trim();

  // Handle "14:04", "2:04pm", "2pm", "14:04:30" formats
  let timeMatch = timeStrLower.match(
    /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i,
  );

  if (!timeMatch) {
    // Try 24-hour format without AM/PM
    timeMatch = timeStrLower.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const second = timeMatch[3] ? parseInt(timeMatch[3]) : 0;

      // Validate hours
      if (hour >= 0 && hour <= 23) {
        date.setHours(hour, minute, second, 0);
        return date;
      }
    }
    return null;
  }

  let hour = parseInt(timeMatch[1]);
  const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  const second = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
  const period = timeMatch[4] ? timeMatch[4].toLowerCase() : null;

  // Handle AM/PM conversion
  if (period === "pm" && hour !== 12) {
    hour += 12;
  } else if (period === "am" && hour === 12) {
    hour = 0;
  }

  // Validate hours
  if (hour >= 0 && hour <= 23) {
    date.setHours(hour, minute, second, 0);
    return date;
  }

  return null;
}

function parseNextFormat(input) {
  const inputLower = input.toLowerCase().trim();

  // Handle "next monday", "next friday 2pm", etc.
  const dayMatch = inputLower.match(
    /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(.+))?$/i,
  );
  if (dayMatch) {
    const dayName = dayMatch[1];
    const timeStr = dayMatch[2] || "";
    return parseDayAndTime(dayName, timeStr, true); // true = next occurrence
  }

  // Handle "next week", "next month"
  if (inputLower === "week") {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }

  if (inputLower === "month") {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  }

  return null;
}

function parseDayAndTime(dayName, timeStr, nextOccurrence = false) {
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const targetDay = dayNames.indexOf(dayName.toLowerCase());

  if (targetDay === -1) return null;

  const now = new Date();
  const currentDay = now.getDay();
  let daysToAdd = targetDay - currentDay;

  if (nextOccurrence) {
    // For "next monday", always go to next occurrence
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
  } else {
    // For "monday 2pm", go to next occurrence if today is past that time
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
  }

  const targetDate = new Date();
  targetDate.setDate(now.getDate() + daysToAdd);

  // If time is specified, parse it; otherwise default to 9am
  if (timeStr.trim()) {
    const parsedTime = parseTimeOnDate(timeStr, targetDate);
    return parsedTime;
  } else {
    targetDate.setHours(9, 0, 0, 0); // Default to 9am
    return targetDate;
  }
}

function parseFlexibleDateTime(input) {
  const inputLower = input.toLowerCase().trim();

  // Handle various date formats
  const patterns = [
    // "2024-01-15 14:30", "2024/01/15 14:30"
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/,
    // "15-01-2024 14:30", "15/01/2024 14:30" (DD-MM-YYYY)
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/,
    // "Jan 15 2024 2:30pm", "15 Jan 2024 14:30"
    /^(\w{3})\s+(\d{1,2})\s+(\d{4})(?:\s+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/,
    // "15 Jan 2024 2:30pm"
    /^(\d{1,2})\s+(\w{3})\s+(\d{4})(?:\s+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/,
  ];

  for (const pattern of patterns) {
    const match = inputLower.match(pattern);
    if (match) {
      try {
        let dateStr;
        if (pattern.source.includes("\\w{3}")) {
          // Handle month names
          const monthNames = [
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
          ];
          if (match[1].length === 3) {
            // "Jan 15 2024" format
            const month = monthNames.indexOf(match[1].toLowerCase());
            const day = parseInt(match[2]);
            const year = parseInt(match[3]);
            dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          } else {
            // "15 Jan 2024" format
            const day = parseInt(match[1]);
            const month = monthNames.indexOf(match[2].toLowerCase());
            const year = parseInt(match[3]);
            dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          }
        } else if (
          pattern.source.includes("\\d{4}") &&
          pattern.source.startsWith("^(\\d{4})")
        ) {
          // "2024-01-15" format
          dateStr = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
        } else {
          // "15-01-2024" format
          dateStr = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
        }

        // Add time if provided
        if (match[4]) {
          const hour = match[4].padStart(2, "0");
          const minute = match[5] ? match[5].padStart(2, "0") : "00";
          const second = match[6] ? match[6].padStart(2, "0") : "00";
          dateStr += `T${hour}:${minute}:${second}`;
        }

        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch (_e) {
        // Continue to next pattern
      }
    }
  }

  // Try native Date parsing as fallback
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

function parseRecurringSchedule(type, details) {
  try {
    switch (type) {
      case "daily":
        return parseDailySchedule(details);
      case "weekly":
        return parseWeeklySchedule(details);
      case "monthly":
        return parseMonthlySchedule(details);
      case "custom":
        return parseCustomSchedule(details);
      default:
        return null;
    }
  } catch (_error) {
    return null;
  }
}

function parseDailySchedule(details) {
  const timeMatch = details.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!timeMatch) return null;

  let hour = parseInt(timeMatch[1]);
  const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  const period = timeMatch[3].toLowerCase();

  if (period === "pm" && hour !== 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  return {
    type: "daily",
    hour,
    minute,
  };
}

function parseWeeklySchedule(details) {
  const dayMatch = details.match(
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
  );
  if (!dayMatch) return null;

  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const dayOfWeek = dayNames.indexOf(dayMatch[1].toLowerCase());
  let hour = parseInt(dayMatch[2]);
  const minute = dayMatch[3] ? parseInt(dayMatch[3]) : 0;
  const period = dayMatch[4].toLowerCase();

  if (period === "pm" && hour !== 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  return {
    type: "weekly",
    dayOfWeek,
    hour,
    minute,
  };
}

function parseMonthlySchedule(details) {
  const monthMatch = details.match(
    /(\d{1,2})\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
  );
  if (!monthMatch) return null;

  const dayOfMonth = parseInt(monthMatch[1]);
  let hour = parseInt(monthMatch[2]);
  const minute = monthMatch[3] ? parseInt(monthMatch[3]) : 0;
  const period = monthMatch[4].toLowerCase();

  if (period === "pm" && hour !== 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  return {
    type: "monthly",
    dayOfMonth,
    hour,
    minute,
  };
}

function parseCustomSchedule(details) {
  const intervalMatch = details.match(/^(\d+)$/);
  if (!intervalMatch) return null;

  const intervalMinutes = parseInt(intervalMatch[1]);
  if (intervalMinutes < 1 || intervalMinutes > 10080) return null; // Max 1 week

  return {
    type: "custom",
    intervalMinutes,
  };
}

function getScheduleHelpText(type) {
  switch (type) {
    case "daily":
      return "For daily schedules, use format: `9am`, `2:30pm`, `14:30`";
    case "weekly":
      return "For weekly schedules, use format: `monday 9am`, `friday 6pm`";
    case "monthly":
      return "For monthly schedules, use format: `15 2pm`, `1 9am` (day of month + time)";
    case "custom":
      return "For custom intervals, use minutes: `60` (1 hour), `1440` (1 day)";
    default:
      return "Invalid schedule type.";
  }
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

function formatDisplayId(id) {
  if (!id || id.length < 16) return id;
  return `${id.substring(0, 8)}...${id.length - 4}`;
}

function formatStatus(status, scheduleTime = null) {
  const now = new Date();

  // Handle different status types with emojis and descriptions
  switch (status?.toLowerCase()) {
    case "pending":
      return "🟡 **Pending** - Waiting to be assigned";

    case "active":
      if (scheduleTime) {
        const expiresAt = new Date(scheduleTime);
        if (expiresAt > now) {
          return "🟢 **Active** - Role is currently assigned";
        } else {
          return "🟠 **Expiring** - Role will be removed soon";
        }
      }
      return "🟢 **Active** - Role is currently assigned";

    case "completed":
      return "✅ **Completed** - Role assignment finished";

    case "failed":
      return "❌ **Failed** - Role assignment failed";

    case "expired":
      return "⏰ **Expired** - Role has been removed";

    case "cancelled":
      return "🚫 **Cancelled** - Schedule was cancelled";

    case "scheduled":
      return "📅 **Scheduled** - Waiting for assignment time";

    default:
      return "❓ **Unknown** - Status unclear";
  }
}

async function handleList(interaction) {
  const logger = getLogger();

  try {
    const guildId = interaction.guild.id;

    // Get scheduled and recurring roles
    const scheduledRoles = await getScheduledRoles(guildId);
    const recurringSchedules = await getRecurringSchedules(guildId);

    // Filter out completed and cancelled schedules
    const activeScheduledRoles = scheduledRoles.filter(
      role => !["completed", "cancelled"].includes(role.status),
    );
    const activeRecurringSchedules = recurringSchedules.filter(
      schedule => !["cancelled"].includes(schedule.status),
    );

    logger.debug(
      `Found ${activeScheduledRoles.length} active scheduled roles and ${activeRecurringSchedules.length} active recurring schedules`,
    );

    if (
      activeScheduledRoles.length === 0 &&
      activeRecurringSchedules.length === 0
    ) {
      return await interaction.editReply({
        ...errorEmbed({
          title: "No Active Schedules",
          description:
            "There are no active scheduled or recurring roles in this server.",
          solution:
            "Use `/schedule-role create` to schedule your first role assignment!",
        }),
      });
    }

    const embeds = [];

    // Create scheduled roles embed
    if (activeScheduledRoles.length > 0) {
      const scheduledEmbed = createScheduledRolesEmbed(
        activeScheduledRoles,
        interaction.guild,
      );
      embeds.push(scheduledEmbed);
    }

    // Create recurring schedules embed
    if (activeRecurringSchedules.length > 0) {
      const recurringEmbed = createRecurringSchedulesEmbed(
        activeRecurringSchedules,
        interaction.guild,
      );
      embeds.push(recurringEmbed);
    }

    await interaction.editReply({
      embeds,
      ephemeral: false,
    });
  } catch (error) {
    logger.error("Error listing schedules:", error);
    await interaction.editReply({
      ...errorEmbed({
        title: "Error Loading Schedules",
        description: "Failed to load the schedule list. Please try again.",
      }),
    });
  }
}

function createScheduledRolesEmbed(scheduledRoles, guild) {
  const now = new Date();

  // Sort by schedule time
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
    .map(role => {
      const roleObj = guild.roles.cache.get(role.roleId);
      const roleName = roleObj ? roleObj.name : "Unknown Role";
      const scheduleTime = new Date(role.scheduleTime);
      const timeUntil =
        scheduleTime > now
          ? `in ${formatTimeRemaining(scheduleTime)}`
          : `${formatTimeRemaining(scheduleTime)} ago`;

      // Format status with emoji and color
      const statusInfo = formatStatus(role.status, role.scheduleTime);

      return (
        `**${roleName}** - ${timeUntil}\n` +
        `👥 ${role.userIds.length} user(s) • ⏱️ ${role.duration} • 📝 ${role.reason || "No reason"}\n` +
        `📊 **Status:** ${statusInfo}\n` +
        `🆔 \`${formatDisplayId(role.scheduleId)}\``
      );
    })
    .join("\n\n");

  embed.setDescription(roleList);
  return embed;
}

function createRecurringSchedulesEmbed(recurringSchedules, guild) {
  const embed = new EmbedBuilder()
    .setTitle("🔄 Recurring Schedules")
    .setColor(THEME_COLOR)
    .setTimestamp();

  if (recurringSchedules.length === 0) {
    embed.setDescription("No active recurring schedules found.");
    return embed;
  }

  const scheduleList = recurringSchedules
    .map(schedule => {
      const roleObj = guild.roles.cache.get(schedule.roleId);
      const roleName = roleObj ? roleObj.name : "Unknown Role";
      const scheduleDetails = formatRecurringScheduleDetails(schedule);

      return (
        `**${roleName}** - ${scheduleDetails}\n` +
        `👥 ${schedule.userIds.length} user(s) • ⏱️ ${schedule.duration} • 📝 ${schedule.reason || "No reason"}\n` +
        `📊 **Status:** ${formatStatus(schedule.status)}\n` +
        `🆔 \`${formatDisplayId(schedule.scheduleId)}\``
      );
    })
    .join("\n\n");

  embed.setDescription(scheduleList);
  return embed;
}

function formatTimeRemaining(targetDate) {
  const now = new Date();
  const diff = targetDate - now;

  if (diff <= 0) {
    return "Expired";
  }

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day(s)`;
  } else if (hours > 0) {
    return `${hours} hour(s)`;
  } else if (minutes > 0) {
    return `${minutes} minute(s)`;
  } else {
    return "Less than 1 minute";
  }
}

function formatRecurringScheduleDetails(schedule) {
  switch (schedule.type) {
    case "daily":
      return `Daily at ${schedule.hour}:${schedule.minute.toString().padStart(2, "0")}`;
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
