import { getStorageManager } from "../../storage/storageManager.js";
import { getDatabaseManager } from "../../storage/databaseManager.js";
import { getLogger } from "../../logger.js";
import { getCachedMember, bulkAddRoles } from "../roleManager.js";
import { sendAssignmentNotification } from "./embeds.js";

// Constants
const MAX_USERS_PER_ASSIGNMENT = 10;

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

      const member = await getCachedMember(guild, userId);
      if (!member) {
        logger.error(`Member ${userId} not found in guild ${guildId}`);
        return false;
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        logger.error(`Role ${roleId} not found in guild ${guildId}`);
        return false;
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
          const member = await getCachedMember(guild, userId);
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

  try {
    // Validate user count
    if (userIds.length > MAX_USERS_PER_ASSIGNMENT) {
      logger.warn(
        `Too many users requested: ${userIds.length} (max: ${MAX_USERS_PER_ASSIGNMENT})`,
      );
      return {
        success: 0,
        failed: userIds.length,
        results: [
          {
            userId: "system",
            success: false,
            error: `Too many users. Maximum allowed: ${MAX_USERS_PER_ASSIGNMENT}, requested: ${userIds.length}`,
          },
        ],
        error: `Too many users. Maximum allowed: ${MAX_USERS_PER_ASSIGNMENT}, requested: ${userIds.length}`,
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

    // Prepare members and filter out those who already have the role
    const memberOperations = [];
    const userMapping = new Map(); // Maps userId to index in memberOperations

    for (const userId of userIds) {
      try {
        const member = await getCachedMember(guild, userId);
        if (!member) {
          logger.error(`User ${userId} not found in guild ${guildId}`);
          results.push({ userId, success: false, error: "User not found" });
          continue;
        }

        // Check if user already has the role
        if (member.roles.cache.has(roleId)) {
          logger.info(`User ${userId} already has role ${role.name}`);
          results.push({ userId, success: true, message: "Already has role" });
          continue;
        }

        // Add to operations for bulk processing
        const operationIndex = memberOperations.length;
        memberOperations.push({ member, role });
        userMapping.set(userId, {
          operationIndex,
          member,
          needsNotification: notify,
        });
      } catch (error) {
        logger.error(`Failed to prepare member ${userId}:`, error);
        results.push({ userId, success: false, error: error.message });
      }
    }

    // Use bulk operations for role assignment
    let bulkResults = [];
    if (memberOperations.length > 0) {
      bulkResults = await bulkAddRoles(
        memberOperations,
        `Temporary role assignment - expires at ${expiresAt.toISOString()}`,
      );
    }

    // Process bulk results and map back to users
    let successCount = results.filter(r => r.success).length;
    let failedCount = results.filter(r => r.success === false).length;

    for (const [userId, mapping] of userMapping.entries()) {
      const bulkResult = bulkResults[mapping.operationIndex];

      if (bulkResult && bulkResult.success) {
        successCount++;
        results.push({
          userId,
          success: true,
          message: "Role assigned",
        });

        // Send immediate DM notification if requested
        if (mapping.needsNotification && mapping.member) {
          try {
            await sendAssignmentNotification(
              mapping.member,
              role,
              expiresAt,
              guild,
            );
            logger.info(
              `📧 Sent assignment notification to ${mapping.member.user.tag}`,
            );
          } catch (dmError) {
            logger.warn(
              `Failed to send assignment notification to ${mapping.member.user.tag}:`,
              dmError.message,
            );
          }
        }
      } else {
        failedCount++;
        results.push({
          userId,
          success: false,
          error: bulkResult?.error || "Failed to assign role",
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
                const member = await getCachedMember(guild, result.userId);
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
