/**
 * Action Registry - Centralized configuration for all AI actions
 *
 * This registry defines all available actions, their metadata, and behavior.
 * Adding new actions is as simple as adding an entry here.
 *
 * @module actionRegistry
 */

/**
 * Action categories
 */
export const ACTION_CATEGORIES = {
  DATA_FETCH: "data_fetch", // Fetches data from Discord (triggers re-query)
  DATA_RETRIEVE: "data_retrieve", // Retrieves specific data (read-only, no re-query)
  COMMAND_EXEC: "command_exec", // Executes bot commands
  ADMIN: "admin", // Admin actions (blocked)
  MODERATION: "moderation", // Moderation actions (blocked)
};

/**
 * Action configuration schema:
 * {
 *   type: string - Action type identifier
 *   category: ACTION_CATEGORIES - Action category
 *   requiresGuild: boolean - Whether action requires server context
 *   triggersReQuery: boolean - Whether action triggers AI re-query with updated context
 *   blocked: boolean - Whether action is blocked for security
 *   blockReason: string - Reason for blocking (if blocked)
 *   requiresOptions: boolean - Whether action requires options object
 *   requiredOptions: string[] - Required option keys (if requiresOptions)
 *   description: string - Human-readable description
 * }
 */

/**
 * Action registry - Single source of truth for all actions
 */
