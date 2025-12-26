import { getLogger } from "../logger.js";
import {
  MEMBER_FETCH_TIMEOUT,
  MAX_MEMBER_FETCH_SERVER_SIZE,
  MAX_MEMBERS_TO_DISPLAY,
} from "./constants.js";

const logger = getLogger();

/**
 * Data Fetcher for AI chat service
 * Handles fetching Discord server data (members, roles, channels, etc.)
 */
export class DataFetcher {
  /**
   * Get detailed information about a specific member
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {Object} options - Options with user_id or username
   * @returns {Promise<string|null>} Member information or null if not found
   */
  static async getMemberInfo(guild, options) {
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
  static async getRoleInfo(guild, options) {
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
  static async getChannelInfo(guild, options) {
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
  static async searchMembersByRole(guild, options) {
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
   * Smart member fetch with auto-detection
   * Automatically fetches members if needed based on cache coverage and user query
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {string} userMessage - User's message (for keyword detection)
   * @returns {Promise<{fetched: boolean, reason: string, cached: number, total: number, coverage?: number, fetchedCount?: number, error?: string}>}
   */
  static async smartMemberFetch(guild, userMessage = "") {
    if (!guild) {
      return { fetched: false, reason: "No guild context" };
    }

    // Detect if member data is needed based on keywords
    const needsMemberList =
      userMessage &&
      (userMessage.toLowerCase().includes("member") ||
        userMessage.toLowerCase().includes("who") ||
        userMessage.toLowerCase().includes("list") ||
        userMessage.toLowerCase().includes("people") ||
        userMessage.toLowerCase().includes("users") ||
        userMessage.toLowerCase().includes("offline") ||
        userMessage.toLowerCase().includes("online") ||
        userMessage.toLowerCase().includes("idle") ||
        userMessage.toLowerCase().includes("dnd") ||
        userMessage.toLowerCase().includes("do not disturb"));

    if (!needsMemberList) {
      return { fetched: false, reason: "No member keywords detected" };
    }

    const cachedBefore = guild.members.cache.size;
    const totalMembers = guild.memberCount;

    // Don't auto-fetch for large servers (>1000 members)
    if (totalMembers > MAX_MEMBER_FETCH_SERVER_SIZE) {
      logger.debug(
        `[smartMemberFetch] Server has ${totalMembers} members (exceeds ${MAX_MEMBER_FETCH_SERVER_SIZE} limit) - skipping auto-fetch`,
      );
      return {
        fetched: false,
        reason: "Server too large",
        cached: cachedBefore,
        total: totalMembers,
      };
    }

    // Calculate cache coverage
    const cacheCoverage = totalMembers > 0 ? cachedBefore / totalMembers : 0;

    // Only fetch if cache coverage is insufficient (< 50%)
    if (cacheCoverage >= 0.5 && cachedBefore >= totalMembers) {
      logger.debug(
        `[smartMemberFetch] Cache coverage sufficient (${Math.round(cacheCoverage * 100)}%) - skipping fetch`,
      );
      return {
        fetched: false,
        reason: "Cache coverage sufficient",
        cached: cachedBefore,
        total: totalMembers,
        coverage: cacheCoverage,
      };
    }

    // Fetch members
    const fetchResult = await DataFetcher.fetchMembers(guild);
    const cachedAfter = guild.members.cache.size;

    return {
      fetched: fetchResult.success,
      reason: fetchResult.success
        ? "Auto-fetched due to low cache coverage"
        : `Auto-fetch failed: ${fetchResult.error || "Unknown error"}`,
      cached: cachedAfter,
      total: totalMembers,
      coverage: totalMembers > 0 ? cachedAfter / totalMembers : 0,
      fetchedCount: fetchResult.fetched || 0,
      error: fetchResult.error,
    };
  }

  /**
   * Fetch all members for a guild
   * @param {import('discord.js').Guild} guild - Discord guild
   * @returns {Promise<{success: boolean, error?: string, fetched?: number, total?: number, cached?: number, message?: string}>}
   */
  static async fetchMembers(guild) {
    const cachedBefore = guild.members.cache.size;
    const totalMembers = guild.memberCount;

    // For servers > 1000 members, don't attempt to fetch all (too slow/timeout risk)
    if (totalMembers > MAX_MEMBER_FETCH_SERVER_SIZE) {
      logger.debug(
        `[fetchMembers] Server has ${totalMembers} members (exceeds ${MAX_MEMBER_FETCH_SERVER_SIZE} limit) - using cached members only`,
      );
      return {
        success: true,
        fetched: 0,
        total: totalMembers,
        cached: cachedBefore,
        message: "Server too large - using cached members only",
      };
    }

    if (cachedBefore < totalMembers) {
      // Adaptive timeout: larger servers need more time
      // Base timeout + 1ms per member (capped at 30 seconds)
      const adaptiveTimeout = Math.min(
        MEMBER_FETCH_TIMEOUT * 2 + Math.floor(totalMembers / 10),
        30000,
      );

      try {
        const fetchPromise = guild.members.fetch();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Member fetch timed out")),
            adaptiveTimeout,
          );
        });

        await Promise.race([fetchPromise, timeoutPromise]);
        const cachedAfter = guild.members.cache.size;
        logger.debug(`[fetchMembers] Fetched ${cachedAfter} members`);
        return {
          success: true,
          fetched: cachedAfter - cachedBefore,
          total: totalMembers,
          cached: cachedAfter,
        };
      } catch (fetchError) {
        const errorMessage = fetchError.message || "Unknown error";
        if (errorMessage.includes("timed out")) {
          logger.debug(
            `[fetchMembers] Fetch timed out after ${adaptiveTimeout}ms - using cached members`,
          );
          return {
            success: false,
            error: `Member fetch timed out after ${Math.round(adaptiveTimeout / 1000)} seconds. Using cached members only (${cachedBefore}/${totalMembers} cached).`,
            fetched: 0,
            total: totalMembers,
            cached: cachedBefore,
          };
        } else if (
          errorMessage.includes("Missing Access") ||
          errorMessage.includes("GUILD_MEMBERS")
        ) {
          logger.debug(
            `[fetchMembers] Missing GUILD_MEMBERS intent: ${errorMessage}`,
          );
          return {
            success: false,
            error: `Cannot fetch members: Missing GUILD_MEMBERS privileged intent. The bot needs this intent enabled in the Discord Developer Portal to fetch all members. Using cached members only (${cachedBefore}/${totalMembers} cached).`,
            fetched: 0,
            total: totalMembers,
            cached: cachedBefore,
          };
        } else {
          logger.debug(`[fetchMembers] Fetch failed: ${errorMessage}`);
          return {
            success: false,
            error: `Failed to fetch members: ${errorMessage}. Using cached members only (${cachedBefore}/${totalMembers} cached).`,
            fetched: 0,
            total: totalMembers,
            cached: cachedBefore,
          };
        }
      }
    } else {
      // All members already cached
      return {
        success: true,
        fetched: 0,
        total: totalMembers,
        cached: cachedBefore,
        message: "All members already cached",
      };
    }
  }

  /**
   * Handle dynamic data fetching actions (get_role_reaction_messages, get_scheduled_roles, etc.)
   * @param {string} actionType - Action type (e.g., "get_role_reaction_messages")
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} _client - Discord client (unused)
   * @returns {Promise<string|null>} Formatted data string or null if action not handled
   */
  static async handleDynamicDataFetching(actionType, guild, _client) {
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
}

// Export singleton instance for convenience
export const dataFetcher = DataFetcher;
