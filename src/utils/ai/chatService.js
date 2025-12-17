import dedent from "dedent";
import { multiProviderAIService } from "./multiProviderAIService.js";
import { concurrencyManager } from "./concurrencyManager.js";
import { getLogger } from "../logger.js";
import { conversationManager } from "./conversationManager.js";
import { responseValidator } from "./responseValidator.js";
import { systemPromptBuilder } from "./systemPromptBuilder.js";
import {
  DEFAULT_MAX_HISTORY_LENGTH,
  DEFAULT_CONVERSATION_TIMEOUT,
  DEFAULT_MAX_CONVERSATIONS,
  MEMBER_FETCH_TIMEOUT,
  MAX_MEMBER_FETCH_SERVER_SIZE,
  MAX_MEMBERS_TO_DISPLAY,
  MAX_RESPONSE_LENGTH,
  FOLLOW_UP_QUERY_TIMEOUT,
  JSON_MARKDOWN_PATTERNS,
} from "./constants.js";

const logger = getLogger();

// Follow-up prompt template (when data is fetched)
const FOLLOW_UP_PROMPT_TEMPLATE = dedent`
  I've fetched the data. The member list is now in the system context above in the "COMPLETE LIST OF HUMAN MEMBER NAMES" section.

  **CRITICAL INSTRUCTIONS:**
  1. Look at the "COMPLETE LIST OF HUMAN MEMBER NAMES" section in the system context above
  2. Find the numbered list (e.g., "1. Name1\\n2. Name2\\n3. Name3")
  3. Copy the EXACT names from that numbered list - type them character by character as shown
  4. Do NOT invent, guess, or make up ANY member names
  5. Do NOT use generic names like "iFunny", "Reddit", "Discord", "John", "Alice", "Bob", "Charlie"
  6. Use ONLY the actual member names from the numbered list in the "COMPLETE LIST OF HUMAN MEMBER NAMES" section

  Now provide the actual member names and information the user requested, using ONLY the names from the numbered list above.
`;

// ============================================================================
// CHAT SERVICE CLASS
// ============================================================================

/**
 * Chat service for AI-powered conversations with bot and server context
 */
export class ChatService {
  constructor() {
    this.aiService = multiProviderAIService;

    // Initialize conversation manager with configuration
    const maxHistoryLength =
      parseInt(process.env.AI_CONVERSATION_HISTORY_LENGTH) ||
      DEFAULT_MAX_HISTORY_LENGTH;
    const conversationTimeout =
      parseInt(process.env.AI_CONVERSATION_TIMEOUT) ||
      DEFAULT_CONVERSATION_TIMEOUT;
    const maxConversations =
      parseInt(process.env.AI_MAX_CONVERSATIONS) || DEFAULT_MAX_CONVERSATIONS;

    conversationManager.initLongTermMemory();
    conversationManager.setConfig({
      maxHistoryLength,
      conversationTimeout,
      maxConversations,
    });
    conversationManager.startCleanup();
  }

  /**
   * Get conversation history for a user (delegates to conversationManager)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Conversation messages
   */
  async getConversationHistory(userId) {
    return conversationManager.getConversationHistory(userId);
  }

  /**
   * Add message to conversation history (delegates to conversationManager)
   * @param {string} userId - User ID
   * @param {Object} message - Message object with role and content
   */
  async addToHistory(userId, message) {
    return conversationManager.addToHistory(userId, message);
  }

  /**
   * Clear conversation history for a user (delegates to conversationManager)
   * @param {string} userId - User ID
   */
  async clearHistory(userId) {
    return conversationManager.clearHistory(userId);
  }

  /**
   * Validate action structure and required fields
   * @param {Object} action - Action object to validate
   * @returns {Object} Validation result with isValid and error message
   * @private
   */
  validateAction(action) {
    if (!action || typeof action !== "object") {
      return { isValid: false, error: "Action must be an object" };
    }

    if (!action.type || typeof action.type !== "string") {
      return { isValid: false, error: "Action must have a 'type' field" };
    }

    // Validate required fields for specific action types
    switch (action.type) {
      case "get_member_info":
      case "get_role_info":
      case "get_channel_info":
      case "search_members_by_role":
        if (!action.options || typeof action.options !== "object") {
          return {
            isValid: false,
            error: `${action.type} requires an 'options' object`,
          };
        }
        // Check if options object is empty (no required fields)
        if (Object.keys(action.options).length === 0) {
          return {
            isValid: false,
            error: `${action.type} requires non-empty 'options' with required fields`,
          };
        }
        break;

      // Dynamic data fetching actions (get_*) don't require options
      default:
        if (
          action.type.startsWith("get_") &&
          action.type !== "get_member_info" &&
          action.type !== "get_role_info" &&
          action.type !== "get_channel_info" &&
          action.type !== "search_members_by_role"
        ) {
          // Dynamic actions don't require options validation
          break;
        }
        // Unknown action type - will be handled in switch statement
        break;

      case "execute_command":
        if (!action.command || typeof action.command !== "string") {
          return {
            isValid: false,
            error: "execute_command requires a 'command' field",
          };
        }
        break;

      case "send_message":
        if (
          !action.options ||
          (!action.options.content && !action.options.embed)
        ) {
          return {
            isValid: false,
            error: "send_message requires 'content' or 'embed' in options",
          };
        }
        break;

      case "add_role":
      case "remove_role":
        if (
          !action.options ||
          !action.options.user_id ||
          (!action.options.role_id && !action.options.role_name)
        ) {
          return {
            isValid: false,
            error: `${action.type} requires 'user_id' and ('role_id' or 'role_name') in options`,
          };
        }
        break;

      case "kick_member":
      case "ban_member":
      case "timeout_member":
      case "warn_member":
        if (!action.options || !action.options.user_id) {
          return {
            isValid: false,
            error: `${action.type} requires 'user_id' in options`,
          };
        }
        if (
          action.type === "timeout_member" &&
          !action.options.duration_seconds
        ) {
          return {
            isValid: false,
            error: "timeout_member requires 'duration_seconds' in options",
          };
        }
        break;

      case "delete_message":
      case "pin_message":
      case "unpin_message":
        if (!action.options || !action.options.message_id) {
          return {
            isValid: false,
            error: `${action.type} requires 'message_id' in options`,
          };
        }
        break;

      case "create_channel":
        if (!action.options || !action.options.name) {
          return {
            isValid: false,
            error: "create_channel requires 'name' in options",
          };
        }
        break;

      case "delete_channel":
      case "modify_channel":
        if (!action.options || !action.options.channel_id) {
          return {
            isValid: false,
            error: `${action.type} requires 'channel_id' in options`,
          };
        }
        break;

      case "fetch_members":
      case "fetch_channels":
      case "fetch_roles":
      case "fetch_all":
        // No additional validation needed for fetch actions
        break;
    }

    return { isValid: true, error: null };
  }