export const ACTION_REGISTRY = {
  // ============================================================================
  // DATA FETCHING ACTIONS (Trigger Re-Query)
  // ============================================================================
  fetch_members: {
    type: "fetch_members",
    category: ACTION_CATEGORIES.DATA_FETCH,
    requiresGuild: true,
    triggersReQuery: true,
    blocked: false,
    requiresOptions: false,
    description: "Fetch all server members (human members and bots)",
  },
  fetch_channels: {
    type: "fetch_channels",
    category: ACTION_CATEGORIES.DATA_FETCH,
    requiresGuild: true,
    triggersReQuery: true,
    blocked: false,
    requiresOptions: false,
    description: "Fetch all server channels",
  },
  fetch_roles: {
    type: "fetch_roles",
    category: ACTION_CATEGORIES.DATA_FETCH,
    requiresGuild: true,
    triggersReQuery: true,
    blocked: false,
    requiresOptions: false,
    description: "Fetch all server roles",
  },
  fetch_all: {
    type: "fetch_all",
    category: ACTION_CATEGORIES.DATA_FETCH,
    requiresGuild: true,
    triggersReQuery: true,
    blocked: false,
    requiresOptions: false,
    description: "Fetch all server data (members, channels, roles)",
  },

  // ============================================================================
  // DATA RETRIEVAL ACTIONS (Read-Only, No Re-Query)
  // ============================================================================
  get_member_info: {
    type: "get_member_info",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: false,
    requiresOptions: true,
    requiredOptions: ["user_id", "username"], // At least one required
    description: "Get information about a specific member",
  },
  get_role_info: {
    type: "get_role_info",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: false,
    requiresOptions: true,
    requiredOptions: ["role_id", "role_name"], // At least one required
    description: "Get information about a specific role",
  },
  get_channel_info: {
    type: "get_channel_info",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: false,
    requiresOptions: true,
    requiredOptions: ["channel_id", "channel_name"], // At least one required
    description: "Get information about a specific channel",
  },
  search_members_by_role: {
    type: "search_members_by_role",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: false,
    requiresOptions: true,
    requiredOptions: ["role_id", "role_name"], // At least one required
    description: "Search for members with a specific role",
  },
  get_role_reaction_messages: {
    type: "get_role_reaction_messages",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: false,
    requiresOptions: false,
    description: "Get role reaction message IDs",
  },
  get_scheduled_roles: {
    type: "get_scheduled_roles",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: false,
    requiresOptions: false,
    description: "Get scheduled role data",
  },
  get_polls: {
    type: "get_polls",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: false,
    requiresOptions: false,
    description: "Get poll data",
  },
  get_moderation_history: {
    type: "get_moderation_history",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: false,
    requiresOptions: false,
    description: "Get moderation history",
  },

  // ============================================================================
  // COMMAND EXECUTION
  // ============================================================================
  execute_command: {
    type: "execute_command",
    category: ACTION_CATEGORIES.COMMAND_EXEC,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: false,
    requiresOptions: false,
    requiredOptions: ["command"], // command is required, but not in options object
    description: "Execute a general bot command",
  },

  // ============================================================================
  // ADMIN ACTIONS (BLOCKED - Security Restriction)
  // ============================================================================
  add_role: {
    type: "add_role",
    category: ACTION_CATEGORIES.ADMIN,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Admin and guild management actions must be performed manually by administrators using bot commands",
    requiresOptions: true,
    requiredOptions: ["user_id", "role_id", "role_name"], // user_id + (role_id or role_name)
    description: "Add a role to a user (BLOCKED)",
  },
  remove_role: {
    type: "remove_role",
    category: ACTION_CATEGORIES.ADMIN,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Admin and guild management actions must be performed manually by administrators using bot commands",
    requiresOptions: true,
    requiredOptions: ["user_id", "role_id", "role_name"],
    description: "Remove a role from a user (BLOCKED)",
  },
  create_channel: {
    type: "create_channel",
    category: ACTION_CATEGORIES.ADMIN,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Admin and guild management actions must be performed manually by administrators using bot commands",
    requiresOptions: true,
    requiredOptions: ["name"],
    description: "Create a channel (BLOCKED)",
  },
  delete_channel: {
    type: "delete_channel",
    category: ACTION_CATEGORIES.ADMIN,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Admin and guild management actions must be performed manually by administrators using bot commands",
    requiresOptions: true,
    requiredOptions: ["channel_id"],
    description: "Delete a channel (BLOCKED)",
  },
  modify_channel: {
    type: "modify_channel",
    category: ACTION_CATEGORIES.ADMIN,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Admin and guild management actions must be performed manually by administrators using bot commands",
    requiresOptions: true,
    requiredOptions: ["channel_id"],
    description: "Modify a channel (BLOCKED)",
  },
  send_message: {
    type: "send_message",
    category: ACTION_CATEGORIES.ADMIN,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Admin and guild management actions must be performed manually by administrators using bot commands",
    requiresOptions: true,
    requiredOptions: ["content", "embed"], // At least one required
    description: "Send a message (BLOCKED)",
  },
  delete_message: {
    type: "delete_message",
    category: ACTION_CATEGORIES.ADMIN,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Admin and guild management actions must be performed manually by administrators using bot commands",
    requiresOptions: true,
    requiredOptions: ["message_id"],
    description: "Delete a message (BLOCKED)",
  },
  pin_message: {
    type: "pin_message",
    category: ACTION_CATEGORIES.ADMIN,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Admin and guild management actions must be performed manually by administrators using bot commands",
    requiresOptions: true,
    requiredOptions: ["message_id"],
    description: "Pin a message (BLOCKED)",
  },
  unpin_message: {
    type: "unpin_message",
    category: ACTION_CATEGORIES.ADMIN,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Admin and guild management actions must be performed manually by administrators using bot commands",
    requiresOptions: true,
    requiredOptions: ["message_id"],
    description: "Unpin a message (BLOCKED)",
  },

  // ============================================================================
  // MODERATION ACTIONS (BLOCKED - Security Restriction)
  // ============================================================================
  kick_member: {
    type: "kick_member",
    category: ACTION_CATEGORIES.MODERATION,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Moderation actions must be performed manually by administrators using moderation commands",
    requiresOptions: true,
    requiredOptions: ["user_id"],
    description: "Kick a member (BLOCKED)",
  },
  ban_member: {
    type: "ban_member",
    category: ACTION_CATEGORIES.MODERATION,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Moderation actions must be performed manually by administrators using moderation commands",
    requiresOptions: true,
    requiredOptions: ["user_id"],
    description: "Ban a member (BLOCKED)",
  },
  timeout_member: {
    type: "timeout_member",
    category: ACTION_CATEGORIES.MODERATION,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Moderation actions must be performed manually by administrators using moderation commands",
    requiresOptions: true,
    requiredOptions: ["user_id", "duration_seconds"],
    description: "Timeout a member (BLOCKED)",
  },
  warn_member: {
    type: "warn_member",
    category: ACTION_CATEGORIES.MODERATION,
    requiresGuild: true,
    triggersReQuery: false,
    blocked: true,
    blockReason:
      "Moderation actions must be performed manually by administrators using moderation commands",
    requiresOptions: true,
    requiredOptions: ["user_id"],
    description: "Warn a member (BLOCKED)",
  },
};

