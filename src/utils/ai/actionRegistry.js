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
};

/**
 * Action configuration schema:
 * {
 *   type: string - Action type identifier
 *   category: ACTION_CATEGORIES - Action category
 *   requiresGuild: boolean - Whether action requires server context
 *   triggersReQuery: boolean - Whether action triggers AI re-query with updated context
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
    requiresOptions: false,
    description: "Fetch all server members (human members and bots)",
  },
  fetch_channels: {
    type: "fetch_channels",
    category: ACTION_CATEGORIES.DATA_FETCH,
    requiresGuild: true,
    triggersReQuery: true,
    requiresOptions: false,
    description: "Fetch all server channels",
  },
  fetch_roles: {
    type: "fetch_roles",
    category: ACTION_CATEGORIES.DATA_FETCH,
    requiresGuild: true,
    triggersReQuery: true,
    requiresOptions: false,
    description: "Fetch all server roles",
  },
  fetch_all: {
    type: "fetch_all",
    category: ACTION_CATEGORIES.DATA_FETCH,
    requiresGuild: true,
    triggersReQuery: true,
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
    requiresOptions: true,
    requiredOptions: ["user_id", "username"], // At least one required
    description: "Get information about a specific member",
  },
  get_role_info: {
    type: "get_role_info",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    requiresOptions: true,
    requiredOptions: ["role_id", "role_name"], // At least one required
    description: "Get information about a specific role",
  },
  get_channel_info: {
    type: "get_channel_info",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    requiresOptions: true,
    requiredOptions: ["channel_id", "channel_name"], // At least one required
    description: "Get information about a specific channel",
  },
  search_members_by_role: {
    type: "search_members_by_role",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    requiresOptions: true,
    requiredOptions: ["role_id", "role_name"], // At least one required
    description: "Search for members with a specific role",
  },
  get_role_reaction_messages: {
    type: "get_role_reaction_messages",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    requiresOptions: false,
    description: "Get role reaction message IDs",
  },
  get_scheduled_roles: {
    type: "get_scheduled_roles",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    requiresOptions: false,
    description: "Get scheduled role data",
  },
  get_polls: {
    type: "get_polls",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
    requiresOptions: false,
    description: "Get poll data",
  },
  get_moderation_history: {
    type: "get_moderation_history",
    category: ACTION_CATEGORIES.DATA_RETRIEVE,
    requiresGuild: true,
    triggersReQuery: false,
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
    requiresOptions: false,
    requiredOptions: ["command"], // command is required, but not in options object
    description: "Execute a general bot command",
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
 * Get all available actions
 * @returns {string[]} Array of action types
 */
export function getAllowedActions() {
  return Object.values(ACTION_REGISTRY).map(config => config.type);
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

      // Handle specific required options
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
