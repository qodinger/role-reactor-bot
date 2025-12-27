import { getLogger } from "../logger.js";
import {
  getMemberCounts,
  getChannelCounts,
  calculateServerAge,
  formatFeatures,
} from "../../commands/general/serverinfo/utils.js";
import { responseValidator } from "./responseValidator.js";
import {
  MEMBER_FETCH_TIMEOUT,
  MAX_MEMBER_FETCH_SERVER_SIZE,
  MAX_MEMBERS_TO_DISPLAY,
} from "./constants.js";

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
   * @param {boolean} options.includeMemberList - Whether to include full member list (default: true)
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
          info += `🚨 **ANSWER: There are ${memberCounts.humans} human members in this server.**\n`;
          info += `- When asked "how many members", ALWAYS use this number: **${memberCounts.humans}**\n`;
        }
        if (memberCounts.total !== undefined) {
          info += `- Total Members (including bots): ${memberCounts.total}`;
          if (memberCounts.bots !== undefined) {
            info += ` (${memberCounts.bots} bots)`;
          }
          info += ` - DO NOT use this number when asked about "members"\n`;
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
          const offline = memberCounts.offline || 0;
          info += `🚨 **CRITICAL: When asked "how many are online" or "who is online", use these HUMAN MEMBER counts (NOT including bots):**\n`;
          info += `- **Online (Human Members):** ${online}\n`;
          info += `- **Idle (Human Members):** ${idle}\n`;
          info += `- **DND (Human Members):** ${dnd}\n`;
          info += `- **Offline (Human Members):** ${offline}\n`;
          info += `- **Total Online (Human Members):** ${online + idle + dnd} (Online + Idle + DND)\n`;
          info += `- When asked "how many members are online", answer: **${online + idle + dnd}** (or just ${online} if they specifically ask for "online" status)\n`;
          if (memberCounts.botsOnline !== undefined) {
            info += `- Bots online: ${memberCounts.botsOnline} (do NOT include in "members online" count)\n`;
          }
        }
        info += `\n`;
      }

      // Member names - Only fetch if needed (can be slow for large servers)
      // IMPORTANT: This section MUST be used when asked for member names
      if (includeMemberList) {
        try {
          let membersCollection = guild.members.cache;
          const cachedBeforeFetch = membersCollection.size;
          const totalMembers = guild.memberCount;
          let allMembersFetched = false;

          // If we don't have all members cached, try to fetch them
          // For servers > 1000 members, only use cached members (fetching all is too slow)
          if (
            cachedBeforeFetch < totalMembers &&
            totalMembers <= MAX_MEMBER_FETCH_SERVER_SIZE
          ) {
            try {
              logger.debug(
                `[getServerInfo] Fetching members: ${cachedBeforeFetch}/${totalMembers} cached`,
              );
              const fetchPromise = guild.members.fetch();
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(
                  () => reject(new Error("Member fetch timed out")),
                  MEMBER_FETCH_TIMEOUT,
                );
              });

              await Promise.race([fetchPromise, timeoutPromise]);
              membersCollection = guild.members.cache;
              allMembersFetched = membersCollection.size >= totalMembers * 0.95; // 95% threshold
              logger.debug(
                `[getServerInfo] Fetched members: ${membersCollection.size}/${totalMembers} (${allMembersFetched ? "complete" : "partial"})`,
              );
            } catch (fetchError) {
              if (fetchError.message?.includes("timed out")) {
                logger.debug(
                  `[getServerInfo] Member fetch timed out - using cached members`,
                );
              } else if (fetchError.message?.includes("Missing Access")) {
                logger.debug(
                  `[getServerInfo] Missing GUILD_MEMBERS intent - using cached members`,
                );
              } else {
                logger.debug(
                  `[getServerInfo] Failed to fetch members: ${fetchError.message} - using cached`,
                );
              }
              // Continue with cached members
              membersCollection = guild.members.cache;
            }
          } else if (cachedBeforeFetch >= totalMembers) {
            allMembersFetched = true;
          } else if (totalMembers > MAX_MEMBER_FETCH_SERVER_SIZE) {
            // Server too large - only use cached members
            logger.debug(
              `[getServerInfo] Server has ${totalMembers} members (exceeds ${MAX_MEMBER_FETCH_SERVER_SIZE} limit) - using cached members only`,
            );
            allMembersFetched = false; // Mark as partial since we can't fetch all
          }

          if (membersCollection && membersCollection.size > 0) {
            // Get human members only (exclude bots)
            // Double-check bot status: check both member.user.bot and application flags
            const humanMembersWithStatus = Array.from(
              membersCollection.values(),
            )
              .filter(member => {
                if (!member || !member.user) return false;
                // Exclude if marked as bot
                if (member.user.bot) return false;
                // Exclude if has bot tag (application flag)
                if (member.user.flags?.has?.("BotHTTPInteractions"))
                  return false;
                // Additional check: exclude common bot name patterns
                const username = member.user.username?.toLowerCase() || "";
                const displayName = member.displayName?.toLowerCase() || "";
                const nameToCheck = displayName || username;
                // Exclude if name contains common bot indicators
                if (
                  nameToCheck.includes("bot") ||
                  nameToCheck.includes("chatgpt") ||
                  nameToCheck.includes("gpt") ||
                  nameToCheck.includes("[bot]") ||
                  nameToCheck.includes("(bot)")
                ) {
                  // But allow if it's clearly a human (e.g., "ChatGPT User" vs "ChatGPT Bot")
                  // Only exclude if it's clearly a bot name pattern
                  if (
                    nameToCheck.startsWith("bot") ||
                    nameToCheck.endsWith("bot") ||
                    nameToCheck.includes("chatgpt") ||
                    nameToCheck.includes("gpt-")
                  ) {
                    return false;
                  }
                }
                return true;
              })
              .map(member => {
                // Use displayName if available, otherwise username
                const name =
                  member.displayName || member.user?.username || "Unknown";
                const sanitizedName = responseValidator.sanitizeData(name);

                // Get presence status (if available)
                const presence = member.presence;
                const status = presence?.status || "offline"; // "online", "idle", "dnd", "offline"

                return {
                  name: sanitizedName,
                  status,
                };
              })
              .filter(({ name }) => name && name !== "Unknown")
              .slice(0, MAX_MEMBERS_TO_DISPLAY);

            logger.debug(
              `[getServerInfo] Human members found: ${humanMembersWithStatus.length} (${allMembersFetched ? "complete" : "partial"})`,
            );

            if (humanMembersWithStatus.length > 0) {
              info += `**COMPLETE LIST OF HUMAN MEMBER NAMES (with online status):**\n`;
              info += `🚨 **CRITICAL: When asked for member names, use ONLY the names from this list. NEVER invent, guess, or make up member names.**\n`;
              info += `🚨 **Status meanings:** 🟢 online, 🟡 idle, 🔴 dnd (Do Not Disturb - user is ONLINE but set to Do Not Disturb), ⚫ offline\n`;
              info += `🚨 **IMPORTANT: "dnd" (Do Not Disturb) is NOT offline - it means the user is online but has set their status to Do Not Disturb.**\n`;
              info += `🚨 **IMPORTANT: This list contains ONLY human members - bots are already excluded. Do NOT add any bots to your response.**\n`;
              if (!allMembersFetched) {
                const totalHumanMembers = memberCounts?.humans || "unknown";
                if (totalMembers > MAX_MEMBER_FETCH_SERVER_SIZE) {
                  info += `⚠️ Note: Server has ${totalMembers} members (exceeds ${MAX_MEMBER_FETCH_SERVER_SIZE} limit). Showing first ${humanMembersWithStatus.length} cached human members (of ${totalHumanMembers} total). For complete list, use /serverinfo command.\n`;
                } else {
                  info += `⚠️ Note: This is a partial list (${humanMembersWithStatus.length} of ${totalHumanMembers} members shown due to cache limits)\n`;
                }
              }
              info += `\n`;
              // Provide structured data - AI can format it naturally
              humanMembersWithStatus.forEach(member => {
                const statusEmoji =
                  {
                    online: "🟢",
                    idle: "🟡",
                    dnd: "🔴",
                    offline: "⚫",
                  }[member.status] || "⚫";
                info += `- ${member.name} ${statusEmoji} (${member.status})\n`;
              });
              info += `\n`;
            } else {
              info += `**COMPLETE LIST OF HUMAN MEMBER NAMES:**\n`;
              info += `- No human members found in cache\n`;
              info += `- This may be due to cache limitations or server permissions\n`;
              info += `\n`;
            }

            // Get bot members (for reference, but not included in "members" count)
            const botMembers = Array.from(membersCollection.values())
              .filter(member => member && member.user && member.user.bot)
              .map(member => {
                const name =
                  member.displayName || member.user?.username || "Unknown";
                return responseValidator.sanitizeData(name);
              })
              .filter(name => name && name !== "Unknown")
              .slice(0, MAX_MEMBERS_TO_DISPLAY);

            if (botMembers.length > 0) {
              info += `**COMPLETE LIST OF BOT NAMES:**\n`;
              info += `🚨 **CRITICAL: These are Discord BOTS, NOT human members.**\n`;
              info += `- When user asks for "members", "users", or "people" = Use HUMAN MEMBER list above, NOT this bot list\n`;
              info += `- When user asks for "bots" or "discord bots" = Use THIS bot list\n`;
              info += `- Understand user intent: "members" = humans, "bots" = Discord bots\n`;
              info += `\n`;
              botMembers.forEach((name, index) => {
                info += `${index + 1}. ${name} [BOT]\n`;
              });
              info += `\n`;
            }
          } else {
            info += `**COMPLETE LIST OF HUMAN MEMBER NAMES:**\n`;
            info += `- No members found in cache\n`;
            info += `- This may be due to cache limitations or server permissions\n`;
            info += `\n`;
          }
        } catch (error) {
          logger.debug("Error fetching member names:", error);
          info += `**COMPLETE LIST OF HUMAN MEMBER NAMES:**\n`;
          info += `- Error fetching member list: ${error.message}\n`;
          info += `\n`;
        }
      } else {
        // Skip member list for faster responses - can use fetch_members action if needed
        info += `**Member Names:**\n`;
        info += `- Use "fetch_members" action to get complete member list when needed\n`;
        info += `- Current cached: ${memberCounts?.humans || 0} human members\n\n`;
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

      // NSFW level
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
      const config = (await import("../../config/config.js")).default;
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
