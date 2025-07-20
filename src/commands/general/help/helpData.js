import { THEME, EMOJIS } from "../../../config/theme.js";

/**
 * Command categories with emojis and descriptions
 */
export const COMMAND_CATEGORIES = {
  admin: {
    emoji: EMOJIS.CATEGORIES.ADMIN,
    name: "Administration",
    description: "Manage role reactions and server settings",
    color: THEME.ADMIN,
    commands: [
      "setup-roles",
      "update-roles",
      "delete-roles",
      "list-roles",
      "assign-temp-role",
      "remove-temp-role",
      "list-temp-roles",
    ],
    requiredPermissions: ["MANAGE_ROLES"], // Admin commands require role management
  },
  general: {
    emoji: EMOJIS.CATEGORIES.GENERAL,
    name: "General",
    description: "Basic bot information and help",
    color: THEME.GENERAL,
    commands: ["help"],
    requiredPermissions: [], // General commands available to everyone
  },
  developer: {
    emoji: EMOJIS.CATEGORIES.DEVELOPER,
    name: "Developer",
    description: "Developer and bot management commands",
    color: THEME.DEVELOPER,
    commands: ["health", "performance", "storage"],
    requiredPermissions: ["DEVELOPER"], // Special permission for developers only
  },
};

/**
 * Command metadata for enhanced descriptions
 */
export const COMMAND_METADATA = {
  "setup-roles": {
    emoji: EMOJIS.ACTIONS.SETTINGS,
    complexity: "Medium",
    usage: "High",
    shortDesc: "Create interactive role selection messages",
    tags: ["setup", "roles", "reactions"],
  },
  "update-roles": {
    emoji: EMOJIS.ACTIONS.EDIT,
    complexity: "Medium",
    usage: "Medium",
    shortDesc: "Modify existing role messages",
    tags: ["edit", "update", "roles"],
  },
  "delete-roles": {
    emoji: EMOJIS.ACTIONS.DELETE,
    complexity: "Easy",
    usage: "Low",
    shortDesc: "Remove role reaction messages",
    tags: ["delete", "remove", "cleanup"],
  },
  "list-roles": {
    emoji: EMOJIS.ACTIONS.VIEW,
    complexity: "Easy",
    usage: "Medium",
    shortDesc: "View all active role messages",
    tags: ["list", "view", "overview"],
  },
  "assign-temp-role": {
    emoji: EMOJIS.FEATURES.TEMPORARY,
    complexity: "Medium",
    usage: "Medium",
    shortDesc: "Give users temporary roles with auto-expiry",
    tags: ["temporary", "assign", "time-limited"],
  },
  "remove-temp-role": {
    emoji: EMOJIS.FEATURES.TEMPORARY,
    complexity: "Easy",
    usage: "Low",
    shortDesc: "Remove temporary roles early",
    tags: ["temporary", "remove", "early"],
  },
  "list-temp-roles": {
    emoji: EMOJIS.TIME.CALENDAR,
    complexity: "Easy",
    usage: "Medium",
    shortDesc: "View active temporary roles",
    tags: ["temporary", "list", "expiry"],
  },
  help: {
    emoji: EMOJIS.ACTIONS.HELP,
    complexity: "Easy",
    usage: "High",
    shortDesc: "Get help and command information",
    tags: ["help", "guide", "commands"],
  },
  health: {
    emoji: EMOJIS.STATUS.SUCCESS,
    complexity: "Easy",
    usage: "Low",
    shortDesc: "Check bot health and status",
    tags: ["health", "status", "diagnostics"],
  },
  performance: {
    emoji: EMOJIS.FEATURES.MONITORING,
    complexity: "Easy",
    usage: "Low",
    shortDesc: "View bot performance metrics",
    tags: ["performance", "metrics", "stats"],
  },
  storage: {
    emoji: EMOJIS.FEATURES.BACKUP,
    complexity: "Easy",
    usage: "Low",
    shortDesc: "View storage configuration status",
    tags: ["storage", "database", "config"],
  },
};

/**
 * Get complexity indicator emoji
 * @param {string} complexity
 * @returns {string}
 */
export function getComplexityIndicator(complexity) {
  switch (complexity?.toLowerCase()) {
    case "easy":
      return EMOJIS.COMPLEXITY.EASY;
    case "medium":
      return EMOJIS.COMPLEXITY.MEDIUM;
    case "hard":
      return EMOJIS.COMPLEXITY.HARD;
    default:
      return "⚪";
  }
}

/**
 * Get usage frequency indicator
 * @param {string} usage
 * @returns {string}
 */
export function getUsageIndicator(usage) {
  switch (usage?.toLowerCase()) {
    case "high":
      return EMOJIS.USAGE.HIGH;
    case "medium":
      return EMOJIS.USAGE.MEDIUM;
    case "low":
      return EMOJIS.USAGE.LOW;
    default:
      return EMOJIS.USAGE.NONE;
  }
}
