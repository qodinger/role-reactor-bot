import pLimit from "p-limit";
import { getLogger } from "../../../utils/logger.js";

import {
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../../utils/discord/permissions.js";
import {
  addTemporaryRole,
  getTemporaryRoles,
  getUserTemporaryRoles,
  removeTemporaryRole,
  parseDuration,
} from "../../../utils/discord/temporaryRoles.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  createTempRoleEmbed,
  createTempRolesListEmbed,
  createTempRoleRemovedEmbed,
} from "./embeds.js";
import {
  validateRole,
  validateDuration,
  processUserList,
  processTempRoles,
  validateTemporaryRole,
  removeRoleFromUser,
  removeTemporaryRoleData,
  logTempRoleAssignment,
  logTempRolesListing,
  logTempRoleRemoval,
} from "./utils.js";
import { THEME } from "../../../config/theme.js";

/**
 * Handle the assign temp role logic
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleAssign(interaction) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    await interaction.deferReply({ flags: 64 });

    // Validate bot permissions
    const requiredPermissions = ["ManageRoles"];
    if (!botHasRequiredPermissions(interaction.guild, requiredPermissions)) {
      const missingPermissions = getMissingBotPermissions(
        interaction.guild,
        requiredPermissions,
      );
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      return interaction.editReply(
        errorEmbed({
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
        }),
      );
    }

    // Get command options
    const usersString = interaction.options.getString("users");
    const role = interaction.options.getRole("role");
    const durationString = interaction.options.getString("duration");
    const reason =
      interaction.options.getString("reason") || "No reason provided";
    const notify = interaction.options.getBoolean("notify") || false;

    // Validate role
    const roleValidation = validateRole(role, interaction.guild);
    if (!roleValidation.valid) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Role",
          description: roleValidation.error,
          solution: roleValidation.solution,
        }),
      );
    }

    // Validate duration
    const durationValidation = validateDuration(durationString);
    if (!durationValidation.valid) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Duration",
          description: durationValidation.error,
          solution: durationValidation.solution,
        }),
      );
    }

    const durationMs = parseDuration(durationString);

    // Debug: Log the parsed duration
    logger.info(
      `Duration string: "${durationString}" -> Parsed to: ${durationMs}ms (${durationMs / 1000 / 60} minutes)`,
    );

    // Process user list
    const userValidation = await processUserList(usersString, interaction);
    if (!userValidation.valid) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Users",
          description: userValidation.error,
          solution: userValidation.solution,
        }),
      );
    }

    const { validUsers } = userValidation;

    // Assign roles to users
    const limiter = pLimit(3);
    const assignmentPromises = validUsers.map(user =>
      limiter(async () => {
        try {
          return await assignRoleAndDM(
            user,
            role,
            durationMs,
            reason,
            interaction,
            notify,
          );
        } catch (error) {
          logger.warn(`Failed to assign role to user ${user.id}:`, error);
          return { success: false, user, error: error.message };
        }
      }),
    );

    const results = await Promise.all(assignmentPromises);

    // Create response embed
    const embed = createTempRoleEmbed(
      role,
      validUsers,
      durationString,
      reason,
      results,
    );
    await interaction.editReply({ embeds: [embed] });

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

    if (interaction.deferred) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to assign temporary roles.",
          solution: "Please try again or contact support.",
        }),
      );
    }
  }
}

/**
 * Handle the list temp roles logic
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleList(interaction, client) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    // Check bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      return interaction.editReply(
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
      );
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

      return interaction.editReply(
        errorEmbed({
          title: "No Temporary Roles Found",
          description: message,
          solution: targetUser
            ? "Try checking another user or assign some temporary roles first."
            : "Use `temp-roles assign` to create some temporary role assignments!",
        }),
      );
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

    await interaction.editReply({ embeds: [embed] });

    // Log activity
    logTempRolesListing(
      interaction.user,
      targetUser,
      filteredRoles.length,
      interaction.guild,
    );
  } catch (error) {
    logger.error("Error in handleList:", error);

    if (interaction.deferred) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to list temporary roles.",
          solution: "Please try again or contact support.",
        }),
      );
    }
  }
}

export async function handleRemove(interaction) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    await interaction.deferReply({ flags: 64 });

    // Validate bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      return interaction.editReply(
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
      );
    }

    // Get command options
    const targetUser = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    // Validate that this is indeed a temporary role assignment
    const validation = await validateTemporaryRole(
      targetUser.id,
      role.id,
      interaction.guild.id,
    );
    if (!validation.valid) {
      return interaction.editReply(
        errorEmbed({
          title: "Temporary Role Not Found",
          description: validation.error,
          solution: validation.solution,
        }),
      );
    }

    // Remove the role from the user
    const roleRemovalResult = await removeRoleFromUser(
      targetUser,
      role,
      interaction.guild,
    );
    if (!roleRemovalResult.success) {
      return interaction.editReply(
        errorEmbed({
          title: "Failed to Remove Role",
          description: roleRemovalResult.error,
          solution: roleRemovalResult.solution,
        }),
      );
    }

    // Remove from temporary roles database
    await removeTemporaryRoleData(targetUser.id, role.id, interaction.guild.id);

    // Create success embed
    const embed = createTempRoleRemovedEmbed(
      targetUser,
      role,
      reason,
      interaction.user,
      validation.tempRole,
    );

    await interaction.editReply({ embeds: [embed] });

    // Log the removal activity
    logTempRoleRemoval(
      interaction.user,
      targetUser,
      role,
      reason,
      validation.tempRole,
      Date.now() - startTime,
    );
  } catch (error) {
    logger.error("Error in handleRemove:", error);

    if (interaction.deferred) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to remove temporary role.",
          solution: "Please try again or contact support.",
        }),
      );
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
 */
