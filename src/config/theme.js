// Enhanced theme configuration for improved UX/UI
export const THEME = {
  // Primary brand colors
  PRIMARY: 0x7f7bf5, // Main brand color
  SECONDARY: 0x6c5ce7, // Secondary brand color
  ACCENT: 0xa29bfe, // Accent color for highlights

  // Status colors with better contrast
  SUCCESS: 0x00d084, // Green for success messages
  ERROR: 0xff3838, // Red for error messages
  WARNING: 0xffa502, // Orange for warnings
  INFO: 0x3742fa, // Blue for info messages

  // UI Component colors
  BACKGROUND: 0x2f3136, // Dark background
  SURFACE: 0x36393f, // Card/surface background
  BORDER: 0x4f545c, // Border color
  TEXT_PRIMARY: 0xffffff, // Primary text
  TEXT_SECONDARY: 0xb9bbbe, // Secondary text
  TEXT_MUTED: 0x72767d, // Muted text

  // Category colors for command grouping
  ADMIN: 0xff6b6b, // Red for admin commands
  GENERAL: 0x4ecdc4, // Teal for general commands
  DEVELOPER: 0xffe66d, // Yellow for developer commands
  MODERATION: 0xa8e6cf, // Light green for moderation
  UTILITY: 0xdda0dd, // Plum for utility commands

  // Complexity indicators
  EASY: 0x2ecc71, // Green for easy commands
  MEDIUM: 0xf39c12, // Orange for medium commands
  HARD: 0xe74c3c, // Red for hard commands

  // Usage frequency indicators
  HIGH_USAGE: 0xff4757, // Hot red for high usage
  MEDIUM_USAGE: 0x3742fa, // Blue for medium usage
  LOW_USAGE: 0x57606f, // Gray for low usage

  // Interactive states
  HOVER: 0x5865f2, // Discord blurple for hover
  ACTIVE: 0x4752c4, // Darker blurple for active
  DISABLED: 0x72767d, // Gray for disabled

  // Semantic colors
  ONLINE: 0x43b581, // Discord green
  IDLE: 0xfaa61a, // Discord yellow
  DND: 0xf04747, // Discord red
  OFFLINE: 0x747f8d, // Discord gray
};

// UI Component helper functions
export const UI_COMPONENTS = {
  // Create consistent embed footers
  createFooter: (text, iconURL) => ({
    text: `${text} • Role Reactor`,
    iconURL,
  }),

  // Create consistent embed authors
  createAuthor: (name, iconURL, url = null) => ({
    name,
    iconURL,
    url,
  }),

  // Create progress bars for visual feedback
  createProgressBar: (current, total, length = 10) => {
    const filled = Math.round((current / total) * length);
    const empty = length - filled;
    return `${"█".repeat(filled)}${"░".repeat(empty)} ${Math.round((current / total) * 100)}%`;
  },

  // Create status indicators
  createStatusBadge: (status, label) => {
    const statusEmojis = {
      online: "🟢",
      offline: "🔴",
      idle: "🟡",
      dnd: "⛔",
      good: "✅",
      warning: "⚠️",
      error: "❌",
    };
    return `${statusEmojis[status] || "⚪"} **${label}**`;
  },

  // Create interactive button configs
  createButton: (
    customId,
    label,
    style = "Secondary",
    emoji = null,
    disabled = false,
  ) => ({
    customId,
    label,
    style,
    emoji,
    disabled,
  }),

  // Create select menu options
  createSelectOption: (
    label,
    value,
    description = null,
    emoji = null,
    default_ = false,
  ) => ({
    label,
    value,
    description,
    emoji,
    default: default_,
  }),
};

// Default theme color (alias for PRIMARY)
export const THEME_COLOR = THEME.PRIMARY;

// Emoji sets for enhanced visual communication
export const EMOJIS = {
  // Status indicators
  STATUS: {
    ONLINE: "🟢",
    OFFLINE: "🔴",
    IDLE: "🟡",
    DND: "⛔",
    LOADING: "⏳",
    SUCCESS: "✅",
    ERROR: "❌",
    WARNING: "⚠️",
    INFO: "ℹ️",
  },

  // Command categories
  CATEGORIES: {
    ADMIN: "🛠️",
    GENERAL: "📚",
    DEVELOPER: "👑",
    MODERATION: "🛡️",
    UTILITY: "🔧",
    FUN: "🎉",
    MUSIC: "🎵",
  },

  // Command complexity
  COMPLEXITY: {
    EASY: "🟢",
    MEDIUM: "🟡",
    HARD: "🔴",
    EXPERT: "🟣",
  },

  // Usage frequency
  USAGE: {
    HIGH: "🔥",
    MEDIUM: "📈",
    LOW: "📉",
    NONE: "➖",
  },

  // Actions and interactions
  ACTIONS: {
    EDIT: "✏️",
    DELETE: "🗑️",
    ADD: "➕",
    REMOVE: "➖",
    VIEW: "👁️",
    SEARCH: "🔍",
    FILTER: "🔽",
    SORT: "📊",
    REFRESH: "🔄",
    SAVE: "💾",
    UPLOAD: "📤",
    DOWNLOAD: "📥",
    COPY: "📋",
    LINK: "🔗",
    SETTINGS: "⚙️",
    HELP: "❓",
    BACK: "🔙",
    FORWARD: "🔜",
    UP: "🔼",
    DOWN: "🔽",
    QUICK: "🚀",
  },

  // Features and functionality
  FEATURES: {
    ROLES: "🎭",
    REACTIONS: "👍",
    PERMISSIONS: "🔐",
    TEMPORARY: "⏰",
    PERMANENT: "♾️",
    AUTOMATION: "🤖",
    MONITORING: "📊",
    SECURITY: "🛡️",
    BACKUP: "💾",
    SYNC: "🔄",
    EXPERIENCE: "⭐",
  },

  // Navigation and UI
  UI: {
    MENU: "📋",
    DROPDOWN: "🔽",
    BUTTON: "🔘",
    TOGGLE: "🔄",
    SLIDER: "🎚️",
    PROGRESS: "📊",
    LOADING: "⏳",
    CHECKMARK: "✓",
    CROSS: "✗",
    STAR: "⭐",
    HEART: "❤️",
    THUMBS_UP: "👍",
    THUMBS_DOWN: "👎",
    OWNER: "👑",
    IMAGE: "🖼️",
    QUESTION: "❓",
    ANSWER: "💬",
    USERS: "👥",
    CHANNELS: "📺",
    INFO: "ℹ️",
    SERVER: "🏠",
    USER: "👤",
    MESSAGE: "💬",
    COMMAND: "⚡",
    TIME: "⏰",
  },

  // Time and scheduling
  TIME: {
    CLOCK: "🕐",
    CALENDAR: "📅",
    TIMER: "⏱️",
    STOPWATCH: "⏱️",
    HOURGLASS: "⏳",
    ALARM: "⏰",
    SCHEDULE: "📋",
  },

  // Numbers and indicators (for step-by-step guides)
  NUMBERS: {
    ONE: "1️⃣",
    TWO: "2️⃣",
    THREE: "3️⃣",
    FOUR: "4️⃣",
    FIVE: "5️⃣",
    SIX: "6️⃣",
    SEVEN: "7️⃣",
    EIGHT: "8️⃣",
    NINE: "9️⃣",
    TEN: "🔟",
  },
};