/**
 * Get action configuration by type
 * @param {string} actionType - Action type
 * @returns {Object|null} Action configuration or null if not found
 */
export function getActionConfig(actionType) {
  return ACTION_REGISTRY[actionType] || null;
}

/**
 * Check if action is blocked
 * @param {string} actionType - Action type
 * @returns {boolean} True if action is blocked
 */
export function isActionBlocked(actionType) {
  const config = getActionConfig(actionType);
  return config?.blocked === true;
}

/**
 * Check if action requires guild context
 * @param {string} actionType - Action type
 * @returns {boolean} True if action requires guild
 */
export function actionRequiresGuild(actionType) {
  const config = getActionConfig(actionType);
  return config?.requiresGuild === true;
}

/**
 * Check if action triggers re-query
 * @param {string} actionType - Action type
 * @returns {boolean} True if action triggers re-query
 */
export function actionTriggersReQuery(actionType) {
  const config = getActionConfig(actionType);
  return config?.triggersReQuery === true;
}

/**
 * Get all actions that require guild context
 * @returns {string[]} Array of action types
 */
export function getServerActions() {
  return Object.values(ACTION_REGISTRY)
    .filter(config => config.requiresGuild)
    .map(config => config.type);
}

/**
 * Get all actions that trigger re-query
 * @returns {string[]} Array of action types
 */
export function getReQueryActions() {
  return Object.values(ACTION_REGISTRY)
    .filter(config => config.triggersReQuery)
    .map(config => config.type);
}

/**
 * Get all blocked actions
 * @returns {string[]} Array of action types
 */
export function getBlockedActions() {
  return Object.values(ACTION_REGISTRY)
    .filter(config => config.blocked)
    .map(config => config.type);
}

/**
 * Get all allowed (non-blocked) actions
 * @returns {string[]} Array of action types
 */
export function getAllowedActions() {
  return Object.values(ACTION_REGISTRY)
    .filter(config => !config.blocked)
    .map(config => config.type);
}

/**
 * Get actions by category
 * @param {string} category - Action category
 * @returns {string[]} Array of action types
 */
export function getActionsByCategory(category) {
  return Object.values(ACTION_REGISTRY)
    .filter(config => config.category === category)
    .map(config => config.type);
}

/**
 * Validate action options based on registry configuration
 * @param {Object} action - Action object
 * @returns {{isValid: boolean, error?: string}} Validation result
 */
export function validateActionOptions(action) {
  const config = getActionConfig(action.type);
  if (!config) {
    return {
      isValid: false,
      error: `Unknown action type: ${action.type}`,
    };
  }

  // Check if blocked
  if (config.blocked) {
    return {
      isValid: false,
      error: `${action.type} is not available. ${config.blockReason}`,
    };
  }

  // Check if requires options
  if (config.requiresOptions) {
    if (!action.options || typeof action.options !== "object") {
      return {
        isValid: false,
        error: `${action.type} requires an 'options' object`,
      };
    }

    // Special handling for execute_command (command is not in options)
    if (action.type === "execute_command") {
      if (!action.command || typeof action.command !== "string") {
        return {
          isValid: false,
          error: "execute_command requires a 'command' field",
        };
      }
      return { isValid: true };
    }

    // Check required options
    if (config.requiredOptions && config.requiredOptions.length > 0) {
      const options = action.options || {};
      const optionKeys = Object.keys(options);

      // Handle "at least one of" requirements (e.g., user_id OR username)
      const requiredGroups = config.requiredOptions.filter(
        opt => opt.includes("_id") || opt.includes("name"),
      );
      if (requiredGroups.length > 0) {
        // Check if at least one of the required options is present
        const hasAtLeastOne = requiredGroups.some(opt =>
          optionKeys.includes(opt),
        );
        if (!hasAtLeastOne && optionKeys.length === 0) {
          return {
            isValid: false,
            error: `${action.type} requires at least one of: ${requiredGroups.join(", ")}`,
          };
        }
      }

      // Handle specific required options (e.g., user_id for kick_member)
      const specificRequired = config.requiredOptions.filter(
        opt => !requiredGroups.includes(opt),
      );
      for (const required of specificRequired) {
        if (!optionKeys.includes(required)) {
          return {
            isValid: false,
            error: `${action.type} requires '${required}' in options`,
          };
        }
      }
    }
  }

  return { isValid: true };
}
