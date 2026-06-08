/**
 * Formal tool definitions for Claude models (OpenAI-compatible format used by OpenRouter).
 * When passed to the API, Claude uses structured tool_use instead of outputting raw JSON,
 * which eliminates the fragile JSON-parsing / regex-fallback path.
 */

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "execute_command",
      description: "Execute a Discord bot command on behalf of the user.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Bot command name (e.g. 'rps', 'avatar', 'poll', 'serverinfo').",
          },
          subcommand: {
            type: "string",
            description: "Subcommand name when the command has subcommands (e.g. 'create' for 'poll create').",
          },
          options: {
            type: "object",
            description: "Key-value pairs of command options (e.g. {\"user\": \"<@123>\", \"choice\": \"rock\"}).",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_component",
      description:
        "Show Discord buttons or a select menu and wait for the user to choose. Use when you need the user to pick from a list (e.g. which role, which channel, which option). ≤5 options auto-selects buttons; >5 auto-selects a select menu.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The question or prompt shown above the component.",
          },
          options: {
            type: "array",
            description: "2–25 choices for the user.",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Button/option label (max 80 chars)." },
                value: { type: "string", description: "Internal value returned when selected." },
                description: { type: "string", description: "Short description shown in select menus (max 100 chars)." },
              },
              required: ["label"],
            },
            minItems: 2,
            maxItems: 25,
          },
          component_type: {
            type: "string",
            enum: ["buttons", "select"],
            description: "Force 'buttons' or 'select'; omit to auto-detect from option count.",
          },
          placeholder: {
            type: "string",
            description: "Placeholder text for select menus.",
          },
        },
        required: ["question", "options"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for real-time or current information. Use when the user asks about something that may have changed recently, current events, or when you're unsure about up-to-date facts.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (be specific for better results).",
          },
          count: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            description: "Number of results to return (default 5).",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_channels",
      description: "Refresh the server's channel list from Discord API. Use when the channel data in context may be stale.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_roles",
      description: "Refresh the server's role list from Discord API. Use when the role data in context may be stale.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_all",
      description: "Refresh all server data (channels and roles) from Discord API.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_member_info",
      description: "Get detailed information about a specific server member (join date, roles, etc.).",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "Discord user ID (snowflake)." },
          username: { type: "string", description: "Discord username (used when ID is unknown)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_role_info",
      description: "Get information about a specific server role (color, member count, permissions, etc.).",
      parameters: {
        type: "object",
        properties: {
          role_id: { type: "string", description: "Discord role ID (snowflake)." },
          role_name: { type: "string", description: "Role name (used when ID is unknown)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_channel_info",
      description: "Get information about a specific server channel (type, category, position, etc.).",
      parameters: {
        type: "object",
        properties: {
          channel_id: { type: "string", description: "Discord channel ID (snowflake)." },
          channel_name: { type: "string", description: "Channel name (used when ID is unknown)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_members_by_role",
      description: "Find all server members that currently have a specific role.",
      parameters: {
        type: "object",
        properties: {
          role_id: { type: "string", description: "Discord role ID (snowflake)." },
          role_name: { type: "string", description: "Role name (used when ID is unknown)." },
        },
      },
    },
  },
];

/**
 * Returns true if the given model name is a Claude model.
 * @param {string|null} modelName
 * @returns {boolean}
 */
export function isClaudeModel(modelName) {
  if (!modelName) return false;
  return modelName.toLowerCase().includes("claude");
}

/**
 * Translate OpenAI-format tool_calls from OpenRouter into our internal action format.
 * @param {Array} toolCalls  - tool_calls array from the API response
 * @returns {Array}           - array of action objects
 */
export function translateToolCallsToActions(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];

  return toolCalls
    .map(tc => {
      const name = tc?.function?.name;
      if (!name) return null;

      let args = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch (_e) {
        // malformed arguments — proceed with empty args
      }

      // execute_command has a flat top-level structure (command, subcommand, options)
      if (name === "execute_command") {
        return {
          type: "execute_command",
          command: args.command,
          subcommand: args.subcommand || null,
          options: args.options || {},
        };
      }

      // Argument-free actions
      if (["fetch_channels", "fetch_roles", "fetch_all"].includes(name)) {
        return { type: name };
      }

      // Everything else: arguments go into action.options
      return { type: name, options: args };
    })
    .filter(Boolean);
}