async function assignRoleAndDM(
  user,
  role,
  durationMs,
  reason,
  interaction,
  notify = false,
) {
  const logger = getLogger();

  try {
    const member = await interaction.guild.members.fetch(user.id);

    // Check if user already has this role
    let wasUpdate = false;
    if (member.roles.cache.has(role.id)) {
      // Check if it's already a temporary role
      const existingTempRoles = await getUserTemporaryRoles(
        interaction.guild.id,
        user.id,
      );
      const existingTempRole = existingTempRoles.find(
        tr => tr.roleId === role.id,
      );

      if (existingTempRole) {
        // Update existing temporary role
        logger.info(
          `Updating existing temporary role for user ${user.id}, role ${role.id}`,
        );
        await removeTemporaryRole(interaction.guild.id, user.id, role.id);
        wasUpdate = true;
      } else {
        // Convert permanent role to temporary
        logger.info(
          `Converting permanent role to temporary for user ${user.id}, role ${role.id}`,
        );
        wasUpdate = true;
      }
    }

    // Debug logging for temporary role storage
    logger.info(
      `Storing temporary role - User: ${user.id}, Role: ${role.id}, Guild: ${interaction.guild.id}, Duration: ${durationMs}ms`,
    );

    const expiresAt = new Date(Date.now() + durationMs);
    await addTemporaryRole(
      interaction.guild.id,
      user.id,
      role.id,
      expiresAt,
      interaction.client,
    );

    logger.info(`Temporary role stored successfully`);

    // Only add the role if user doesn't already have it
    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role, `Temporary role - ${reason}`);
    }

    // Try to send DM if requested
    let dmSent = false;
    if (notify) {
      try {
        const expiresAt = new Date(Date.now() + durationMs);
        await user.send({
          embeds: [
            {
              title: wasUpdate
                ? "🎭 Temporary Role Updated"
                : "🎭 Temporary Role Assigned",
              description: wasUpdate
                ? `Your **${role.name}** role in **${interaction.guild.name}** has been updated with a new expiration time.`
                : `You have been assigned the **${role.name}** role in **${interaction.guild.name}**.`,
              color: THEME.SUCCESS,
              fields: [
                {
                  name: "⏰ Duration",
                  value: formatDuration(durationMs),
                  inline: true,
                },
                {
                  name: "📅 Expires",
                  value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
                  inline: true,
                },
                { name: "📝 Reason", value: reason, inline: false },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        });
        dmSent = true;
      } catch (dmError) {
        logger.warn(`Could not send DM to user ${user.tag}:`, dmError.message);
      }
    }

    return { success: true, user, dmSent, wasUpdate };
  } catch (error) {
    logger.error(`Error assigning role to ${user.tag}:`, error);
    return { success: false, user, error: error.message };
  }
}

/**
 * Format duration from milliseconds to human readable
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
