import { getLogger } from "../logger.js";
import {
  getMemberCounts,
  getChannelCounts,
  calculateServerAge,
  formatFeatures,
} from "../../commands/general/serverinfo/utils.js";
// Simple inline data sanitizer (replaces deleted responseValidator)
const responseValidator = {
  sanitizeData: data => {
    if (typeof data !== "string") return data;
    // Basic sanitization - remove potential sensitive patterns
    return data.replace(/[<>@#&]/g, "").trim();
  },
};

const logger = getLogger();

/**
 * Gathers server and bot information for AI system prompts
 */
export class ServerInfoGatherer {
  /**
   * Get safe server information (no sensitive data)
   * Works universally for any Discord server
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} _client - Discord client (unused)
   * @param {Object} options - Options for server info
   * @param {boolean} options.includeMemberList - Whether to include member guidance (default: true)
   * @returns {Promise<string>} Formatted server information
   */
  async getServerInfo(guild, _client, options = {}) {
    const { includeMemberList = true } = options;
    if (!guild) return "";

    try {
      const memberCounts = getMemberCounts(guild);
      const channelCounts = getChannelCounts(guild);
      const serverAge = calculateServerAge(guild.createdAt);

      let info = `**Server Name:** ${responseValidator.sanitizeData(guild.name)}\n\n`;

      // Basic server info (always available)
      info += `**Server Details:**\n`;
      if (guild.id) {
        info += `- Server ID: ${guild.id}\n`;
      }

      if (guild.createdAt) {
        info += `- Created: ${guild.createdAt.toLocaleDateString()} (${serverAge} ago)\n`;
      }

      // Owner info (may not be available in all cases)
      // IMPORTANT: This is the SERVER OWNER, NOT the bot. The bot is NOT the owner.
      try {
        const owner = guild.members.cache.get(guild.ownerId);
        if (owner?.user?.tag) {
          info += `- Server Owner: ${owner.user.tag} (this is the human who owns the server, NOT the bot)\n`;
        }
      } catch (_error) {
        // Owner info not available, skip
      }
      info += `\n`;

      // Member statistics (handle cases where data might be limited)
      if (memberCounts) {
        info += `**Member Statistics:**\n`;
        // Emphasize human members - when asked "how many members", use THIS number
        if (memberCounts.humans !== undefined) {
          info += `- **Human Members:** ${memberCounts.humans} (use this when asked "how many members")\n`;
        }
        if (memberCounts.total !== undefined) {
          info += `- Total (including bots): ${memberCounts.total}`;
          if (memberCounts.bots !== undefined) {
            info += ` (${memberCounts.bots} bots)`;
          }
          info += `\n`;
        }

        // Presence data (may be limited without GUILD_PRESENCES intent)
        // IMPORTANT: These counts are for HUMAN MEMBERS ONLY (not bots)
        if (
          memberCounts.online !== undefined ||
          memberCounts.idle !== undefined
        ) {
          const online = memberCounts.online || 0;
          const idle = memberCounts.idle || 0;
          const dnd = memberCounts.dnd || 0;
          const totalOnline = online + idle + dnd;
          info += `- **Online Status (Human Members Only):** Online: ${online}, Idle: ${idle}, DND: ${dnd}, Offline: ${memberCounts.offline || 0}\n`;
          info += `- **Total Online:** ${totalOnline} (Online + Idle + DND - use this when asked "how many are online")\n`;
        }
        info += `\n`;
      }

      // Member information - Guide users to Discord's built-in features instead of fetching
      if (includeMemberList) {
        info += `**Member Information:**\n`;
        info += `**IMPORTANT:** For member lists, names, and status - guide users to Discord's built-in features:\n`;
        info += `- **Member List:** Check the right sidebar for all members with live status indicators\n`;
        info += `- **Search Members:** Press Ctrl+K (Cmd+K on Mac) to search for specific users\n`;
        info += `- **Online Status:** 🟢 Online, 🟡 Idle, 🔴 Do Not Disturb, ⚫ Offline\n`;
        info += `- **Role Members:** Server Settings → Roles → Click any role to see its members\n`;
        info += `- **Member Profiles:** Click any member to see their profile, roles, and join date\n`;
        info += `\n`;
        info += `**Why Discord's features are better:**\n`;
        info += `- ✅ Always up-to-date (real-time)\n`;
        info += `- ✅ Shows live status changes\n`;
        info += `- ✅ Includes all members (no limits)\n`;
        info += `- ✅ Interactive (click for profiles)\n`;
        info += `- ✅ Fast and reliable\n`;
        info += `\n`;
      }

      // Channel information
      if (channelCounts) {
        info += `**Server Channels:**\n`;
        info += `- Total Channels: ${channelCounts.total || 0}\n`;
        if (channelCounts.text !== undefined) {
          info += `- Text Channels: ${channelCounts.text}\n`;
        }
        if (channelCounts.voice !== undefined) {
          info += `- Voice Channels: ${channelCounts.voice}\n`;
        }
        if (channelCounts.forum !== undefined && channelCounts.forum > 0) {
          info += `- Forum Channels: ${channelCounts.forum}\n`;
        }
        if (channelCounts.stage !== undefined && channelCounts.stage > 0) {
          info += `- Stage Channels: ${channelCounts.stage}\n`;
        }
        info += `\n`;

        // List channel names (limited to prevent token bloat)
        try {
          const channels = Array.from(guild.channels.cache.values())
            .filter(c => c && c.name)
            .map(c => ({
              name: responseValidator.sanitizeData(c.name),
              type: c.type,
            }))
            .slice(0, 30); // Limit to 30 channels

          if (channels.length > 0) {
            info += `**Channel Names (first 30):**\n`;
            const typeMap = {
              0: "TEXT",
              2: "VOICE",
              4: "CATEGORY",
              5: "NEWS",
              10: "NEWS_THREAD",
              11: "PUBLIC_THREAD",
              12: "PRIVATE_THREAD",
              13: "STAGE",
              15: "FORUM",
            };
            channels.forEach(channel => {
              const typeName = typeMap[channel.type] || "UNKNOWN";
              info += `- #${channel.name} (${typeName})\n`;
            });
            if (guild.channels.cache.size > 30) {
              info += `- ... and ${guild.channels.cache.size - 30} more channels\n`;
            }
            info += `\n`;
          }
        } catch (error) {
          logger.debug("Error listing channels:", error);
        }
      }

      // Role information
      try {
        const roles = Array.from(guild.roles.cache.values())
          .filter(role => role && role.name && role.name !== "@everyone")
          .map(role => ({
            name: responseValidator.sanitizeData(role.name),
            members: role.members?.size || 0,
            color: role.color
              ? `#${role.color.toString(16).padStart(6, "0")}`
              : null,
          }))
          .sort((a, b) => b.members - a.members) // Sort by member count
          .slice(0, 30); // Limit to 30 roles

        if (roles.length > 0) {
          info += `**Server Roles (first 30, sorted by member count):**\n`;
          roles.forEach(role => {
            let roleInfo = `- ${role.name}`;
            if (role.members > 0) {
              roleInfo += ` (${role.members} ${role.members === 1 ? "member" : "members"})`;
            }
            if (role.color) {
              roleInfo += ` [Color: ${role.color}]`;
            }
            info += `${roleInfo}\n`;
          });
          if (guild.roles.cache.size > 31) {
            // +1 for @everyone
            info += `- ... and ${guild.roles.cache.size - 31} more roles\n`;
          }
          info += `\n`;
        }
      } catch (error) {
        logger.debug("Error listing roles:", error);
      }

      // Server features
      try {
        if (guild.features && guild.features.length > 0) {
          const features = formatFeatures(guild.features);
          if (features && features !== "None") {
            info += `**Server Features:**\n`;
            info += `- ${features}\n`;
            info += `\n`;
          }
        }
      } catch (error) {
        logger.debug("Error listing features:", error);
      }

      // Verification level
      try {
        if (guild.verificationLevel !== undefined) {
          const verificationLevels = {
            0: "None",
            1: "Low",
            2: "Medium",
            3: "High",
            4: "Very High",
          };
          const level =
            verificationLevels[guild.verificationLevel] ||
            `Level ${guild.verificationLevel}`;
          info += `**Verification Level:** ${level}\n`;
          info += `\n`;
        }
      } catch (error) {
        logger.debug("Error getting verification level:", error);
      }

      // Age-restricted content level
      try {
        if (guild.nsfwLevel !== undefined) {
          const nsfwLevels = {
            0: "Default",
            1: "Explicit",
            2: "Safe",
            3: "Age Restricted",
          };
          const level =
            nsfwLevels[guild.nsfwLevel] || `Level ${guild.nsfwLevel}`;
          info += `**NSFW Level:** ${level}\n`;
          info += `\n`;
        }
      } catch (error) {
        logger.debug("Error getting NSFW level:", error);
      }

      // Server description (if available)
      try {
        if (guild.description) {
          const safeDesc = responseValidator.sanitizeData(guild.description);
          if (safeDesc && safeDesc.length > 0) {
            info += `**Server Description:**\n`;
            info += `${safeDesc}\n`;
            info += `\n`;
          }
        }
      } catch (error) {
        logger.debug("Error getting description:", error);
      }

      return info;
    } catch (error) {
      logger.error("Error building server info:", error);
      return `**Server Information:**\nError retrieving server information.\n\n`;
    }
  }

  /**
   * Get bot information for system prompt
   * @param {import('discord.js').Client} client - Discord client
   * @returns {Promise<string>} Bot information string
   */
  async getBotInfo(client) {
    if (!client || !client.user) return "";

    try {
      const configModule = await import("../../config/config.js").catch(
        () => null,
      );
      const config = configModule?.default || configModule || {};
      const externalLinks = config.externalLinks || {};

      let info = `Bot Information:\n`;

      // Basic bot info (always available)
      if (client.user.username) {
        info += `- Name: ${client.user.username}\n`;
      }

      if (client.user.tag) {
        info += `- Tag: ${client.user.tag}\n`;
      }

      // Website and links information
      if (externalLinks.website) {
        info += `- Website: ${externalLinks.website}\n`;
      }
      if (externalLinks.guide) {
        info += `- Documentation: ${externalLinks.guide}\n`;
      }
      if (externalLinks.github) {
        info += `- GitHub: ${externalLinks.github}\n`;
      }
      if (externalLinks.support) {
        info += `- Support Server: ${externalLinks.support}\n`;
      }

      // Server count (may vary)
      try {
        const serverCount = client.guilds?.cache?.size || 0;
        if (serverCount > 0) {
          info += `- Servers: ${serverCount}\n`;
        }
      } catch (_error) {
        // Server count not available, skip
      }

      // Uptime (optional, may not be available immediately)
      try {
        if (client.uptime && client.uptime > 0) {
          const uptimeSeconds = Math.floor(client.uptime / 1000);
          const hours = Math.floor(uptimeSeconds / 3600);
          const minutes = Math.floor((uptimeSeconds % 3600) / 60);
          if (hours > 0 || minutes > 0) {
            info += `- Uptime: ${hours}h ${minutes}m\n`;
          }
        }
      } catch (_error) {
        // Uptime not available, skip
      }

      // Ping (optional, requires websocket connection)
      try {
        if (client.ws?.ping !== undefined && client.ws.ping > 0) {
          info += `- Latency: ${client.ws.ping}ms\n`;
        }
      } catch (_error) {
        // Ping not available, skip
      }

      info += `\n`;

      return info;
    } catch (error) {
      logger.error("Error building bot info:", error);
      // Return minimal safe info if there's an error
      return `Bot: Role Reactor\n\n`;
    }
  }
}

export const serverInfoGatherer = new ServerInfoGatherer();
