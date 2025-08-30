import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import {
  hasAdminPermissions,
  botHasRequiredPermissions,
  getMissingBotPermissions,
} from "../../utils/discord/permissions.js";
import {
  createRecurringRoleSchedule,
  getRecurringSchedules,
  cancelRecurringSchedule,
} from "../../utils/discord/enhancedTemporaryRoles.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";
import {
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

export const data = new SlashCommandBuilder()
  .setName("recurring-roles")
  .setDescription("Manage recurring temporary role schedules")
  .addSubcommand(subcommand =>
    subcommand
      .setName("create")
      .setDescription("Create a recurring role schedule")
      .addStringOption(option =>
        option
          .setName("users")
          .setDescription("Comma-separated list of user IDs or mentions")
          .setRequired(true),
      )
      .addRoleOption(option =>
        option
          .setName("role")
          .setDescription("The role to assign on schedule")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("schedule_type")
          .setDescription("Type of recurring schedule")
          .setRequired(true)
          .addChoices(
            { name: "Daily", value: "daily" },
            { name: "Weekly", value: "weekly" },
            { name: "Monthly", value: "monthly" },
            { name: "Custom Interval", value: "custom" },
          ),
      )
      .addStringOption(option =>
        option
          .setName("schedule_details")
          .setDescription(
            "Schedule details: '9am' daily, 'friday 6pm' weekly, '15 2pm' monthly, '120' custom minutes",
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
          .setDescription("Reason for the recurring schedule")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("list")
      .setDescription("List all recurring role schedules"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("cancel")
      .setDescription("Cancel a recurring role schedule")
      .addStringOption(option =>
        option
          .setName("schedule_id")
          .setDescription("ID of the schedule to cancel")
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
      return await interaction.editReply({
        ...permissionErrorEmbed({ requiredPermissions: ["ManageRoles"] }),
      });
    }

    const botPermissions = ["ManageRoles"];
    if (!(await botHasRequiredPermissions(interaction.guild, botPermissions))) {
      const missingPermissions = await getMissingBotPermissions(
        interaction.guild,
        botPermissions,
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
        await handleCreate(interaction, interaction.options);
        break;
      case "list":
        await handleList(interaction);
        break;
      case "cancel":
        await handleCancel(interaction, interaction.options);
        break;
      default:
        await interaction.editReply({
          ...errorEmbed({
            title: "Invalid Subcommand",
            description:
              "Please use a valid subcommand: create, list, or cancel.",
          }),
        });
    }
  } catch (error) {
    logger.error("Error in recurring-roles command:", error);

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
          ephemeral: true,
        });
      }
    } catch (replyError) {
      logger.error("Failed to send error response:", replyError);
    }
  }
}

async function handleCreate(interaction, options) {
  const { guild } = interaction;
  const usersInput = options.getString("users");
  const role = options.getRole("role");
  const scheduleType = options.getString("schedule_type");
  const scheduleDetails = options.getString("schedule_details");
  const duration = options.getString("duration");
  const reason = options.getString("reason") || "Recurring role assignment";

  // Validate role
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

  // Parse schedule details
  const schedule = parseScheduleDetails(scheduleType, scheduleDetails);
  if (!schedule) {
    return await interaction.editReply({
      ...errorEmbed({
        title: "Invalid Schedule Details",
        description: getScheduleHelpText(scheduleType),
      }),
    });
  }

  // Create recurring schedule
  const recurringSchedule = await createRecurringRoleSchedule(
    guild.id,
    userIds,
    role.id,
    schedule,
    duration,
    reason,
    interaction.user.id,
  );

  if (!recurringSchedule) {
    return await interaction.editReply({
      ...errorEmbed({
        title: "Creation Failed",
        description:
          "Failed to create the recurring schedule. Please try again.",
      }),
    });
  }

  // Create success embed
  const embed = new EmbedBuilder()
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
        value: `\`${recurringSchedule.scheduleId.substring(0, 8)}\``,
        inline: true,
      },
    )
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    ephemeral: false,
  });
}

async function handleList(interaction) {
  const { guild } = interaction;
  const schedules = await getRecurringSchedules(guild.id);

  if (schedules.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle("📋 Recurring Role Schedules")
      .setDescription("No recurring role schedules found for this server.")
      .setColor(THEME_COLOR)
      .setTimestamp();

    return await interaction.editReply({
      embeds: [embed],
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("📋 Recurring Role Schedules")
    .setDescription(
      `Found **${schedules.length}** active recurring schedule(s).`,
    )
    .setColor(THEME_COLOR)
    .setTimestamp();

  // Group schedules by type for better organization
  const schedulesByType = schedules.reduce((acc, schedule) => {
    const type = schedule.schedule.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(schedule);
    return acc;
  }, {});

  for (const [type, typeSchedules] of Object.entries(schedulesByType)) {
    const scheduleList = typeSchedules
      .map(schedule => {
        const role = guild.roles.cache.get(schedule.roleId);
        const roleName = role ? role.name : "Unknown Role";
        const nextRun = new Date(schedule.nextRun);
        const timeUntil = formatTimeUntil(nextRun);

        return `• **${roleName}** - ${timeUntil} (ID: \`${schedule.scheduleId.substring(0, 8)}\`)`;
      })
      .join("\n");

    embed.addFields({
      name: `${getScheduleTypeEmoji(type)} ${formatScheduleType(type)} Schedules`,
      value: scheduleList,
      inline: false,
    });
  }

  await interaction.editReply({
    embeds: [embed],
  });
}

async function handleCancel(interaction, options) {
  const shortId = options.getString("schedule_id");

  try {
    // Get all recurring schedules to find the one with matching short ID
    const recurringSchedules = await getRecurringSchedules(
      interaction.guild.id,
    );

    // Find the actual schedule using the short ID
    const recurringSchedule = Object.values(recurringSchedules).find(schedule =>
      schedule.scheduleId.startsWith(shortId),
    );

    if (!recurringSchedule) {
      return await interaction.editReply({
        ...errorEmbed({
          title: "Schedule Not Found",
          description: "No recurring schedule found with that ID.",
        }),
      });
    }

    const cancelled = await cancelRecurringSchedule(
      recurringSchedule.scheduleId,
    );

    if (!cancelled) {
      return await interaction.editReply({
        ...errorEmbed({
          title: "Cancellation Failed",
          description:
            "Failed to cancel the recurring schedule. Please try again.",
        }),
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("❌ Recurring Schedule Cancelled")
      .setDescription(
        "The recurring role schedule has been cancelled successfully.",
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
    logger.error("Error cancelling recurring schedule:", error);
    await interaction.editReply({
      ...errorEmbed({
        title: "Cancellation Failed",
        description:
          "Failed to cancel the recurring schedule. Please try again.",
      }),
    });
  }
}

function parseScheduleDetails(type, details) {
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

function getScheduleTypeEmoji(type) {
  const emojis = {
    daily: "📅",
    weekly: "📆",
    monthly: "🗓️",
    custom: "⏰",
  };
  return emojis[type] || "⏰";
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
