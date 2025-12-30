import pLimit from "p-limit";
import dedent from "dedent";
import { getLogger } from "../../../utils/logger.js";

import {
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../../utils/discord/permissions.js";
import {
  addTemporaryRolesForMultipleUsers,
  getTemporaryRoles,
  parseDuration,
  removeTemporaryRole,
  sendRemovalNotification,
} from "../../../utils/discord/tempRoles.js";
import {
  errorEmbed,
  infoEmbed,
} from "../../../utils/discord/responseMessages.js";
import {
  createTempRoleEmbed,
  createTempRolesListEmbed,
  createTempRoleRemovalEmbed,
} from "./embeds.js";
import {
  validateRole,
  validateDuration,
  processUserList,
  processTempRoles,
} from "./utils.js";
import { detectTargetingType } from "../schedule-role/utils.js";
// import { THEME } from "../../../config/theme.js"; // Not used in new implementation

/**
 * Handle the assign temp role logic
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {boolean} deferred - Whether the interaction was deferred
 */
export async function handleAssign(interaction, client, deferred = false) {
  const logger = getLogger();

  try {
    // Validate bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      const response = errorEmbed({
        title: "Missing Bot Permissions",
        description: `I need the following permissions to assign temporary roles: **${permissionNames}**`,
        solution:
          "Please ask a server administrator to grant me these permissions and try again.",
        fields: [
          {
            name: "🔧 How to Fix",
            value:
              "Go to Server Settings → Roles → Find my role → Enable the missing permissions",
            inline: false,
          },
          {
            name: "📋 Required Permissions",
            value:
              "• Manage Roles (to assign roles to members)\n• Send Messages (to notify users about role assignment)",
            inline: false,
          },
        ],
      });

      if (deferred) {
        return interaction.editReply({ embeds: [response] });
      } else {
        return interaction.reply({ embeds: [response], flags: 64 });
      }
    }

    // Get command options
    const usersString = interaction.options.getString("users");
    const role = interaction.options.getRole("role");
    const durationString = interaction.options.getString("duration");
    const reason =
      interaction.options.getString("reason") || "No reason provided";
    const notify = interaction.options.getBoolean("notify") || false;
    const notifyExpiry =
      interaction.options.getBoolean("notify-expiry") || false;

    // Validate role
    const roleValidation = validateRole(role, interaction.guild);
    if (!roleValidation.valid) {
      const response = errorEmbed({
        title: "Invalid Role",
        description: roleValidation.error,
        solution: roleValidation.solution,
      });

      if (deferred) {
        return interaction.editReply({ embeds: [response] });
      } else {
        return interaction.reply({ embeds: [response], flags: 64 });
      }
    }

    // Validate duration
    const durationValidation = validateDuration(durationString);
    if (!durationValidation.valid) {
      const response = errorEmbed({
        title: "Invalid Duration",
        description: durationValidation.error,
        solution: durationValidation.solution,
      });

      if (deferred) {
        return interaction.editReply({ embeds: [response] });
      } else {
        return interaction.reply({ embeds: [response], flags: 64 });
      }
    }

    const durationMs = parseDuration(durationString);

    // Debug: Log the parsed duration
    logger.info(
      `Duration string: "${durationString}" -> Parsed to: ${durationMs}ms (${durationMs / 1000 / 60} minutes)`,
    );

    // Dynamically detect targeting type based on mentions in users field
    const targeting = detectTargetingType(usersString, interaction.guild);
    const isAllMembers = targeting.type === "everyone";
    const targetRoles = targeting.targetRoles || [];
    const isMixed = targeting.type === "mixed";

    let userIds = [];
    let validUsers = [];

    // Handle bulk targeting (role-based, @everyone, or mixed)
    if (isAllMembers || targeting.type === "role" || isMixed) {
      // Handle @everyone targeting
      if (isAllMembers) {
        try {
          logger.info(
            `Fetching all members for temp role assignment in guild ${interaction.guild.name} (${interaction.guild.id})`,
          );

          // For very large servers, provide user feedback
          if (deferred && interaction.guild.memberCount > 5000) {
            try {
              await interaction.editReply({
                content: `⏳ Fetching ${interaction.guild.memberCount.toLocaleString()} members... This may take 30-60 seconds for large servers.`,
              });
            } catch (error) {
              logger.debug("Failed to update interaction with progress", error);
            }
          }

          // Fetch all members (requires GUILD_MEMBERS intent)
          // Fetch all members to check their roles
          // Add timeout to prevent hanging on large servers
          try {
            const fetchPromise = interaction.guild.members.fetch();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () =>
                  reject(new Error("Member fetch timed out after 30 seconds")),
                30000,
              );
            });
            await Promise.race([fetchPromise, timeoutPromise]);
          } catch (fetchError) {
            if (fetchError.message?.includes("timed out")) {
              logger.warn(
                `Member fetch timed out for guild ${interaction.guild.name} - using cached members`,
              );
              // Continue with cached members if fetch times out
            } else {
              throw fetchError;
            }
          }

          const allMembersCollection = interaction.guild.members.cache;
          userIds = Array.from(allMembersCollection.values())
            .filter(
              member =>
                !member.user.bot ||
                member.user.id === interaction.client.user.id,
            )
            .map(member => member.id);

          logger.info(
            `Found ${userIds.length} members in guild ${interaction.guild.name} (excluding bots)`,
          );

          if (userIds.length === 0) {
            const response = errorEmbed({
              title: "No Members Found",
              description: "No members found in this server.",
              solution: "Make sure the server has members.",
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }

          // Apply member limit for @everyone (Core members get higher limits)
          // Base limit: 500 matches RoleExecutor chunk size for optimal processing
          const BASE_MAX_ALL_MEMBERS = 500;
          let MAX_ALL_MEMBERS = BASE_MAX_ALL_MEMBERS;

          try {
            const { getUserData, getCoreBulkMemberLimit } = await import(
              "../../../commands/general/core/utils.js"
            );
            const userData = await getUserData(interaction.user.id);
            if (userData.isCore && userData.coreTier) {
              MAX_ALL_MEMBERS = getCoreBulkMemberLimit(
                userData.coreTier,
                BASE_MAX_ALL_MEMBERS,
              );
            }
          } catch (error) {
            logger.debug("Failed to check Core status for bulk limit:", error);
          }

          if (userIds.length > MAX_ALL_MEMBERS) {
            const response = errorEmbed({
              title: "Too Many Members",
              description: `Assigning temporary roles to **${userIds.length.toLocaleString()} members** (all server members) exceeds the maximum limit of **${MAX_ALL_MEMBERS.toLocaleString()} members**.`,
              solution: dedent`
                For operations with more than ${MAX_ALL_MEMBERS.toLocaleString()} members, please use one of these alternatives:
                
                **Recommended Solutions:**
                1. **Target Specific Roles**: Use role mentions instead of @everyone
                2. **Split Operations**: Create multiple assignments targeting different groups
                3. **Direct Role Assignment**: Assign the role directly in Server Settings
                
                **Why this limit?** Operations on ${userIds.length.toLocaleString()} members would take ${Math.ceil(userIds.length / 500)}-${Math.ceil(userIds.length / 500) * 2} minutes to complete and have higher reliability risks.
              `,
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }

          // Warn for large operations
          if (userIds.length > 500) {
            logger.warn(
              `Large operation detected: ${userIds.length} members (@everyone) for temp role assignment. This may take a long time.`,
            );
          }
        } catch (error) {
          logger.error("Error fetching all members:", error);
          const response = errorEmbed({
            title: "Failed to Fetch Members",
            description:
              "Could not fetch all server members. This requires the GUILD_MEMBERS privileged intent.",
            solution:
              "Make sure the bot has the GUILD_MEMBERS intent enabled in the Discord Developer Portal.",
          });

          if (deferred) {
            return interaction.editReply({ embeds: [response] });
          } else {
            return interaction.reply({ embeds: [response], flags: 64 });
          }
        }
      }
      // Handle role-based targeting
      else if (targeting.type === "role" && targetRoles.length > 0) {
        try {
          const roleNames = targetRoles.map(r => r.name).join(", ");
          logger.info(
            `Fetching members with roles ${roleNames} for temp role assignment in guild ${interaction.guild.name}`,
          );

          if (deferred && interaction.guild.memberCount > 5000) {
            try {
              await interaction.editReply({
                content: `⏳ Fetching members with roles ${roleNames}... This may take a moment for large servers.`,
              });
            } catch (error) {
              logger.debug("Failed to update interaction with progress", error);
            }
          }

          // Fetch all members to check their roles
          // Add timeout to prevent hanging on large servers
          try {
            const fetchPromise = interaction.guild.members.fetch();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () =>
                  reject(new Error("Member fetch timed out after 30 seconds")),
                30000,
              );
            });
            await Promise.race([fetchPromise, timeoutPromise]);
          } catch (fetchError) {
            if (fetchError.message?.includes("timed out")) {
              logger.warn(
                `Member fetch timed out for guild ${interaction.guild.name} - using cached members`,
              );
              // Continue with cached members if fetch times out
            } else {
              throw fetchError;
            }
          }

          // Get all members who have ANY of the target roles (OR logic)
          const roleIds = targetRoles.map(r => r.id);
          userIds = interaction.guild.members.cache
            .filter(member =>
              roleIds.some(roleId => member.roles.cache.has(roleId)),
            )
            .filter(
              member =>
                !member.user.bot ||
                member.user.id === interaction.client.user.id,
            )
            .map(member => member.id);

          // Remove duplicates
          userIds = [...new Set(userIds)];

          logger.info(
            `Found ${userIds.length} members with roles ${roleNames} in guild ${interaction.guild.name}`,
          );

          if (userIds.length === 0) {
            const response = errorEmbed({
              title: "No Members Found",
              description: `No members found with any of the roles: **${roleNames}** to assign the temporary role to.`,
              solution:
                "Make sure the roles exist and have members assigned to them.",
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }

          // Apply member limit (Core members get higher limits)
          // Base limit: 500 matches RoleExecutor chunk size for optimal processing
          const BASE_MAX_ALL_MEMBERS = 500;
          let MAX_ALL_MEMBERS = BASE_MAX_ALL_MEMBERS;

          try {
            const { getUserData, getCoreBulkMemberLimit } = await import(
              "../../../commands/general/core/utils.js"
            );
            const userData = await getUserData(interaction.user.id);
            if (userData.isCore && userData.coreTier) {
              MAX_ALL_MEMBERS = getCoreBulkMemberLimit(
                userData.coreTier,
                BASE_MAX_ALL_MEMBERS,
              );
            }
          } catch (error) {
            logger.debug("Failed to check Core status for bulk limit:", error);
          }

          if (userIds.length > MAX_ALL_MEMBERS) {
            const response = errorEmbed({
              title: "Too Many Members",
              description: `The roles **${roleNames}** have a combined total of **${userIds.length.toLocaleString()} members**, which exceeds the maximum limit of **${MAX_ALL_MEMBERS.toLocaleString()} members** for role-based operations.`,
              solution: dedent`
                For roles with more than ${MAX_ALL_MEMBERS.toLocaleString()} total members, please use one of these alternatives:
                
                **Recommended Solutions:**
                1. **Direct Role Assignment**: Assign the target role to another role in Server Settings (instant and efficient)
                2. **Split Operations**: Create multiple assignments targeting fewer roles or specific role groups
                3. **Target Fewer Roles**: Use only roles with fewer members
                
                **Why this limit?** Operations on ${userIds.length.toLocaleString()} members would take ${Math.ceil(userIds.length / 500)}-${Math.ceil(userIds.length / 500) * 2} minutes to complete and have higher reliability risks.
              `,
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }
        } catch (error) {
          logger.error("Error fetching members by role:", error);
          const response = errorEmbed({
            title: "Failed to Fetch Members",
            description:
              "Could not fetch members with the specified roles. This requires the GUILD_MEMBERS privileged intent.",
            solution:
              "Make sure the bot has the GUILD_MEMBERS intent enabled in the Discord Developer Portal.",
          });

          if (deferred) {
            return interaction.editReply({ embeds: [response] });
          } else {
            return interaction.reply({ embeds: [response], flags: 64 });
          }
        }
      }
      // Handle mixed targeting (users + roles)
      else if (isMixed && targetRoles.length > 0) {
        try {
          // First, get users from user mentions
          const userValidation = await processUserList(
            usersString,
            interaction,
          );
          const userMentionIds = userValidation.valid
            ? userValidation.validUsers.map(user => user.id)
            : [];

          // Then, get members from role mentions
          const roleNames = targetRoles.map(r => r.name).join(", ");
          logger.info(
            `Fetching members with roles ${roleNames} and processing user mentions for temp role assignment in guild ${interaction.guild.name}`,
          );

          if (deferred && interaction.guild.memberCount > 5000) {
            try {
              await interaction.editReply({
                content: `⏳ Fetching members with roles ${roleNames} and processing user mentions... This may take a moment for large servers.`,
              });
            } catch (error) {
              logger.debug("Failed to update interaction with progress", error);
            }
          }

          // Fetch all members to check their roles
          // Add timeout to prevent hanging on large servers
          try {
            const fetchPromise = interaction.guild.members.fetch();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () =>
                  reject(new Error("Member fetch timed out after 30 seconds")),
                30000,
              );
            });
            await Promise.race([fetchPromise, timeoutPromise]);
          } catch (fetchError) {
            if (fetchError.message?.includes("timed out")) {
              logger.warn(
                `Member fetch timed out for guild ${interaction.guild.name} - using cached members`,
              );
              // Continue with cached members if fetch times out
            } else {
              throw fetchError;
            }
          }

          // Get all members who have ANY of the target roles (OR logic)
          const roleIds = targetRoles.map(r => r.id);
          const roleMemberIds = interaction.guild.members.cache
            .filter(member =>
              roleIds.some(roleId => member.roles.cache.has(roleId)),
            )
            .filter(
              member =>
                !member.user.bot ||
                member.user.id === interaction.client.user.id,
            )
            .map(member => member.id);

          // Combine user mentions and role-based members, remove duplicates
          userIds = [...new Set([...userMentionIds, ...roleMemberIds])];

          logger.info(
            `Found ${userMentionIds.length} user mentions and ${roleMemberIds.length} members with roles ${roleNames}, total unique: ${userIds.length} in guild ${interaction.guild.name}`,
          );

          if (userIds.length === 0) {
            const response = errorEmbed({
              title: "No Members Found",
              description: `No valid users or members with any of the roles: **${roleNames}** found to assign the temporary role to.`,
              solution:
                "Make sure the users are valid and the roles exist and have members assigned to them.",
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }

          // Apply member limit for combined result (Core members get higher limits)
          // Base limit: 500 matches RoleExecutor chunk size for optimal processing
          const BASE_MAX_ALL_MEMBERS = 500;
          let MAX_ALL_MEMBERS = BASE_MAX_ALL_MEMBERS;

          try {
            const { getUserData, getCoreBulkMemberLimit } = await import(
              "../../../commands/general/core/utils.js"
            );
            const userData = await getUserData(interaction.user.id);
            if (userData.isCore && userData.coreTier) {
              MAX_ALL_MEMBERS = getCoreBulkMemberLimit(
                userData.coreTier,
                BASE_MAX_ALL_MEMBERS,
              );
            }
          } catch (error) {
            logger.debug("Failed to check Core status for bulk limit:", error);
          }

          if (userIds.length > MAX_ALL_MEMBERS) {
            const response = errorEmbed({
              title: "Too Many Members",
              description: `The combined total of **${userIds.length.toLocaleString()} members** (from user mentions and roles ${roleNames}) exceeds the maximum limit of **${MAX_ALL_MEMBERS.toLocaleString()} members**.`,
              solution: dedent`
                For operations with more than ${MAX_ALL_MEMBERS.toLocaleString()} total members, please use one of these alternatives:
                
                **Recommended Solutions:**
                1. **Reduce Targeting**: Use fewer roles or split into multiple assignments
                2. **Direct Role Assignment**: Assign the target role to another role in Server Settings (instant and efficient)
                3. **Split Operations**: Create multiple assignments targeting different groups
                
                **Why this limit?** Operations on ${userIds.length.toLocaleString()} members would take ${Math.ceil(userIds.length / 500)}-${Math.ceil(userIds.length / 500) * 2} minutes to complete and have higher reliability risks.
              `,
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }
        } catch (error) {
          logger.error("Error fetching members by mixed targeting:", error);
          const response = errorEmbed({
            title: "Failed to Fetch Members",
            description:
              "Could not fetch members with the specified roles or process user mentions. This requires the GUILD_MEMBERS privileged intent.",
            solution:
              "Make sure the bot has the GUILD_MEMBERS intent enabled in the Discord Developer Portal.",
          });

          if (deferred) {
            return interaction.editReply({ embeds: [response] });
          } else {
            return interaction.reply({ embeds: [response], flags: 64 });
          }
        }
      }
    }
    // Handle individual user targeting
    else {
      // Process user list
      const userValidation = await processUserList(usersString, interaction);
      if (!userValidation.valid) {
        const response = errorEmbed({
          title: "Invalid Users",
          description: userValidation.error,
          solution: userValidation.solution,
        });

        if (deferred) {
          return interaction.editReply({ embeds: [response] });
        } else {
          return interaction.reply({ embeds: [response], flags: 64 });
        }
      }

      validUsers = userValidation.validUsers;

      // Check maximum user limit (Core members get higher limits)
      const BASE_MAX_USERS = 10;
      let MAX_USERS = BASE_MAX_USERS;

      try {
        const { getUserData, getCoreUserLimit } = await import(
          "../../../commands/general/core/utils.js"
        );
        const userData = await getUserData(interaction.user.id);
        if (userData.isCore && userData.coreTier) {
          MAX_USERS = getCoreUserLimit(userData.coreTier, BASE_MAX_USERS);
        }
      } catch (error) {
        logger.debug("Failed to check Core status for user limit:", error);
      }

      if (validUsers.length > MAX_USERS) {
        const response = errorEmbed({
          title: "Too Many Users",
          description: `You can only assign roles to a maximum of **${MAX_USERS} users** at once.`,
          solution: `Please reduce the number of users to ${MAX_USERS} or fewer. You can run the command multiple times if needed.`,
        });

        if (deferred) {
          return interaction.editReply({ embeds: [response] });
        } else {
          return interaction.reply({ embeds: [response], flags: 64 });
        }
      }

      userIds = validUsers.map(user => user.id);
    }

    logger.info("Starting role assignment", {
      totalUsers: userIds.length,
      userIds,
      roleId: role.id,
      roleName: role.name,
    });
    const expiresAt = new Date(Date.now() + durationMs);

    logger.info("Using multiple user assignment function", {
      totalUsers: userIds.length,
      userIds,
      roleId: role.id,
      roleName: role.name,
    });

    const assignmentResult = await addTemporaryRolesForMultipleUsers(
      interaction.guild.id,
      userIds,
      role.id,
      expiresAt,
      interaction.client,
      notify,
      notifyExpiry,
    );

    // Check if there was a system error (like too many users)
    if (assignmentResult.error) {
      const response = errorEmbed({
        title: "Assignment Failed",
        description: assignmentResult.error,
        solution:
          "Please try again with fewer users or contact support if the issue persists.",
      });

      if (deferred) {
        return interaction.editReply({ embeds: [response] });
      } else {
        return interaction.reply({ embeds: [response], flags: 64 });
      }
    }

    // For bulk operations, we need to fetch user objects for the embed
    // For individual operations, we already have validUsers
    let usersForEmbed = validUsers;
    if (isAllMembers || targeting.type === "role" || isMixed) {
      // Fetch user objects for bulk operations
      try {
        const userPromises = userIds.slice(0, 100).map(async userId => {
          try {
            const user = await interaction.client.users.fetch(userId);
            return user;
          } catch {
            return null;
          }
        });
        const fetchedUsers = await Promise.all(userPromises);
        usersForEmbed = fetchedUsers.filter(Boolean);
      } catch (error) {
        logger.warn("Failed to fetch some users for embed:", error);
        usersForEmbed = [];
      }
    }

    // Convert the result to the format expected by the embed
    const results = userIds.map((userId, index) => {
      const result = assignmentResult.results[index];
      const user = usersForEmbed.find(u => u.id === userId);
      return {
        success: result?.success || false,
        user: user?.username || userId,
        error: result?.error || null,
        message: result?.message || null,
      };
    });

    // Create response embed
    logger.debug("Creating temp role embed with data:", {
      roleName: role?.name,
      roleId: role?.id,
      usersCount: userIds.length,
      durationString,
      reason,
      resultsCount: results?.length,
    });

    const embed = createTempRoleEmbed(
      role,
      usersForEmbed,
      durationString,
      reason,
      results,
      client,
    );

    // Debug embed before sending
    logger.debug("Embed data before sending:", {
      title: embed.data.title,
      description: embed.data.description,
      fieldsCount: embed.data.fields?.length || 0,
      color: embed.data.color,
    });

    // Send response based on deferral status
    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    // Log activity
    logger.info(
      `Temporary role assignment completed by ${interaction.user.tag} in ${interaction.guild.name}: ${assignmentResult.success} successful, ${assignmentResult.failed} failed`,
    );
  } catch (error) {
    logger.error("Error in handleAssign:", error);

    // Send error response based on deferral status
    if (deferred) {
      await interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Error",
            description: "Failed to assign temporary roles.",
            solution: "Please try again or contact support.",
          }),
        ],
      });
    } else if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [
          errorEmbed({
            title: "Error",
            description: "Failed to assign temporary roles.",
            solution: "Please try again or contact support.",
          }),
        ],
        flags: 64,
      });
    }
  }
}

