import pLimit from "p-limit";
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
} from "../../../utils/discord/tempRoles.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
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
  removeRoleFromUser,
  logTempRoleAssignment,
  logTempRolesListing,
} from "./utils.js";
// import { THEME } from "../../../config/theme.js"; // Not used in new implementation

/**
 * Handle the assign temp role logic
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {boolean} deferred - Whether the interaction was deferred
 */
export async function handleAssign(interaction, client, deferred = false) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    // Note: Deferral is already handled in the main execute function

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
    // const notify = interaction.options.getBoolean("notify") || false; // Not used in new implementation
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

    const { validUsers } = userValidation;

    // Check maximum user limit
    const MAX_USERS = 10;
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

    logger.info("Starting role assignment", {
      totalUsers: validUsers.length,
      userIds: validUsers.map(u => u.id),
      usernames: validUsers.map(u => u.username),
      roleId: role.id,
      roleName: role.name,
    });

    // Use the new multiple user function for efficiency
    const userIds = validUsers.map(user => user.id);
    const expiresAt = new Date(Date.now() + durationMs);

    logger.info("Using multiple user assignment function", {
      totalUsers: validUsers.length,
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

    // Convert the result to the format expected by the embed
    const results = validUsers.map((user, index) => {
      const result = assignmentResult.results[index];
      return {
        success: result?.success || false,
        user: user.username,
        error: result?.error || null,
        message: result?.message || null,
      };
    });

    // Create response embed
    const embed = createTempRoleEmbed(
      role,
      validUsers,
      durationString,
      reason,
      results,
      client,
    );

    // Send response based on deferral status
    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    // Log activity
    logTempRoleAssignment(
      interaction.user,
      role,
      validUsers,
      durationString,
      reason,
      results,
      Date.now() - startTime,
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
    // Note: Deferral is already handled in the main execute function

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

      const response = errorEmbed({
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
    logTempRolesListing(
      interaction.user,
      targetUser,
      filteredRoles.length,
      interaction.guild,
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

export async function handleRemove(interaction, client) {
  const logger = getLogger();

  try {
    // Note: Deferral is already handled in the main execute function

    // Validate bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      return interaction.reply({
        embeds: [
          errorEmbed({
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
          }),
        ],
        flags: 64,
      });
    }

    // Get command options
    const usersString = interaction.options.getString("users");
    const role = interaction.options.getRole("role");
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    // Process user list (same as assign command)
    const userProcessingResult = await processUserList(
      usersString,
      interaction,
    );
    if (!userProcessingResult.valid) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Invalid User List",
            description: userProcessingResult.error,
            solution: userProcessingResult.solution,
          }),
        ],
        flags: 64,
      });
    }

    const { validUsers: targetUsers } = userProcessingResult;

    // Validate role
    const roleValidation = validateRole(role, interaction.guild);
    if (!roleValidation.valid) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Invalid Role",
            description: roleValidation.error,
            solution: roleValidation.solution,
          }),
        ],
        flags: 64,
      });
    }

    // Process removals for all users
    const limiter = pLimit(3);
    const removalPromises = targetUsers.map(user =>
      limiter(async () => {
        try {
          return await removeRoleFromUser(
            user,
            role,
            interaction.guild,
            reason,
          );
        } catch (error) {
          logger.warn(`Failed to remove role from user ${user.id}:`, error);
          return { success: false, user, error: error.message };
        }
      }),
    );

    const results = await Promise.allSettled(removalPromises);
    const processedResults = results.map(r =>
      r.status === "fulfilled"
        ? r.value
        : { success: false, user: null, error: r.reason },
    );

    // Create success embed with results
    const embed = createTempRoleRemovalEmbed(
      role,
      targetUsers,
      reason,
      processedResults,
      interaction.user,
      client,
    );

    await interaction.reply({ embeds: [embed], flags: 64 });

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
