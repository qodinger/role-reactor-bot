import { getStorageManager } from "../storage/storageManager.js";
import { getDatabaseManager } from "../storage/databaseManager.js";
import { getLogger } from "../logger.js";
import { EmbedBuilder } from "discord.js";
import { THEME } from "../../config/theme.js";
import { enforceVoiceRestrictions } from "./voiceRestrictions.js";

/**
 * Send DM notification to user about role assignment
 * @param {import("discord.js").GuildMember} member - The guild member
 * @param {import("discord.js").Role} role - The role that was assigned
 * @param {Date} expiresAt - When the role expires
 * @param {import("discord.js").Guild} guild - The guild where the role was assigned
 */
async function sendAssignmentNotification(member, role, expiresAt, guild) {
  const embed = new EmbedBuilder()
    .setColor(role.color || THEME.SUCCESS)
    .setTitle("Role Assignment Notification")
    .setDescription(
      `You have been assigned the **${role.name}** role in **${guild.name}**`,
    )
    .addFields([
      {
        name: "Duration",
        value: `${formatDurationMs(expiresAt.getTime() - Date.now())} • Expires <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
        inline: false,
      },
    ])
    .setFooter({
      text: `Role Reactor • ${guild.name}`,
    })
    .setTimestamp();

  await member.user.send({ embeds: [embed] });
}

/**
 * Send DM notification to user about role removal
 * @param {import("discord.js").GuildMember} member - The guild member
 * @param {import("discord.js").Role} role - The role that was removed
 * @param {import("discord.js").Guild} guild - The guild where the role was removed
 * @param {string} reason - Reason for removal
 * @param {import("discord.js").User} removedBy - User who removed the role
 */
export async function sendRemovalNotification(
  member,
  role,
  guild,
  reason,
  removedBy,
) {
  const embed = new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle("Role Removal Notification")
    .setDescription(
      `Your **${role.name}** role has been removed from **${guild.name}**`,
    )
    .addFields([
      {
        name: "Removed by",
        value: `${removedBy.username}`,
        inline: true,
      },
      {
        name: "Reason",
        value: reason || "No reason provided",
        inline: true,
      },
      {
        name: "Timestamp",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ])
    .setFooter({
      text: `Role Reactor • ${guild.name}`,
    })
    .setTimestamp();

  try {
    await member.user.send({ embeds: [embed] });
  } catch (error) {
    // Log but don't throw - DM failures shouldn't break the removal process
    const logger = getLogger();
    logger.warn(
      `Failed to send removal notification to user ${member.id}:`,
      error,
    );
  }
}

/**
 * Format duration in milliseconds to human readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDurationMs(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Adds a temporary role to a user.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} roleId
 * @param {Date} expiresAt
 * @param {import("discord.js").Client} [client] Discord client for role assignment
 * @param {boolean} [notifyExpiry] Whether to send DM when role expires
 * @returns {Promise<boolean>}
 */
export async function addTemporaryRole(
  guildId,
  userId,
  roleId,
  expiresAt,
  client = null,
  notifyExpiry = false,
) {
  const logger = getLogger();
  try {
    // First, try to assign the Discord role to the user
    try {
      // Get the guild and member
      const guild = client?.guilds?.cache?.get(guildId);
      if (!guild) {
        logger.error(
          `Guild ${guildId} not found for temporary role assignment`,
        );
        return false;
      }

      const member = await guild.members.fetch(userId);
      if (!member) {
        logger.error(`Member ${userId} not found in guild ${guildId}`);
        return false;
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        logger.error(`Role ${roleId} not found in guild ${guildId}`);
        return false;
      }

      // Check if user already has the role
      if (member.roles.cache.has(roleId)) {
        logger.info(`User ${userId} already has role ${role.name}`);
        // Don't return early - still need to store in database
      }

      // Assign the role only if user doesn't already have it
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(
          role,
          `Temporary role assignment - expires at ${expiresAt.toISOString()}`,
        );
        logger.info(
          `✅ Successfully assigned temporary role ${role.name} to user ${userId}`,
        );

        // Enforce voice restrictions if user is in a voice channel
        if (member.voice?.channel) {
          try {
            // Refresh member to ensure we have latest roles
            await member.fetch();

            const result = await enforceVoiceRestrictions(
              member,
              `Temporary role assignment: ${role.name}`,
            );

            if (result.disconnected) {
              logger.info(
                `🚫 Disconnected ${member.user.tag} from voice channel due to temporary role "${role.name}" (Connect disabled)`,
              );
            } else if (result.muted) {
              logger.info(
                `🔇 Muted ${member.user.tag} in voice channel due to temporary role "${role.name}" (Speak disabled)`,
              );
            } else if (result.error) {
              logger.warn(
                `⚠️ Failed to enforce voice restrictions for ${member.user.tag}: ${result.error}`,
              );
            }
          } catch (voiceError) {
            logger.warn(
              `Failed to enforce voice restrictions for ${member.user.tag}:`,
              voiceError.message,
            );
          }
        }
      } else {
        logger.info(
          `✅ User ${userId} already has role ${role.name}, skipping Discord assignment`,
        );
      }
    } catch (discordError) {
      logger.error(
        `Failed to assign Discord role to user ${userId}:`,
        discordError,
      );
      // If Discord assignment fails, don't store in database
      return false;
    }

    // Only store in database if Discord assignment succeeded
    const storageManager = await getStorageManager();
    const storageResult = await storageManager.addTemporaryRole(
      guildId,
      userId,
      roleId,
      expiresAt,
      notifyExpiry,
    );

    if (!storageResult) {
      logger.error(
        `Failed to store temporary role in database for user ${userId}`,
      );
      // If storage fails, we should remove the Discord role we just assigned
      try {
        const guild = client?.guilds?.cache?.get(guildId);
        if (guild) {
          const member = await guild.members.fetch(userId);
          const role = guild.roles.cache.get(roleId);
          if (member && role) {
            await member.roles.remove(
              role,
              "Failed to store temporary role in database",
            );
            logger.info(
              `Removed Discord role ${role.name} from user ${userId} due to storage failure`,
            );
          }
        }
      } catch (cleanupError) {
        logger.error(
          "Failed to cleanup Discord role after storage failure:",
          cleanupError,
        );
      }
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Failed to add temporary role", error);
    return false;
  }
}

/**
 * Adds temporary roles for multiple users efficiently.
 * @param {string} guildId - The guild ID
 * @param {Array<string>} userIds - Array of user IDs
 * @param {string} roleId - The role ID to assign
 * @param {Date} expiresAt - When the role should expire
 * @param {Object} client - Discord client instance
 * @param {boolean} notify - Whether to send immediate DM notification
 * @param {boolean} notifyExpiry - Whether to notify on expiry
 * @returns {Promise<{success: number, failed: number, results: Array}>}
 */
export async function addTemporaryRolesForMultipleUsers(
  guildId,
  userIds,
  roleId,
  expiresAt,
  client = null,
  notify = false,
  notifyExpiry = false,
) {
  const logger = getLogger();
  const results = [];
  let successCount = 0;
  let failedCount = 0;

  // Maximum users per assignment to prevent abuse and ensure good UX
  const MAX_USERS = 10;

  try {
    // Validate user count
    if (userIds.length > MAX_USERS) {
      logger.warn(
        `Too many users requested: ${userIds.length} (max: ${MAX_USERS})`,
      );
      return {
        success: 0,
        failed: userIds.length,
        results: [
          {
            userId: "system",
            success: false,
            error: `Too many users. Maximum allowed: ${MAX_USERS}, requested: ${userIds.length}`,
          },
        ],
        error: `Too many users. Maximum allowed: ${MAX_USERS}, requested: ${userIds.length}`,
      };
    }

    // Get the guild and role once
    const guild = client?.guilds?.cache?.get(guildId);
    if (!guild) {
      logger.error(`Guild ${guildId} not found for temporary role assignment`);
      return { success: 0, failed: userIds.length, results: [] };
    }

    const role = guild.roles.cache.get(roleId);
    if (!role) {
      logger.error(`Role ${roleId} not found in guild ${guildId}`);
      return { success: 0, failed: userIds.length, results: [] };
    }

    // Process users in batches to respect rate limits
    const batchSize = 5; // Discord API rate limit
    const batchDelay = 100; // 100ms between batches

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      logger.info(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(userIds.length / batchSize)}`,
        {
          batchSize: batch.length,
          totalUsers: userIds.length,
          currentBatch: batch,
        },
      );

      // Process batch in parallel
      const batchPromises = batch.map(async userId => {
        try {
          const member = await guild.members.fetch(userId);
          if (!member) {
            logger.error(`User ${userId} not found in guild ${guildId}`);
            return { userId, success: false, error: "User not found" };
          }

          // Check if user already has the role
          if (member.roles.cache.has(roleId)) {
            logger.info(`User ${userId} already has role ${role.name}`);
            return { userId, success: true, message: "Already has role" };
          }

          // Assign the role
          await member.roles.add(
            role,
            `Temporary role assignment - expires at ${expiresAt.toISOString()}`,
          );
          logger.info(
            `✅ Successfully assigned temporary role ${role.name} to user ${userId}`,
          );

          // Enforce voice restrictions if user is in a voice channel
          if (member.voice?.channel) {
            try {
              // Refresh member to ensure we have latest roles
              await member.fetch();

              const result = await enforceVoiceRestrictions(
                member,
                `Temporary role assignment: ${role.name}`,
              );

              if (result.disconnected) {
                logger.info(
                  `🚫 Disconnected ${member.user.tag} from voice channel due to temporary role "${role.name}" (Connect disabled)`,
                );
              } else if (result.muted) {
                logger.info(
                  `🔇 Muted ${member.user.tag} in voice channel due to temporary role "${role.name}" (Speak disabled)`,
                );
              } else if (result.error) {
                logger.warn(
                  `⚠️ Failed to enforce voice restrictions for ${member.user.tag}: ${result.error}`,
                );
              }
            } catch (voiceError) {
              logger.warn(
                `Failed to enforce voice restrictions for ${member.user.tag}:`,
                voiceError.message,
              );
            }
          }

          // Send immediate DM notification if requested
          if (notify) {
            try {
              await sendAssignmentNotification(member, role, expiresAt, guild);
              logger.info(
                `📧 Sent assignment notification to ${member.user.tag}`,
              );
            } catch (dmError) {
              logger.warn(
                `Failed to send assignment notification to ${member.user.tag}:`,
                dmError.message,
              );
            }
          }

          return { userId, success: true, message: "Role assigned" };
        } catch (discordError) {
          logger.error(
            `Failed to assign Discord role to user ${userId}:`,
            discordError,
          );
          return { userId, success: false, error: discordError.message };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Count successes and failures
      for (const result of batchResults) {
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
        }
      }

      // Add delay between batches (except for the last batch)
      if (i + batchSize < userIds.length) {
        await new Promise(resolve => {
          setTimeout(resolve, batchDelay);
        });
      }
    }

    // Store in database only if at least one user succeeded
    if (successCount > 0) {
      const dbManager = await getDatabaseManager();
      if (dbManager) {
        try {
          // Create a single document with userIds array
          await dbManager.temporaryRoles.addMultiple(
            guildId,
            userIds.filter((_, index) => results[index]?.success),
            roleId,
            expiresAt,
            notifyExpiry,
          );
          logger.info(
            `✅ Successfully stored temporary role assignment for ${successCount} users in database`,
          );
        } catch (dbError) {
          logger.error("Failed to store temporary roles in database:", dbError);
          // If database storage fails, we should remove the Discord roles we just assigned
          for (const result of results) {
            if (result.success) {
              try {
                const member = await guild.members.fetch(result.userId);
                if (member) {
                  await member.roles.remove(
                    role,
                    `Failed to store temporary role in database`,
                  );
                  logger.info(
                    `Removed Discord role ${role.name} from user ${result.userId} due to storage failure`,
                  );
                }
              } catch (removeError) {
                logger.error(
                  `Failed to remove Discord role after storage failure:`,
                  removeError,
                );
              }
            }
          }
          return { success: 0, failed: userIds.length, results };
        }
      } else {
        // Fallback to individual storage
        const storageManager = await getStorageManager();
        for (const result of results) {
          if (result.success) {
            await storageManager.addTemporaryRole(
              guildId,
              result.userId,
              roleId,
              expiresAt,
              notifyExpiry,
            );
          }
        }
      }
    }

    return { success: successCount, failed: failedCount, results };
  } catch (error) {
    logger.error("Failed to add temporary roles for multiple users", error);
    return { success: 0, failed: userIds.length, results: [] };
  }
}

/**
 * Removes a temporary role from a user.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} roleId
 * @returns {Promise<boolean>}
 */
export async function removeTemporaryRole(guildId, userId, roleId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    return await storageManager.removeTemporaryRole(guildId, userId, roleId);
  } catch (error) {
    logger.error("Failed to remove temporary role", error);
    return false;
  }
}

/**
 * Gets temporary roles for a specific user in a guild.
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getUserTemporaryRoles(guildId, userId) {
  const logger = getLogger();
  try {
    const dbManager = await getDatabaseManager();
    if (dbManager) {
      // Read from database first
      const allTempRoles = await dbManager.temporaryRoles.getAll();
      return Object.values(allTempRoles).filter(
        role => role.guildId === guildId && role.userId === userId,
      );
    } else {
      // Fallback to file storage if database not available
      const storageManager = await getStorageManager();
      const tempRoles = await storageManager.getTemporaryRoles();
      const userRoles = tempRoles[guildId]?.[userId] || {};

      // Convert to array format
      const rolesArray = [];
      for (const [roleId, roleData] of Object.entries(userRoles)) {
        rolesArray.push({
          guildId,
          userId,
          roleId,
          expiresAt: roleData.expiresAt,
          notifyExpiry: roleData.notifyExpiry || false,
        });
      }

      return rolesArray;
    }
  } catch (error) {
    logger.error("Failed to get user temporary roles", error);
    return [];
  }
}

/**
 * Gets all temporary roles for a guild.
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
export async function getTemporaryRoles(guildId) {
  const logger = getLogger();
  try {
    const dbManager = await getDatabaseManager();
    if (dbManager) {
      // Read from database first
      // The database returns an object where keys are guildIds and values are user role data
      const allTempRolesByGuild = await dbManager.temporaryRoles.getAll();
      logger.info("Retrieved temporary roles from database", {
        totalGuilds: Object.keys(allTempRolesByGuild).length,
        guildIds: Object.keys(allTempRolesByGuild),
        targetGuildId: guildId,
      });

      // Get the roles for this specific guild
      const guildTempRoles = allTempRolesByGuild[guildId] || {};

      // Convert to array format expected by the command
      const rolesArray = [];
      for (const [userId, userRoles] of Object.entries(guildTempRoles)) {
        for (const [roleId, roleData] of Object.entries(userRoles)) {
          rolesArray.push({
            guildId,
            userId,
            roleId,
            expiresAt: roleData.expiresAt,
            notifyExpiry: roleData.notifyExpiry || false,
          });
        }
      }

      logger.info("Processed temporary roles for guild", {
        guildId,
        totalRoles: rolesArray.length,
        roles: rolesArray.map(r => ({
          userId: r.userId,
          roleId: r.roleId,
          expiresAt: r.expiresAt,
        })),
      });

      return rolesArray;
    } else {
      // Fallback to file storage if database not available
      const storageManager = await getStorageManager();
      const tempRoles = await storageManager.getTemporaryRoles();

      const guildRoles = tempRoles[guildId] || {};

      // Convert to array format expected by the command
      const rolesArray = [];
      for (const [userId, userRoles] of Object.entries(guildRoles)) {
        for (const [roleId, roleData] of Object.entries(userRoles)) {
          rolesArray.push({
            guildId,
            userId,
            roleId,
            expiresAt: roleData.expiresAt,
            notifyExpiry: roleData.notifyExpiry || false,
          });
        }
      }

      return rolesArray;
    }
  } catch (error) {
    logger.error("Failed to get temporary roles for guild", error);
    return [];
  }
}

/**
 * Parses a duration string (e.g., "1h30m") into milliseconds.
 * @param {string} durationStr
 * @returns {number|null}
 */
export function parseDuration(durationStr) {
  const regex = /(\d+)\s*(w|d|h|m)/g;
  let totalMs = 0;
  let match;
  while ((match = regex.exec(durationStr)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case "w":
        totalMs += value * 7 * 24 * 60 * 60 * 1000;
        break;
      case "d":
        totalMs += value * 24 * 60 * 60 * 1000;
        break;
      case "h":
        totalMs += value * 60 * 60 * 1000;
        break;
      case "m":
        totalMs += value * 60 * 1000;
        break;
    }
  }
  return totalMs > 0 ? totalMs : null;
}

/**
 * Formats a duration string into a human-readable format.
 * @param {string} durationStr
 * @returns {string}
 */
export function formatDuration(durationStr) {
  const ms = parseDuration(durationStr);
  if (!ms) return "Invalid duration";

  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  return parts.join(", ");
}

/**
 * Formats the remaining time until a date.
 * @param {Date|string} expiresAt
 * @returns {string}
 */
export function formatRemainingTime(expiresAt) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);

  let remaining = "";
  if (days > 0) remaining += `${days}d `;
  if (hours > 0) remaining += `${hours}h `;
  if (minutes > 0) remaining += `${minutes}m`;
  return remaining.trim() || "Less than a minute";
}