  /**
   * Execute structured actions from AI response
   * @param {Array} actions - Array of action objects
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {import('discord.js').User} user - User who triggered the action
   * @param {import('discord.js').Channel} channel - Channel where action was triggered
   * @returns {Promise<{results: Array<string>, commandResponses: Array<{command: string, response: object}>}>}
   */
  async executeStructuredActions(actions, guild, client, user, channel) {
    const results = [];
    // Commands now send responses directly to channel, no need to store them

    // Validate actions array
    if (!Array.isArray(actions)) {
      logger.warn("[executeStructuredActions] Actions is not an array");
      return {
        results: ["Invalid actions format: expected an array"],
        commandResponses: [],
      };
    }

    // Validate guild is available for server-specific actions
    // These actions require a guild context to execute
    const SERVER_ACTIONS = [
      "fetch_members",
      "fetch_channels",
      "fetch_roles",
      "fetch_all",
      "get_member_info",
      "get_role_info",
      "get_channel_info",
      "search_members_by_role",
      // Dynamic data fetching actions (require guild)
      "get_role_reaction_messages",
      "get_scheduled_roles",
      "get_polls",
      "get_moderation_history",
      // Command execution and Discord operations
      "execute_command",
      "send_message",
      "add_role",
      "remove_role",
      "kick_member",
      "ban_member",
      "timeout_member",
      "warn_member",
      "delete_message",
      "pin_message",
      "unpin_message",
      "create_channel",
      "delete_channel",
      "modify_channel",
    ];

    for (const action of actions) {
      // Validate action structure
      const validation = this.validateAction(action);
      if (!validation.isValid) {
        logger.warn(
          `[executeStructuredActions] Invalid action: ${validation.error}`,
        );
        results.push(`Invalid action: ${validation.error}`);
        continue;
      }

      // Check if guild is required for this action
      if (SERVER_ACTIONS.includes(action.type) && !guild) {
        results.push(
          `${action.type} requires a server context (cannot be used in DMs)`,
        );
        continue;
      }

      try {
        switch (action.type) {
          case "fetch_members":
            if (!guild) {
              results.push("Cannot fetch members: not in a server");
              break;
            }
            await this.fetchMembers(guild);
            results.push("Fetched all server members");
            break;

          case "fetch_channels":
            if (!guild) {
              results.push("Cannot fetch channels: not in a server");
              break;
            }
            await guild.channels.fetch();
            results.push("Fetched all channels");
            break;

          case "fetch_roles":
            if (!guild) {
              results.push("Cannot fetch roles: not in a server");
              break;
            }
            await guild.roles.fetch();
            results.push("Fetched all roles");
            break;

          case "fetch_all":
            if (!guild) {
              results.push("Cannot fetch data: not in a server");
              break;
            }
            await this.fetchMembers(guild);
            await guild.channels.fetch();
            await guild.roles.fetch();
            results.push("Fetched all server data");
            break;

          case "get_member_info":
            if (!guild) {
              results.push("Cannot get member info: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.user_id && !action.options.username)
            ) {
              results.push(
                "get_member_info requires 'user_id' or 'username' in options",
              );
              break;
            }
            {
              const memberInfo = await this.getMemberInfo(
                guild,
                action.options,
              );
              if (memberInfo) {
                results.push(`Data: ${memberInfo}`);
              } else {
                results.push("Member not found");
              }
            }
            break;

          case "get_role_info":
            if (!guild) {
              results.push("Cannot get role info: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.role_id && !action.options.role_name)
            ) {
              results.push(
                "get_role_info requires 'role_id' or 'role_name' in options",
              );
              break;
            }
            {
              const roleInfo = await this.getRoleInfo(guild, action.options);
              if (roleInfo) {
                results.push(`Data: ${roleInfo}`);
              } else {
                results.push("Role not found");
              }
            }
            break;

          case "get_channel_info":
            if (!guild) {
              results.push("Cannot get channel info: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.channel_id && !action.options.channel_name)
            ) {
              results.push(
                "get_channel_info requires 'channel_id' or 'channel_name' in options",
              );
              break;
            }
            {
              const channelInfo = await this.getChannelInfo(
                guild,
                action.options,
              );
              if (channelInfo) {
                results.push(`Data: ${channelInfo}`);
              } else {
                results.push("Channel not found");
              }
            }
            break;

          case "search_members_by_role":
            if (!guild) {
              results.push("Cannot search members: not in a server");
              break;
            }
            if (
              !action.options ||
              (!action.options.role_id && !action.options.role_name)
            ) {
              results.push(
                "search_members_by_role requires 'role_id' or 'role_name' in options",
              );
              break;
            }
            {
              const members = await this.searchMembersByRole(
                guild,
                action.options,
              );
              if (members && members.length > 0) {
                const memberList = members
                  .map((name, idx) => `${idx + 1}. ${name}`)
                  .join("\n");
                results.push(
                  `Found: ${members.length} member(s) with that role:\n${memberList}`,
                );
              } else {
                results.push("No members found with that role");
              }
            }
            break;

          case "execute_command":
            if (!guild) {
              results.push("Cannot execute command: not in a server");
              break;
            }
            if (!action.command) {
              results.push("execute_command requires a 'command' field");
              break;
            }
            {
              try {
                const { executeCommandProgrammatically } = await import(
                  "./commandExecutor.js"
                );
                const result = await executeCommandProgrammatically({
                  commandName: action.command,
                  subcommand: action.subcommand || null,
                  options: action.options || {},
                  user,
                  guild,
                  channel,
                  client,
                });
                if (result.success) {
                  // Command has already sent its response directly to the channel
                  // We just need to mark it as executed for the AI context
                  logger.info(
                    `[executeStructuredActions] Command ${action.command} executed and sent response to channel`,
                  );
                  results.push(
                    `Command Result: Command ${action.command} executed successfully`,
                  );
                } else {
                  results.push(
                    `Failed to execute command: ${result.error || "Unknown error"}`,
                  );
                }
              } catch (error) {
                results.push(
                  `Error executing command: ${error.message || "Unknown error"}`,
                );
              }
            }
            break;

          // Discord Actions (require Discord Action Executor)
          case "send_message":
          case "add_role":
          case "remove_role":
          case "kick_member":
          case "ban_member":
          case "timeout_member":
          case "warn_member":
          case "delete_message":
          case "pin_message":
          case "unpin_message":
          case "create_channel":
          case "delete_channel":
          case "modify_channel":
            {
              try {
                const { discordActionExecutor } = await import(
                  "./discordActionExecutor.js"
                );
                const result = await discordActionExecutor.executeAction(
                  action,
                  guild,
                  channel,
                  user,
                  client,
                );
                if (result.success) {
                  results.push(result.result || `${action.type} completed`);
                } else {
                  results.push(
                    `Failed ${action.type}: ${result.error || "Unknown error"}`,
                  );
                }
              } catch (error) {
                results.push(
                  `Error in ${action.type}: ${error.message || "Unknown error"}`,
                );
              }
            }
            break;

          default:
            // Check if this is a dynamic data fetching action
            if (
              action.type.startsWith("get_") &&
              action.type !== "get_member_info" &&
              action.type !== "get_role_info" &&
              action.type !== "get_channel_info" &&
              action.type !== "search_members_by_role"
            ) {
              const handled = await this.handleDynamicDataFetching(
                action.type,
                guild,
                client,
              );
              if (handled !== null) {
                results.push(handled);
                break;
              }
            }
            logger.warn(`Unknown action type: ${action.type}`);
            results.push(`Unknown action type: ${action.type}`);
        }
      } catch (error) {
        logger.error(`Error executing action ${action.type}:`, error);
        results.push(
          `Failed to execute ${action.type}: ${error.message || "Unknown error"}`,
        );
      }
    }

    return { results, commandResponses: [] }; // Commands send directly, no need to return them
  }

  /**
   * Get detailed information about a specific member
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with user_id or username
   * @returns {Promise<string|null>} Member information or null if not found
   */
  async getMemberInfo(guild, options) {
    if (!guild) return null;

    try {
      let member = null;

      // Try to find by user ID
      if (options.user_id) {
        member = guild.members.cache.get(options.user_id);
        if (!member) {
          member = await guild.members.fetch(options.user_id).catch(() => null);
        }
      }
      // Try to find by username
      else if (options.username) {
        const username = options.username.toLowerCase();
        member = guild.members.cache.find(
          m =>
            m.user.username.toLowerCase() === username ||
            m.displayName.toLowerCase() === username ||
            m.user.tag.toLowerCase() === username,
        );
      }

      if (!member) return null;

      const roles = member.roles.cache
        .filter(role => role.name !== "@everyone")
        .map(role => role.name)
        .join(", ");

      return `${member.user.tag} (${member.user.id}) - Roles: ${roles || "None"} - Joined: ${member.joinedAt?.toLocaleDateString() || "Unknown"}`;
    } catch (error) {
      logger.error("[getMemberInfo] Error:", error);
      return null;
    }
  }

  /**
   * Get detailed information about a specific role
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with role_name or role_id
   * @returns {Promise<string|null>} Role information or null if not found
   */
  async getRoleInfo(guild, options) {
    if (!guild) return null;

    try {
      let role = null;

      // Try to find by role ID
      if (options.role_id) {
        role = guild.roles.cache.get(options.role_id);
      }
      // Try to find by role name
      else if (options.role_name) {
        const roleName = options.role_name.toLowerCase();
        role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName);
      }

      if (!role || role.name === "@everyone") return null;

      // Count members with this role
      const membersWithRole = guild.members.cache.filter(m =>
        m.roles.cache.has(role.id),
      ).size;

      return `${role.name} (${role.id}) - Members: ${membersWithRole} - Color: ${role.hexColor} - Position: ${role.position}`;
    } catch (error) {
      logger.error("[getRoleInfo] Error:", error);
      return null;
    }
  }

  /**
   * Get detailed information about a specific channel
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with channel_name or channel_id
   * @returns {Promise<string|null>} Channel information or null if not found
   */
  async getChannelInfo(guild, options) {
    if (!guild) return null;

    try {
      let channel = null;

      // Try to find by channel ID
      if (options.channel_id) {
        channel = guild.channels.cache.get(options.channel_id);
      }
      // Try to find by channel name
      else if (options.channel_name) {
        const channelName = options.channel_name.toLowerCase();
        channel = guild.channels.cache.find(
          c => c.name?.toLowerCase() === channelName,
        );
      }

      if (!channel) return null;

      const typeMap = {
        0: "Text",
        2: "Voice",
        4: "Category",
        5: "News",
        13: "Stage",
        15: "Forum",
      };

      return `${channel.name} (${channel.id}) - Type: ${typeMap[channel.type] || "Unknown"} - Created: ${channel.createdAt?.toLocaleDateString() || "Unknown"}`;
    } catch (error) {
      logger.error("[getChannelInfo] Error:", error);
      return null;
    }
  }

  /**
   * Search for members with a specific role
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with role_name or role_id
   * @returns {Promise<Array<string>|null>} Array of member names or null if role not found
   */
  async searchMembersByRole(guild, options) {
    if (!guild) return null;

    try {
      let role = null;

      // Try to find by role ID
      if (options.role_id) {
        role = guild.roles.cache.get(options.role_id);
      }
      // Try to find by role name
      else if (options.role_name) {
        const roleName = options.role_name.toLowerCase();
        role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName);
      }

      if (!role || role.name === "@everyone") return null;

      // Get members with this role
      const members = guild.members.cache
        .filter(m => m.roles.cache.has(role.id) && !m.user.bot)
        .map(m => m.displayName || m.user.username)
        .slice(0, MAX_MEMBERS_TO_DISPLAY);

      return members;
    } catch (error) {
      logger.error("[searchMembersByRole] Error:", error);
      return null;
    }
  }

  /**
   * Fetch all members for a guild
   * @param {import('discord.js').Guild} guild - Discord guild
   * @returns {Promise<void>}
   */
  async fetchMembers(guild) {
    const cachedBefore = guild.members.cache.size;
    const totalMembers = guild.memberCount;

    if (
      cachedBefore < totalMembers &&
      totalMembers <= MAX_MEMBER_FETCH_SERVER_SIZE
    ) {
      try {
        const fetchPromise = guild.members.fetch();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Member fetch timed out")),
            MEMBER_FETCH_TIMEOUT * 2, // Longer timeout for explicit fetch
          );
        });

        await Promise.race([fetchPromise, timeoutPromise]);
        logger.debug(
          `[fetchMembers] Fetched ${guild.members.cache.size} members`,
        );
      } catch (fetchError) {
        logger.debug(`[fetchMembers] Fetch failed: ${fetchError.message}`);
        throw fetchError;
      }
    }
  }

  /**
   * Handle dynamic data fetching actions (get_role_reaction_messages, get_scheduled_roles, etc.)
   * @param {string} actionType - Action type (e.g., "get_role_reaction_messages")
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} _client - Discord client (unused)
   * @returns {Promise<string|null>} Formatted data string or null if action not handled
   * @private
   */
  async handleDynamicDataFetching(actionType, guild, _client) {
    if (!guild) {
      return "This action requires a server context (cannot be used in DMs)";
    }

    try {
      const { getStorageManager } = await import(
        "../storage/storageManager.js"
      );
      const storageManager = getStorageManager();

      switch (actionType) {
        case "get_role_reaction_messages": {
          const mappings = await storageManager.getRoleMappingsPaginated(
            guild.id,
            1,
            100, // Get up to 100 messages
          );
          if (
            !mappings ||
            !mappings.mappings ||
            Object.keys(mappings.mappings).length === 0
          ) {
            return "No role reaction messages found in this server";
          }
          const messageIds = Object.keys(mappings.mappings);
          return `Found ${messageIds.length} role reaction message(s):\n${messageIds.map((id, idx) => `${idx + 1}. Message ID: ${id}`).join("\n")}`;
        }

        case "get_scheduled_roles": {
          const { getDatabaseManager } = await import(
            "../storage/databaseManager.js"
          );
          const dbManager = await getDatabaseManager();
          if (!dbManager?.scheduledRoles) {
            return "Scheduled roles data not available (database not connected)";
          }
          const allSchedules = await dbManager.scheduledRoles.getAll();
          const guildSchedules = Object.values(allSchedules).filter(
            s => s.guildId === guild.id && !s.executed,
          );
          if (guildSchedules.length === 0) {
            return "No active scheduled roles found in this server";
          }
          return `Found ${guildSchedules.length} scheduled role(s):\n${guildSchedules.map((s, idx) => `${idx + 1}. Schedule ID: ${s.id} - Role: ${s.roleId} - Scheduled for: ${s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : "Unknown"}`).join("\n")}`;
        }

        case "get_polls": {
          const { getDatabaseManager } = await import(
            "../storage/databaseManager.js"
          );
          const dbManager = await getDatabaseManager();
          if (!dbManager?.polls) {
            return "Polls data not available (database not connected)";
          }
          const allPolls = await dbManager.polls.getAll();
          const guildPolls = Object.values(allPolls).filter(
            p => p.guildId === guild.id && !p.ended,
          );
          if (guildPolls.length === 0) {
            return "No active polls found in this server";
          }
          return `Found ${guildPolls.length} active poll(s):\n${guildPolls.map((p, idx) => `${idx + 1}. Poll ID: ${p.id} - Question: ${p.question || "N/A"}`).join("\n")}`;
        }

        case "get_moderation_history": {
          // Moderation history would need to be implemented based on your moderation system
          // This is a placeholder - adjust based on your actual moderation storage
          return "Moderation history feature not yet implemented";
        }

        default:
          return null; // Not a handled dynamic action
      }
    } catch (error) {
      logger.error(
        `[handleDynamicDataFetching] Error handling ${actionType}:`,
        error,
      );
      return `Error fetching data: ${error.message || "Unknown error"}`;
    }
  }

  /**
   * Parse JSON response from AI, handling markdown code blocks and extra text
   * @param {string} rawResponse - Raw AI response text
   * @returns {Object} Parsed result with {success: boolean, data?: object, error?: string}
   * @private
   */
  parseJsonResponse(rawResponse) {
    try {
      let jsonString = rawResponse.trim();

      // Remove markdown code blocks if present
      jsonString = jsonString.replace(JSON_MARKDOWN_PATTERNS.jsonBlock, "");
      jsonString = jsonString.replace(JSON_MARKDOWN_PATTERNS.codeBlock, "");
      jsonString = jsonString.replace(JSON_MARKDOWN_PATTERNS.closingBlock, "");
      jsonString = jsonString.trim();

      // Try to extract JSON if there's extra text before/after
      const jsonMatch = jsonString.match(JSON_MARKDOWN_PATTERNS.jsonObject);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonString);

      // Validate structure
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "message" in parsed
      ) {
        return {
          success: true,
          data: {
            message: parsed.message || "No response generated.",
            actions: Array.isArray(parsed.actions) ? parsed.actions : [],
          },
        };
      }

      return {
        success: false,
        error: "Invalid JSON structure - missing 'message' field",
        parsedKeys: Object.keys(parsed),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to parse JSON",
        rawResponse: rawResponse.substring(0, 500),
      };
    }
  }

  /**
   * Generate AI chat response
   * @param {string} userMessage - User's message/question
   * @param {import('discord.js').Guild} guild - Discord guild (optional)
   * @param {import('discord.js').Client} client - Discord client
   * @param {Object} options - Additional options
   * @param {string} options.userId - User ID for rate limiting
   * @param {Object} options.coreUserData - Core user data for priority
   * @param {import('discord.js').User} options.user - User object (required for command execution)
   * @param {import('discord.js').Channel} options.channel - Channel object (required for command execution)
   * @param {string} options.locale - User's locale (e.g., "en-US", "en-GB") for date/time formatting
   * @returns {Promise<string>} AI response text
   */
  async generateResponse(userMessage, guild, client, options = {}) {
    const { userId, coreUserData, locale } = options;

    if (!this.aiService.isEnabled()) {
      throw new Error(
        "AI chat is not available. Please enable a text-capable AI provider in the bot configuration.",
      );
    }

    // Build system context with user message for on-demand command injection
    const systemMessage = await systemPromptBuilder.buildSystemContext(
      guild,
      client,
      userMessage,
      options.locale || "en-US",
    );

    // Log system context summary for verification
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info(
      `[AI CONTEXT LOG] User: ${userId || "unknown"} | Guild: ${guild?.name || "DM"}`,
    );
    logger.info(
      `[AI CONTEXT LOG] System prompt length: ${systemMessage.length} chars (~${Math.ceil(systemMessage.length / 4)} tokens)`,
    );
    if (guild) {
      const memberCount = guild.members.cache.filter(m => !m.user.bot).size;
      const roleCount = guild.roles.cache.size;
      const channelCount = guild.channels.cache.size;
      logger.info(
        `[AI CONTEXT LOG] Server context: ${memberCount} members, ${roleCount} roles, ${channelCount} channels`,
      );

      // Check if member list is in the prompt
      const hasMemberList = systemMessage.includes(
        "COMPLETE LIST OF HUMAN MEMBER NAMES",
      );
      if (hasMemberList) {
        // Extract the member list section - look for the section until next section or end
        const memberListMatch = systemMessage.match(
          /COMPLETE LIST OF HUMAN MEMBER NAMES[\s\S]*?(?=\n\n##|\n\n━━|$)/,
        );
        if (memberListMatch) {
          const memberListSection = memberListMatch[0];
          // Match numbered list items - handle various formats:
          // "1. name", "1. name\n", etc.
          // Use multiline flag and match across lines
          const memberLines =
            memberListSection.match(/^\s*\d+\.\s+.+$/gm) || [];
          const memberNames = memberLines.length;

          if (memberNames > 0) {
            logger.info(
              `[AI CONTEXT LOG] Member list found in prompt: ${memberNames} members`,
            );
          }
        }
      }
    }

    // Get conversation history for this user (with LTM support)
    const history = await this.getConversationHistory(userId);

    // Build messages array with conversation history (optimized)
    const messages = [];

    // Optimized: Check if system message exists (usually first message)
    const hasSystemMessage =
      history.length > 0 && history[0]?.role === "system";

    if (hasSystemMessage) {
      // Update system message in case server context changed (use cached version)
      messages.push({ role: "system", content: systemMessage });
      // Update in history and persist if changed
      if (history[0].content !== systemMessage) {
        history[0].content = systemMessage;
        // Persist updated system message to database (async, don't wait)
        // This is now handled by conversationManager
        conversationManager
          .addToHistory(userId, {
            role: "system",
            content: systemMessage,
          })
          .catch(() => {});
      }
    } else {
      // First message in conversation - add system message
      messages.push({ role: "system", content: systemMessage });
      await this.addToHistory(userId, {
        role: "system",
        content: systemMessage,
      });
    }

    // Optimized: Add conversation history (skip system, already added)
    // More efficient: start from index 1 if system exists, otherwise 0
    const startIndex = hasSystemMessage ? 1 : 0;
    for (let i = startIndex; i < history.length; i++) {
      messages.push({
        role: history[i].role,
        content: history[i].content,
      });
    }

    // Add user-specific date/time context
    const userLocale = locale || "en-US";
    const now = new Date();
    const userDate = now.toLocaleDateString(userLocale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const userTime = now.toLocaleTimeString(userLocale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });

    // Add current user message with date/time context
    const userMessageWithContext = `[Current Date and Time for User: ${userDate} at ${userTime}]\n\n${userMessage}`;
    messages.push({ role: "user", content: userMessageWithContext });
    await this.addToHistory(userId, { role: "user", content: userMessage });

    const requestId = `chat-${userId || "unknown"}-${Date.now()}`;

    return concurrencyManager.queueRequest(
      requestId,
      async () => {
        try {
          // Determine maxTokens based on user's request
          // Check if user explicitly asks for detailed explanation
          const wantsDetail =
            userMessage.toLowerCase().includes("explain") ||
            userMessage.toLowerCase().includes("tell me more") ||
            userMessage.toLowerCase().includes("in detail") ||
            userMessage.toLowerCase().includes("elaborate") ||
            userMessage.toLowerCase().includes("describe") ||
            userMessage.toLowerCase().includes("how does") ||
            userMessage.toLowerCase().includes("how do");

          const maxTokens = wantsDetail ? 800 : 500; // Concise by default (500 tokens ≈ 350-400 chars), expand if asked

          // Add a final reminder about JSON format to the user message
          // Note: messages[messages.length - 1] already contains userMessageWithContext
          const userMessageWithReminder = `${messages[messages.length - 1].content}\n\n[REMINDER: You MUST respond in JSON format: {"message": "...", "actions": []}]`;

          const result = await this.aiService.generate({
            type: "text",
            prompt: [
              ...messages.slice(0, -1), // All messages except the last one
              {
                ...messages[messages.length - 1],
                content: userMessageWithReminder, // Replace last message with reminder
              },
            ],
            config: {
              systemMessage,
              temperature: 0.7,
              maxTokens, // Adaptive: 500 for concise, 800 if user asks for detail
              forceJson: true, // Force JSON format for structured output
            },
            // Use primary provider (self-hosted if enabled, otherwise fallback)
          });

          const rawResponse =
            result.text || result.response || "No response generated.";

          // ============================================================================
          // LOG AI RESPONSE FOR VERIFICATION
          // ============================================================================
          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          logger.info(
            `[AI RESPONSE LOG] User: ${userId || "unknown"} | Guild: ${guild?.name || "DM"}`,
          );
          logger.info(`[AI RESPONSE LOG] User Message: "${userMessage}"`);
          logger.info(
            `[AI RESPONSE LOG] Raw AI Response (${rawResponse.length} chars):`,
          );
          logger.info(rawResponse);
          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

          // Parse structured JSON response
          let finalResponse;
          let actions = [];

          const parseResult = this.parseJsonResponse(rawResponse);

          if (parseResult.success) {
            finalResponse = parseResult.data.message;
            actions = parseResult.data.actions;

            // Log parsed JSON structure
            logger.info(
              `[AI RESPONSE LOG] ✅ Successfully parsed JSON response`,
            );
            logger.info(
              `[AI RESPONSE LOG] Parsed Message (${finalResponse.length} chars): "${finalResponse.substring(0, 200)}${finalResponse.length > 200 ? "..." : ""}"`,
            );
            logger.info(
              `[AI RESPONSE LOG] Actions detected: ${actions.length}`,
            );
            if (actions.length > 0) {
              logger.info(
                `[AI RESPONSE LOG] Actions: ${JSON.stringify(actions, null, 2)}`,
              );
            }

            // Validate response data accuracy
            if (guild) {
              const validation = responseValidator.validateResponseData(
                finalResponse,
                guild,
              );

              if (!validation.valid || validation.warnings.length > 0) {
                logger.warn(`[AI RESPONSE LOG] ⚠️ DATA VALIDATION WARNINGS:`);
                validation.warnings.forEach(warning => {
                  logger.warn(`[AI RESPONSE LOG] - ${warning}`);
                });
                if (validation.suggestions.length > 0) {
                  logger.info(
                    `[AI RESPONSE LOG] 💡 Suggestions for improvement:`,
                  );
                  validation.suggestions.forEach(suggestion => {
                    logger.info(`[AI RESPONSE LOG] - ${suggestion}`);
                  });
                }
                logger.info(
                  `[AI RESPONSE LOG] Server has ${validation.actualDataCounts.members} members, ${validation.actualDataCounts.roles} roles, ${validation.actualDataCounts.channels} channels`,
                );
              } else {
                logger.info(
                  `[AI RESPONSE LOG] ✅ Data validation passed - response uses real server data`,
                );
              }
            }

            // Check for placeholder data usage (AI didn't replace placeholders with real data)
            const placeholderPatterns = [
              "[ACTUAL_MEMBER",
              "[ACTUAL_USERNAME",
              "[ACTUAL_ROLE_NAME",
              "[ACTUAL_CHANNEL_NAME",
              "[ACTUAL_USER_ID",
              "[ACTUAL_ROLE_ID",
              "[ACTUAL_CHANNEL_ID",
              "[ROLE_NAME]",
              "[ACTUAL_",
            ];
            const usedPlaceholders = placeholderPatterns.some(pattern =>
              finalResponse.includes(pattern),
            );
            if (usedPlaceholders) {
              logger.error(
                `[AI RESPONSE LOG] ❌ CRITICAL ERROR: Response contains placeholder patterns!`,
              );
              logger.error(
                `[AI RESPONSE LOG] AI violated instructions by using placeholder data instead of real server data!`,
              );
              placeholderPatterns.forEach(pattern => {
                if (finalResponse.includes(pattern)) {
                  logger.error(
                    `[AI RESPONSE LOG] Found placeholder: "${pattern}"`,
                  );
                }
              });
              // Try to extract what the AI should have used
              if (guild) {
                const memberNames = Array.from(guild.members.cache.values())
                  .filter(m => m && m.user && !m.user.bot)
                  .slice(0, 5)
                  .map(m => m.displayName || m.user.username)
                  .join(", ");
                logger.error(
                  `[AI RESPONSE LOG] AI should have used these actual member names: ${memberNames}`,
                );
              }
            } else {
              logger.info(
                `[AI RESPONSE LOG] ✅ No placeholder patterns detected - AI used actual data`,
              );
            }

            logger.debug(
              `[generateResponse] Parsed structured response with ${actions.length} actions`,
            );
          } else {
            // Invalid structure or parse error - wrap in proper format as fallback
            logger.warn(
              "[generateResponse] Response is not valid JSON - AI violated format requirement, wrapping in fallback format",
            );
            logger.warn(
              `[AI RESPONSE LOG] ❌ CRITICAL: AI did not respond in required JSON format!`,
            );
            logger.warn(`[AI RESPONSE LOG] Parse error: ${parseResult.error}`);
            if (parseResult.parsedKeys) {
              logger.warn(
                `[AI RESPONSE LOG] Parsed object keys: ${parseResult.parsedKeys.join(", ")}`,
              );
            }
            logger.warn(
              `[AI RESPONSE LOG] Raw response (first 500 chars): ${parseResult.rawResponse || rawResponse.substring(0, 500)}`,
            );

            // Check if response contains placeholders
            const hasPlaceholders =
              /\[ACTUAL_(MEMBER|USERNAME|ROLE|CHANNEL)/i.test(rawResponse);
            if (hasPlaceholders) {
              logger.error(
                `[AI RESPONSE LOG] ❌ AI used placeholder data instead of real data!`,
              );
            }

            // Validate the raw response for data accuracy even if JSON parsing failed
            if (guild) {
              const validation = responseValidator.validateResponseData(
                rawResponse,
                guild,
              );
              if (!validation.valid || validation.warnings.length > 0) {
                logger.warn(
                  `[AI RESPONSE LOG] ⚠️ Data validation warnings in non-JSON response:`,
                );
                validation.warnings.forEach(warning => {
                  logger.warn(`[AI RESPONSE LOG] - ${warning}`);
                });
              }
            }

            // Fallback: Automatically wrap non-JSON responses in JSON format
            // This ensures the bot can still function even if AI doesn't follow format
            try {
              // Clean up the raw response - remove any obvious errors or placeholders
              let cleanedResponse = rawResponse.trim();

              // Remove common AI disclaimers that aren't helpful
              cleanedResponse = cleanedResponse.replace(
                /(Note: I don't have real-time access|I'm a language model|I don't have personal experiences)[^.]*\./gi,
                "",
              );

              // If response is empty or too short, provide a helpful fallback
              if (cleanedResponse.length < 10) {
                cleanedResponse =
                  "I apologize, but I couldn't generate a proper response. Please try rephrasing your question or use /help to see available commands.";
              }

              // Try to create a proper JSON response from the raw text
              const wrappedResponse = {
                message: cleanedResponse,
                actions: [],
              };
              // Use the wrapped response as if it came from JSON
              finalResponse = wrappedResponse.message;
              actions = wrappedResponse.actions;
              logger.info(
                `[AI RESPONSE LOG] ✅ Auto-wrapped non-JSON response in JSON format`,
              );
            } catch (wrapError) {
              // If wrapping fails, provide a safe fallback message
              finalResponse =
                "I encountered an error processing your request. Please try again or use /help for available commands.";
              logger.error("Failed to wrap response:", wrapError);
            }
          }

          // Process structured actions if we have them
          if (actions.length > 0 && guild) {
            try {
              const actionResult = await this.executeStructuredActions(
                actions,
                guild,
                client,
                options.user,
                options.channel,
              );

              const actionResults = actionResult.results;
              // Commands now send responses directly to channel, so no need to capture them

              // Check if any actions were data fetch actions (fetch_members, fetch_all, etc.)
              const fetchActions = actions.filter(
                a =>
                  a.type === "fetch_members" ||
                  a.type === "fetch_channels" ||
                  a.type === "fetch_roles" ||
                  a.type === "fetch_all",
              );

              // If fetch actions were executed, re-query AI with updated context
              if (fetchActions.length > 0) {
                logger.info(
                  `[generateResponse] Fetch actions executed, re-querying AI with updated data`,
                );

                // Rebuild system context with freshly fetched data
                const updatedSystemMessage =
                  await systemPromptBuilder.buildSystemContext(
                    guild,
                    client,
                    userMessage,
                    options.locale || "en-US",
                  );

                // Get updated conversation history
                const updatedHistory =
                  await this.getConversationHistory(userId);

                // Build messages array with updated context
                const updatedMessages = [];
                const hasSystemMessage =
                  updatedHistory.length > 0 &&
                  updatedHistory[0]?.role === "system";
                if (hasSystemMessage) {
                  updatedMessages.push({
                    role: "system",
                    content: updatedSystemMessage,
                  });
                } else {
                  updatedMessages.push({
                    role: "system",
                    content: updatedSystemMessage,
                  });
                }

                const startIndex = hasSystemMessage ? 1 : 0;
                for (let i = startIndex; i < updatedHistory.length; i++) {
                  updatedMessages.push({
                    role: updatedHistory[i].role,
                    content: updatedHistory[i].content,
                  });
                }

                // Add user message and AI's previous response
                updatedMessages.push({ role: "user", content: userMessage });
                updatedMessages.push({
                  role: "assistant",
                  content: finalResponse,
                });
                updatedMessages.push({
                  role: "user",
                  content: FOLLOW_UP_PROMPT_TEMPLATE,
                });

                // Re-query AI with updated context (with timeout)
                const followUpPromise = this.aiService.generate({
                  type: "text",
                  prompt: updatedMessages,
                  config: {
                    systemMessage: updatedSystemMessage,
                    temperature: 0.7,
                    maxTokens: wantsDetail ? 800 : 500,
                    forceJson: true, // Force JSON format for structured output
                  },
                });

                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(
                    () => reject(new Error("Follow-up query timed out")),
                    FOLLOW_UP_QUERY_TIMEOUT,
                  );
                });

                const followUpResult = await Promise.race([
                  followUpPromise,
                  timeoutPromise,
                ]);

                const followUpResponse =
                  followUpResult.text ||
                  followUpResult.response ||
                  finalResponse;

                // Parse follow-up response
                const followUpParseResult =
                  this.parseJsonResponse(followUpResponse);
                if (followUpParseResult.success) {
                  finalResponse = followUpParseResult.data.message;
                  logger.info(
                    `[generateResponse] ✅ Follow-up response generated with actual data`,
                  );
                } else {
                  logger.warn(
                    `[generateResponse] Follow-up response parse failed: ${followUpParseResult.error}`,
                  );
                  finalResponse = followUpResponse;
                }
              } else {
                // For non-fetch actions, include data results in response
                const dataResults = actionResults.filter(
                  r => r.startsWith("Data:") || r.startsWith("Found:"),
                );
                const commandResults = actionResults.filter(r =>
                  r.startsWith("Command Result:"),
                );
                const statusResults = actionResults.filter(
                  r =>
                    !r.startsWith("Data:") &&
                    !r.startsWith("Found:") &&
                    !r.startsWith("Command Result:"),
                );

                // Commands now send their responses directly to the channel
                // So we don't need to handle commandResponsesToSend anymore
                // Just handle text results if any
                // Commands now send their responses directly to the channel
                // Suppress generic AI messages when commands execute successfully
                if (commandResults.length > 0) {
                  logger.info(
                    `[generateResponse] Command executed - response already sent to channel by command handler`,
                  );
                  // Check if the AI's message is generic/acknowledgment-only
                  const genericPatterns = [
                    /^I'll (execute|run|show|display|get|fetch)/i,
                    /^Let me (execute|run|show|display|get|fetch)/i,
                    /^I'll (execute|run) (the|that) .+ (command|for you)/i,
                    /^Executing/i,
                    /^Running/i,
                  ];
                  const isGenericMessage = genericPatterns.some(pattern =>
                    pattern.test(finalResponse.trim()),
                  );

                  if (isGenericMessage) {
                    // Suppress generic message - command already sent its response
                    finalResponse = "";
                    logger.info(
                      `[generateResponse] Suppressed generic AI message - command response already sent`,
                    );
                  }
                }

                if (dataResults.length > 0) {
                  // Include data in response for AI to use
                  finalResponse += `\n\n**Additional Information:**\n${dataResults.map(r => r.replace(/^(Data:|Found:)\s*/, "")).join("\n")}`;
                }

                // Log status results but don't clutter user response
                if (statusResults.length > 0) {
                  logger.debug(
                    `[generateResponse] Action status: ${statusResults.join(", ")}`,
                  );
                }
              }
            } catch (error) {
              logger.error("Error executing structured actions:", error);
            }
          }

          // Final safety checks: sanitize response and validate data accuracy
          const beforeSanitize = finalResponse;
          finalResponse = responseValidator.sanitizeData(finalResponse);

          // Additional validation: Check for empty or invalid responses
          if (!finalResponse || finalResponse.trim().length === 0) {
            logger.warn(
              `[AI RESPONSE LOG] ⚠️ Response is empty after processing, using fallback`,
            );
            finalResponse =
              "I couldn't generate a response. Please try rephrasing your question or use /help for available commands.";
          }

          // Check response length to prevent Discord embed limit issues
          if (finalResponse.length > MAX_RESPONSE_LENGTH) {
            logger.warn(
              `[AI RESPONSE LOG] ⚠️ Response exceeds maximum length (${finalResponse.length} > ${MAX_RESPONSE_LENGTH}), truncating`,
            );
            finalResponse = `${finalResponse.substring(0, MAX_RESPONSE_LENGTH - 3)}...`;
          }

          // Log final response
          logger.info(
            `[AI RESPONSE LOG] Final Response (${finalResponse.length} chars):`,
          );
          logger.info(finalResponse);
          if (beforeSanitize !== finalResponse) {
            logger.info(
              `[AI RESPONSE LOG] ⚠️ Response was sanitized (sensitive data removed)`,
            );
          }
          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

          // Add AI response to conversation history (sanitized, with LTM)
          await this.addToHistory(userId, {
            role: "assistant",
            content: finalResponse,
          });

          // Return text response - commands send their own responses directly to channel
          return {
            text: finalResponse,
            commandResponses: [], // Commands send directly, no need to return them
          };
        } catch (error) {
          logger.error("Chat generation failed:", error);
          throw error;
        }
      },
      {
        userId,
        coreUserData,
      },
    );
  }
}

export const chatService = new ChatService();
