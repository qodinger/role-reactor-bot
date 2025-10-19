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
  if (!id) return "Unknown";

  // If it's a short ID (SRXXXXXX or RSXXXXXX), return as is
  if (id.match(/^[SR]{2}[A-Za-z0-9]{6}$/)) {
    return id;
  }

  // For any other format, return as is (should only be short IDs now)
  return id;
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

export function formatScheduleTime(scheduleTime) {
  if (!scheduleTime) return "Not scheduled";
  const date = new Date(scheduleTime);
  return date.toLocaleString();
}

export function formatRecurringSchedule(schedule) {
  if (!schedule) return "Not scheduled";
  return typeof schedule === "string" ? schedule : JSON.stringify(schedule);
}
