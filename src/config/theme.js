// Enhanced theme configuration for improved UX/UI
export const THEME = {
  // Primary brand colors (softened)
  PRIMARY: 0x9b8bf0, // Soft lavender
  SECONDARY: 0x8b7fd8, // Muted purple
  ACCENT: 0xb8a9f5, // Light lavender

  // Status colors (pastel versions)
  SUCCESS: 0x7dd3fc, // Soft sky blue
  ERROR: 0xfca5a5, // Soft coral
  WARNING: 0xfcd34d, // Soft yellow
  INFO: 0x93c5fd, // Soft blue

  // UI Component colors (softer)
  BACKGROUND: 0x374151, // Softer dark
  SURFACE: 0x4b5563, // Softer surface
  BORDER: 0x6b7280, // Softer border
  TEXT_PRIMARY: 0xf9fafb, // Soft white
  TEXT_SECONDARY: 0xd1d5db, // Soft gray
  TEXT_MUTED: 0x9ca3af, // Softer muted

  // Category colors (pastel versions)
  ADMIN: 0xfecaca, // Soft pink
  GENERAL: 0x99f6e4, // Soft teal
  DEVELOPER: 0xfef3c7, // Soft cream
  MODERATION: 0xbbf7d0, // Soft mint
  UTILITY: 0xe9d5ff, // Soft lavender

  // Complexity indicators (softer)
  EASY: 0x86efac, // Soft green
  MEDIUM: 0xfbbf24, // Soft amber
  HARD: 0xfca5a5, // Soft red

  // Usage frequency indicators (pastel)
  HIGH_USAGE: 0xfecaca, // Soft pink
  MEDIUM_USAGE: 0x93c5fd, // Soft blue
  LOW_USAGE: 0x9ca3af, // Soft gray

  // Interactive states (softer)
  HOVER: 0xa5b4fc, // Soft indigo
  ACTIVE: 0x818cf8, // Softer indigo
  DISABLED: 0x9ca3af, // Soft gray

  // Semantic colors (pastel versions)
  ONLINE: 0x86efac, // Soft green
  IDLE: 0xfde047, // Soft yellow
  DND: 0xfca5a5, // Soft red
  OFFLINE: 0x9ca3af, // Soft gray
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
    SETTINGS: "⚙️",
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
    HELP: "❓",
    BACK: "⬅️",
    FORWARD: "➡️",
    UP: "🔼",
    DOWN: "🔽",
    QUICK: "🚀",
    HEART: "💖",
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
    PREMIUM: "💎",
    WELCOME: "🎉",
    USER: "👤",
    SERVER: "🏠",
    SUPPORT: "💝",
    FUN: "🎮",
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
    TROPHY: "🏆",
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
