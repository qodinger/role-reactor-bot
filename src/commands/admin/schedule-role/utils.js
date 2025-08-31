import { errorEmbed } from "../../../utils/discord/responseMessages.js";

// ============================================================================
// INPUT PROCESSING & VALIDATION
// ============================================================================

export function extractScheduleOptions(interaction) {
  return {
    users: interaction.options.getString("users"),
    role: interaction.options.getRole("role"),
    type: interaction.options.getString("type"),
    schedule: interaction.options.getString("schedule"),
    duration: interaction.options.getString("duration"),
    reason:
      interaction.options.getString("reason") || "Scheduled role assignment",
  };
}

export async function validateScheduleInputs(interaction, options) {
  // Validate role
  if (!options.role) {
    return {
      valid: false,
      error: errorEmbed({
        title: "Invalid Role",
        description: "Please select a valid role to assign.",
      }),
    };
  }

  if (options.role.managed || (options.role.tags && options.role.tags.botId)) {
    return {
      valid: false,
      error: errorEmbed({
        title: "Invalid Role",
        description:
          "Cannot assign managed roles or bot roles as temporary roles.",
      }),
    };
  }

  // Validate users
  const userIds = parseUserInput(options.users);
  if (userIds.length === 0) {
    return {
      valid: false,
      error: errorEmbed({
        title: "Invalid Users",
        description: "Please provide valid user mentions or IDs.",
      }),
    };
  }

  return { valid: true, userIds };
}

export function parseUserInput(usersInput) {
  return usersInput
    .split(",")
    .map(user => user.trim())
    .filter(user => user.length > 0)
    .map(user => {
      const match = user.match(/<@!?(\d+)>/);
      return match ? match[1] : user;
    });
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

export function formatTimeRemaining(targetDate) {
  const now = new Date();
  const diff = targetDate - now;

  if (diff <= 0) {
    // For past dates, return relative time
    const absDiff = Math.abs(diff);
    const minutes = Math.floor(absDiff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day(s) ago`;
    } else if (hours > 0) {
      return `${hours} hour(s) ago`;
    } else if (minutes > 0) {
      return `${minutes} minute(s) ago`;
    } else {
      return "Just now";
    }
  }

  // For future dates, return time until
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

export function formatDateTime(date) {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatDisplayId(id) {
  if (!id || id.length < 16) return id;
  return `${id.substring(0, 8)}...${id.substring(id.length - 4)}`;
}

export function formatStatus(status, scheduleTime = null) {
  const now = new Date();

  switch (status?.toLowerCase()) {
    case "pending":
      return "⏳ **Pending** - Waiting for next execution time";
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

export function formatRecurringScheduleDetails(schedule) {
  // The schedule object contains the schedule details in schedule.schedule
  const scheduleData = schedule.schedule || schedule;

  switch (scheduleData.type) {
    case "daily":
      return `Daily at ${scheduleData.hour}:${scheduleData.minute.toString().padStart(2, "0")}`;
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
      return `${dayNames[scheduleData.dayOfWeek]} at ${scheduleData.hour}:${scheduleData.minute.toString().padStart(2, "0")}`;
    }
    case "monthly":
      return `${scheduleData.dayOfMonth}${getOrdinalSuffix(scheduleData.dayOfMonth)} at ${scheduleData.hour}:${scheduleData.minute.toString().padStart(2, "0")}`;
    case "custom":
      if (scheduleData.intervalMinutes < 60) {
        return `Every ${scheduleData.intervalMinutes} minute(s)`;
      } else if (scheduleData.intervalMinutes < 1440) {
        const hours = Math.floor(scheduleData.intervalMinutes / 60);
        return `Every ${hours} hour(s)`;
      } else {
        const days = Math.floor(scheduleData.intervalMinutes / 1440);
        return `Every ${days} day(s)`;
      }
    default:
      // Add debug logging to see what we're actually getting
      console.log(
        "Debug - schedule object:",
        JSON.stringify(schedule, null, 2),
      );
      return "Unknown schedule";
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getOrdinalSuffix(day) {
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