/**
 * Adds a supporter role to a user (permanent supporter role).
 * @param {string} guildId
 * @param {string} userId
 * @param {string} roleId
 * @param {Date} assignedAt
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
export async function addSupporter(
  guildId,
  userId,
  roleId,
  assignedAt,
  reason,
) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const supporters = await storageManager.getSupporters();

    if (!supporters[guildId]) {
      supporters[guildId] = {};
    }

    supporters[guildId][userId] = {
      roleId,
      assignedAt: assignedAt.toISOString(),
      reason,
      isActive: true,
    };

    await storageManager.setSupporters(supporters);
    logger.info(`Added supporter role for user ${userId} in guild ${guildId}`);
    return true;
  } catch (error) {
    logger.error("Failed to add supporter role", error);
    return false;
  }
}

/**
 * Removes a supporter role from a user.
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function removeSupporter(guildId, userId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const supporters = await storageManager.getSupporters();

    if (supporters[guildId]?.[userId]) {
      delete supporters[guildId][userId];
      await storageManager.setSupporters(supporters);
      logger.info(
        `Removed supporter role for user ${userId} in guild ${guildId}`,
      );
      return true;
    }

    return false;
  } catch (error) {
    logger.error("Failed to remove supporter role", error);
    return false;
  }
}

/**
 * Gets all supporters for a guild.
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
export async function getSupporters(guildId) {
  const logger = getLogger();
  try {
    const storageManager = await getStorageManager();
    const supporters = await storageManager.getSupporters();
    const guildSupporters = supporters[guildId] || {};

    return Object.entries(guildSupporters).map(([userId, data]) => ({
      userId,
      roleId: data.roleId,
      assignedAt: new Date(data.assignedAt),
      reason: data.reason,
      isActive: data.isActive,
    }));
  } catch (error) {
    logger.error("Failed to get supporters", error);
    return [];
  }
}