/**
 * Handle the list temp roles logic
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleList(interaction, client, deferred = false) {
  const logger = getLogger();

  try {
    // Check bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Missing Bot Permissions",
            description: `I need the following permissions to view temporary roles: **${permissionNames}**`,
            solution:
              "Please ask a server administrator to grant me these permissions and try again.",
            fields: [
              {
                name: "🔧 How to Fix",
                value:
                  "Go to Server Settings → Roles → Find my role → Enable the missing permissions",
                inline: false,
              },
              {
                name: "📋 Required Permissions",
                value:
                  "• View Channels (to access server information)\n• Read Message History (to view role information)",
                inline: false,
              },
            ],
          }),
        ],
        flags: 64,
      });
    }

    const targetUser = interaction.options.getUser("user");
    const tempRoles = await getTemporaryRoles(interaction.guild.id);

    // Debug logging
    logger.info(
      `Retrieved ${tempRoles.length} total temporary roles from database`,
    );
    logger.info(`Current guild ID: ${interaction.guild.id}`);
    if (tempRoles.length > 0) {
      logger.info(`Sample temp role data:`, tempRoles[0]);
    }

    // Filter by user if specified
    const filteredRoles = targetUser
      ? tempRoles.filter(tempRole => tempRole.userId === targetUser.id)
      : tempRoles;

    logger.info(`After user filtering: ${filteredRoles.length} roles remain`);
    if (filteredRoles.length > 0) {
      logger.info(`First filtered role:`, filteredRoles[0]);
    }

    if (filteredRoles.length === 0) {
      const message = targetUser
        ? `No temporary roles found for ${targetUser.displayName}.`
        : "No temporary roles found in this server.";

      const response = infoEmbed({
        title: "No Temporary Roles Found",
        description: message,
        solution: targetUser
          ? "Try checking another user or assign some temporary roles first."
          : "Use `temp-roles assign` to create some temporary role assignments!",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply({ ...response, flags: 64 });
      }
    }

    // Process roles for display
    const processedRoles = await processTempRoles(
      filteredRoles,
      interaction.guild,
      client,
    );

    // Create and send embed
    const embed = createTempRolesListEmbed(
      processedRoles,
      targetUser,
      interaction.guild,
      client,
    );

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    // Log activity
    logger.info(
      `Temporary roles listing completed by ${interaction.user.tag} in ${interaction.guild.name}: ${filteredRoles.length} roles found`,
    );
  } catch (error) {
    logger.error("Error in handleList:", error);

    // Only reply if we haven't already replied
    if (!interaction.replied && !interaction.deferred) {
      const response = errorEmbed({
        title: "Error",
        description: "Failed to list temporary roles.",
        solution: "Please try again or contact support.",
      });

      try {
        await interaction.reply({ ...response, flags: 64 });
      } catch (replyError) {
        logger.error("Failed to send error response", {
          interactionId: interaction.id,
          error: replyError.message,
        });
      }
    }
  }
}

export async function handleRemove(interaction, client, deferred = false) {
  const logger = getLogger();

  try {
    // Validate bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      const response = errorEmbed({
        title: "Missing Bot Permissions",
        description: `I need the following permissions to remove temporary roles: **${permissionNames}**`,
        solution:
          "Please ask a server administrator to grant me these permissions and try again.",
        fields: [
          {
            name: "🔧 How to Fix",
            value:
              "Go to Server Settings → Roles → Find my role → Enable the missing permissions",
            inline: false,
          },
          {
            name: "📋 Required Permissions",
            value:
              "• Manage Roles (to remove roles from members)\n• Send Messages (to notify users about role removal)",
            inline: false,
          },
        ],
      });

      if (deferred) {
        return interaction.editReply({ embeds: [response] });
      } else {
        return interaction.reply({ embeds: [response], flags: 64 });
      }
    }

    // Get command options
    const usersString = interaction.options.getString("users");
    const role = interaction.options.getRole("role");
    const reason =
      interaction.options.getString("reason") || "No reason provided";
    const notify = interaction.options.getBoolean("notify") || false;

    // Validate role first
    const roleValidation = validateRole(role, interaction.guild);
    if (!roleValidation.valid) {
      const response = errorEmbed({
        title: "Invalid Role",
        description: roleValidation.error,
        solution: roleValidation.solution,
      });

      if (deferred) {
        return interaction.editReply({ embeds: [response] });
      } else {
        return interaction.reply({ embeds: [response], flags: 64 });
      }
    }

    // Dynamically detect targeting type based on mentions in users field
    const targeting = detectTargetingType(usersString, interaction.guild);
    const isAllMembers = targeting.type === "everyone";
    const targetRoles = targeting.targetRoles || [];
    const isMixed = targeting.type === "mixed";

    let userIds = [];
    let validUsers = []; // For individual user processing

    // Handle bulk targeting (role-based, @everyone, or mixed)
    if (isAllMembers || targeting.type === "role" || isMixed) {
      // Handle @everyone targeting
      if (isAllMembers) {
        try {
          logger.info(
            `Fetching all members for temp role removal in guild ${interaction.guild.name} (${interaction.guild.id})`,
          );

          if (deferred && interaction.guild.memberCount > 5000) {
            try {
              await interaction.editReply({
                content: `⏳ Fetching ${interaction.guild.memberCount.toLocaleString()} members... This may take 30-60 seconds for large servers.`,
              });
            } catch (error) {
              logger.debug("Failed to update interaction with progress", error);
            }
          }

          // Fetch all members to check their roles
          // Add timeout to prevent hanging on large servers
          try {
            const fetchPromise = interaction.guild.members.fetch();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () =>
                  reject(new Error("Member fetch timed out after 30 seconds")),
                30000,
              );
            });
            await Promise.race([fetchPromise, timeoutPromise]);
          } catch (fetchError) {
            if (fetchError.message?.includes("timed out")) {
              logger.warn(
                `Member fetch timed out for guild ${interaction.guild.name} - using cached members`,
              );
              // Continue with cached members if fetch times out
            } else {
              throw fetchError;
            }
          }

          const allMembersCollection = interaction.guild.members.cache;
          userIds = Array.from(allMembersCollection.values())
            .filter(
              member =>
                !member.user.bot ||
                member.user.id === interaction.client.user.id,
            )
            .map(member => member.id);

          logger.info(
            `Found ${userIds.length} members in guild ${interaction.guild.name} (excluding bots)`,
          );

          if (userIds.length === 0) {
            const response = errorEmbed({
              title: "No Members Found",
              description: "No members found in this server.",
              solution: "Make sure the server has members.",
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }

          // Apply member limit for @everyone (Core members get higher limits)
          const BASE_MAX_ALL_MEMBERS = 500;
          let MAX_ALL_MEMBERS = BASE_MAX_ALL_MEMBERS;

          try {
            const { getUserData, getCoreBulkMemberLimit } = await import(
              "../../../commands/general/core/utils.js"
            );
            const userData = await getUserData(interaction.user.id);
            if (userData.isCore && userData.coreTier) {
              MAX_ALL_MEMBERS = getCoreBulkMemberLimit(
                userData.coreTier,
                BASE_MAX_ALL_MEMBERS,
              );
            }
          } catch (error) {
            logger.debug("Failed to check Core status for bulk limit:", error);
          }

          if (userIds.length > MAX_ALL_MEMBERS) {
            const response = errorEmbed({
              title: "Too Many Members",
              description: `Removing temporary roles from **${userIds.length.toLocaleString()} members** (all server members) exceeds the maximum limit of **${MAX_ALL_MEMBERS.toLocaleString()} members**.`,
              solution: dedent`
                For operations with more than ${MAX_ALL_MEMBERS.toLocaleString()} members, please use one of these alternatives:

                **Recommended Solutions:**
                1. **Target Specific Roles**: Use role mentions instead of @everyone
                2. **Split Operations**: Create multiple removals targeting different groups
                3. **Direct Role Removal**: Remove the role directly in Server Settings

                **Why this limit?** Operations on ${userIds.length.toLocaleString()} members would take ${Math.ceil(userIds.length / 500)}-${Math.ceil(userIds.length / 500) * 2} minutes to complete and have higher reliability risks.
              `,
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }
        } catch (error) {
          logger.error("Error fetching all members:", error);
          const response = errorEmbed({
            title: "Failed to Fetch Members",
            description:
              "Could not fetch all server members. This requires the GUILD_MEMBERS privileged intent.",
            solution:
              "Make sure the bot has the GUILD_MEMBERS intent enabled in the Discord Developer Portal.",
          });

          if (deferred) {
            return interaction.editReply({ embeds: [response] });
          } else {
            return interaction.reply({ embeds: [response], flags: 64 });
          }
        }
      }
      // Handle role-based targeting
      else if (targeting.type === "role" && targetRoles.length > 0) {
        try {
          const roleNames = targetRoles.map(r => r.name).join(", ");
          logger.info(
            `Fetching members with roles ${roleNames} for temp role removal in guild ${interaction.guild.name}`,
          );

          if (deferred && interaction.guild.memberCount > 5000) {
            try {
              await interaction.editReply({
                content: `⏳ Fetching members with roles ${roleNames}... This may take a moment for large servers.`,
              });
            } catch (error) {
              logger.debug("Failed to update interaction with progress", error);
            }
          }

          // Fetch all members to check their roles
          // Add timeout to prevent hanging on large servers
          try {
            const fetchPromise = interaction.guild.members.fetch();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () =>
                  reject(new Error("Member fetch timed out after 30 seconds")),
                30000,
              );
            });
            await Promise.race([fetchPromise, timeoutPromise]);
          } catch (fetchError) {
            if (fetchError.message?.includes("timed out")) {
              logger.warn(
                `Member fetch timed out for guild ${interaction.guild.name} - using cached members`,
              );
              // Continue with cached members if fetch times out
            } else {
              throw fetchError;
            }
          }

          const roleIds = targetRoles.map(r => r.id);
          userIds = interaction.guild.members.cache
            .filter(member =>
              roleIds.some(roleId => member.roles.cache.has(roleId)),
            )
            .filter(
              member =>
                !member.user.bot ||
                member.user.id === interaction.client.user.id,
            )
            .map(member => member.id);

          userIds = [...new Set(userIds)];

          logger.info(
            `Found ${userIds.length} members with roles ${roleNames} in guild ${interaction.guild.name}`,
          );

          if (userIds.length === 0) {
            const response = errorEmbed({
              title: "No Members Found",
              description: `No members found with any of the roles: **${roleNames}** to remove the temporary role from.`,
              solution:
                "Make sure the roles exist and have members assigned to them.",
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }

          // Apply member limit (Core members get higher limits)
          const BASE_MAX_ALL_MEMBERS = 500;
          let MAX_ALL_MEMBERS = BASE_MAX_ALL_MEMBERS;

          try {
            const { getUserData, getCoreBulkMemberLimit } = await import(
              "../../../commands/general/core/utils.js"
            );
            const userData = await getUserData(interaction.user.id);
            if (userData.isCore && userData.coreTier) {
              MAX_ALL_MEMBERS = getCoreBulkMemberLimit(
                userData.coreTier,
                BASE_MAX_ALL_MEMBERS,
              );
            }
          } catch (error) {
            logger.debug("Failed to check Core status for bulk limit:", error);
          }

          if (userIds.length > MAX_ALL_MEMBERS) {
            const response = errorEmbed({
              title: "Too Many Members",
              description: `The roles **${roleNames}** have a combined total of **${userIds.length.toLocaleString()} members**, which exceeds the maximum limit of **${MAX_ALL_MEMBERS.toLocaleString()} members** for role-based operations.`,
              solution: dedent`
                For roles with more than ${MAX_ALL_MEMBERS.toLocaleString()} total members, please use one of these alternatives:

                **Recommended Solutions:**
                1. **Direct Role Removal**: Remove the target role from another role in Server Settings (instant and efficient)
                2. **Split Operations**: Create multiple removals targeting fewer roles or specific role groups
                3. **Target Fewer Roles**: Use only roles with fewer members

                **Why this limit?** Operations on ${userIds.length.toLocaleString()} members would take ${Math.ceil(userIds.length / 500)}-${Math.ceil(userIds.length / 500) * 2} minutes to complete and have higher reliability risks.
              `,
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }
        } catch (error) {
          logger.error("Error fetching members by role:", error);
          const response = errorEmbed({
            title: "Failed to Fetch Members",
            description:
              "Could not fetch members with the specified roles. This requires the GUILD_MEMBERS privileged intent.",
            solution:
              "Make sure the bot has the GUILD_MEMBERS intent enabled in the Discord Developer Portal.",
          });

          if (deferred) {
            return interaction.editReply({ embeds: [response] });
          } else {
            return interaction.reply({ embeds: [response], flags: 64 });
          }
        }
      }
      // Handle mixed targeting (users + roles)
      else if (isMixed && targetRoles.length > 0) {
        try {
          const userValidation = await processUserList(
            usersString,
            interaction,
          );
          const userMentionIds = userValidation.valid
            ? userValidation.validUsers.map(user => user.id)
            : [];

          const roleNames = targetRoles.map(r => r.name).join(", ");
          logger.info(
            `Fetching members with roles ${roleNames} and processing user mentions for temp role removal in guild ${interaction.guild.name}`,
          );

          if (deferred && interaction.guild.memberCount > 5000) {
            try {
              await interaction.editReply({
                content: `⏳ Fetching members with roles ${roleNames} and processing user mentions... This may take a moment for large servers.`,
              });
            } catch (error) {
              logger.debug("Failed to update interaction with progress", error);
            }
          }

          // Fetch all members to check their roles
          // Add timeout to prevent hanging on large servers
          try {
            const fetchPromise = interaction.guild.members.fetch();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () =>
                  reject(new Error("Member fetch timed out after 30 seconds")),
                30000,
              );
            });
            await Promise.race([fetchPromise, timeoutPromise]);
          } catch (fetchError) {
            if (fetchError.message?.includes("timed out")) {
              logger.warn(
                `Member fetch timed out for guild ${interaction.guild.name} - using cached members`,
              );
              // Continue with cached members if fetch times out
            } else {
              throw fetchError;
            }
          }

          const roleIds = targetRoles.map(r => r.id);
          const roleMemberIds = interaction.guild.members.cache
            .filter(member =>
              roleIds.some(roleId => member.roles.cache.has(roleId)),
            )
            .filter(
              member =>
                !member.user.bot ||
                member.user.id === interaction.client.user.id,
            )
            .map(member => member.id);

          userIds = [...new Set([...userMentionIds, ...roleMemberIds])];

          logger.info(
            `Found ${userMentionIds.length} user mentions and ${roleMemberIds.length} members with roles ${roleNames}, total unique: ${userIds.length} in guild ${interaction.guild.name}`,
          );

          if (userIds.length === 0) {
            const response = errorEmbed({
              title: "No Members Found",
              description: `No valid users or members with any of the roles: **${roleNames}** found to remove the temporary role from.`,
              solution:
                "Make sure the users are valid and the roles exist and have members assigned to them.",
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }

          // Apply member limit for combined result (Core members get higher limits)
          const BASE_MAX_ALL_MEMBERS = 500;
          let MAX_ALL_MEMBERS = BASE_MAX_ALL_MEMBERS;

          try {
            const { getUserData, getCoreBulkMemberLimit } = await import(
              "../../../commands/general/core/utils.js"
            );
            const userData = await getUserData(interaction.user.id);
            if (userData.isCore && userData.coreTier) {
              MAX_ALL_MEMBERS = getCoreBulkMemberLimit(
                userData.coreTier,
                BASE_MAX_ALL_MEMBERS,
              );
            }
          } catch (error) {
            logger.debug("Failed to check Core status for bulk limit:", error);
          }

          if (userIds.length > MAX_ALL_MEMBERS) {
            const response = errorEmbed({
              title: "Too Many Members",
              description: `The combined total of **${userIds.length.toLocaleString()} members** (from user mentions and roles ${roleNames}) exceeds the maximum limit of **${MAX_ALL_MEMBERS.toLocaleString()} members**.`,
              solution: dedent`
                For operations with more than ${MAX_ALL_MEMBERS.toLocaleString()} total members, please use one of these alternatives:

                **Recommended Solutions:**
                1. **Reduce Targeting**: Use fewer roles or split into multiple removals
                2. **Direct Role Removal**: Remove the target role from another role in Server Settings (instant and efficient)
                3. **Split Operations**: Create multiple removals targeting different groups

                **Why this limit?** Operations on ${userIds.length.toLocaleString()} members would take ${Math.ceil(userIds.length / 500)}-${Math.ceil(userIds.length / 500) * 2} minutes to complete and have higher reliability risks.
              `,
            });

            if (deferred) {
              return interaction.editReply({ embeds: [response] });
            } else {
              return interaction.reply({ embeds: [response], flags: 64 });
            }
          }
        } catch (error) {
          logger.error("Error fetching members by mixed targeting:", error);
          const response = errorEmbed({
            title: "Failed to Fetch Members",
            description:
              "Could not fetch members with the specified roles or process user mentions. This requires the GUILD_MEMBERS privileged intent.",
            solution:
              "Make sure the bot has the GUILD_MEMBERS intent enabled in the Discord Developer Portal.",
          });

          if (deferred) {
            return interaction.editReply({ embeds: [response] });
          } else {
            return interaction.reply({ embeds: [response], flags: 64 });
          }
        }
      }
    }
    // Handle individual user targeting
    else {
      const userValidation = await processUserList(usersString, interaction);
      if (!userValidation.valid) {
        const response = errorEmbed({
          title: "Invalid Users",
          description: userValidation.error,
          solution: userValidation.solution,
        });

        if (deferred) {
          return interaction.editReply({ embeds: [response] });
        } else {
          return interaction.reply({ embeds: [response], flags: 64 });
        }
      }

      validUsers = userValidation.validUsers;

      // Check maximum user limit (Core members get higher limits)
      const BASE_MAX_USERS = 10;
      let MAX_USERS = BASE_MAX_USERS;

      try {
        const { getUserData, getCoreUserLimit } = await import(
          "../../../commands/general/core/utils.js"
        );
        const userData = await getUserData(interaction.user.id);
        if (userData.isCore && userData.coreTier) {
          MAX_USERS = getCoreUserLimit(userData.coreTier, BASE_MAX_USERS);
        }
      } catch (error) {
        logger.debug("Failed to check Core status for user limit:", error);
      }

      if (validUsers.length > MAX_USERS) {
        const response = errorEmbed({
          title: "Too Many Users",
          description: `You can only remove roles from a maximum of **${MAX_USERS} users** at once.`,
          solution: `Please reduce the number of users to ${MAX_USERS} or fewer. You can run the command multiple times if needed.`,
        });

        if (deferred) {
          return interaction.editReply({ embeds: [response] });
        } else {
          return interaction.reply({ embeds: [response], flags: 64 });
        }
      }

      userIds = validUsers.map(user => user.id);
    }

    // For bulk operations, we need to fetch user objects for the embed
    // For individual operations, we already have validUsers
    let usersForEmbed = validUsers;
    if (isAllMembers || targeting.type === "role" || isMixed) {
      try {
        const userPromises = userIds.slice(0, 100).map(async userId => {
          try {
            const user = await interaction.client.users.fetch(userId);
            return user;
          } catch {
            return null;
          }
        });
        const fetchedUsers = await Promise.all(userPromises);
        usersForEmbed = fetchedUsers.filter(Boolean);
      } catch (error) {
        logger.warn("Failed to fetch some users for embed:", error);
        usersForEmbed = [];
      }
    }

    // Process removals for all users
    const limiter = pLimit(3);

    const removalPromises = userIds.map(userId =>
      limiter(async () => {
        try {
          // Check if user has the temporary role
          const member = await interaction.guild.members.fetch(userId);
          if (!member.roles.cache.has(role.id)) {
            logger.info(`User ${userId} does not have role ${role.id}`);
            return {
              success: false,
              userId,
              error: "User does not have this role.",
            };
          }

          // Remove from temporary roles database
          const removed = await removeTemporaryRole(
            interaction.guild.id,
            userId,
            role.id,
          );

          if (removed) {
            // Remove the actual Discord role
            await member.roles.remove(role, reason);

            // Send notification if requested
            if (notify) {
              try {
                await sendRemovalNotification(
                  member,
                  role,
                  interaction.guild,
                  reason,
                  interaction.user,
                );
                logger.info(`📧 Sent removal notification to user ${userId}`);
              } catch (notificationError) {
                logger.warn(
                  `Failed to send removal notification to user ${userId}:`,
                  notificationError,
                );
                // Don't fail the removal if notification fails
              }
            }

            logger.info(
              `✅ Successfully removed temporary role ${role.name} from user ${userId}`,
            );
            return { success: true, userId };
          } else {
            return {
              success: false,
              userId,
              error: "Role not found in temporary roles database.",
            };
          }
        } catch (error) {
          logger.warn(`Failed to remove role from user ${userId}:`, error);
          return { success: false, userId, error: error.message };
        }
      }),
    );

    const results = await Promise.allSettled(removalPromises);
    const processedResults = results.map(r =>
      r.status === "fulfilled"
        ? r.value
        : { success: false, userId: null, error: r.reason },
    );

    // Create success embed with results
    const embed = createTempRoleRemovalEmbed(
      role,
      usersForEmbed,
      reason,
      processedResults,
      interaction.user,
      client,
    );

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    // Log the removal activity
    const successCount = processedResults.filter(r => r.success).length;
    const failureCount = processedResults.filter(r => !r.success).length;

    logger.info(
      `Temporary role removal completed by ${interaction.user.tag} in ${interaction.guild.name}: ${successCount} successful, ${failureCount} failed`,
    );
  } catch (error) {
    logger.error("Error in handleRemove:", error);

    // Only reply if we haven't already replied
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [
          errorEmbed({
            title: "Error",
            description: "Failed to remove temporary roles.",
            solution: "Please try again or contact support.",
          }),
        ],
        flags: 64,
      });
    }
  }
}

/**
 * Assign a role to a user and optionally send them a DM
 * @param {import('discord.js').User} user
 * @param {import('discord.js').Role} role
 * @param {number} durationMs
 * @param {string} reason
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {boolean} notify - Whether to send DM notification
 * @param {boolean} notifyExpiry - Whether to send DM when role expires
 */
