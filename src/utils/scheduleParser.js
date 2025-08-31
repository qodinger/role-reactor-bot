/**
 * Schedule Parser Module
 * Handles parsing of various schedule formats for role assignments
 */

// One-time schedule parsing
export function parseOneTimeSchedule(scheduleInput) {
  try {
    const input = scheduleInput.toLowerCase().trim();

    // Handle relative time formats
    if (input.startsWith("in ")) {
      const timeStr = input.substring(3);
      return parseRelativeTime(timeStr);
    }

    // Handle shorthand relative time formats (e.g., "2m", "5h", "1d")
    const shorthandMatch = input.match(/^(\d+)(m|h|d|w)$/i);
    if (shorthandMatch) {
      const amount = parseInt(shorthandMatch[1]);
      const unit = shorthandMatch[2].toLowerCase();
      return parseShorthandTime(amount, unit);
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
      if (!afternoon.trim()) {
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

function parseShorthandTime(amount, unit) {
  const now = new Date();

  switch (unit) {
    case "m": // minutes
      return new Date(now.getTime() + amount * 60 * 1000);
    case "h": // hours
      return new Date(now.getTime() + amount * 60 * 60 * 1000);
    case "d": // days
      return new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
    case "w": // weeks
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

// Recurring schedule parsing
export function parseRecurringSchedule(type, details) {
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

// Help text for schedule types
export function getScheduleHelpText(type) {
  switch (type) {
    case "one-time":
      return "For one-time schedules, use formats:\n• Shorthand: `2m`, `5h`, `1d`, `2w`\n• Relative: `in 2 minutes`, `in 1 hour`\n• Absolute: `tomorrow 8am`, `friday 2pm`\n• Keywords: `now`, `tonight`, `morning`";
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
