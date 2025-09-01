import pLimit from "p-limit";
import { getLogger } from "../../../utils/logger.js";
import {
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../../utils/discord/permissions.js";
import {
  addTemporaryRole,
  parseDuration,
} from "../../../utils/discord/temporaryRoles.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { createTempRoleEmbed } from "./embeds.js";
import { validateRole, validateDuration, processUserList } from "./utils.js";

/**
 * Handle the main assign temp role logic
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleAssignTempRole(interaction) {
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
              value: "• Manage Roles (to assign roles to members)",
              inline: false,
            },
          ],
        }),
      );
    }

    // Get and validate inputs
    const usersString = interaction.options.getString("users");
    const targetRole = interaction.options.getRole("role");
    const durationStr = interaction.options.getString("duration");
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    // Validate role
    if (!validateRole(targetRole)) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Role",
          description:
            "The selected role cannot be assigned as a temporary role.",
          solution:
            "Please choose a different role that is not managed by a bot or integration.",
        }),
      );
    }

    // Validate duration
    if (!validateDuration(durationStr)) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Duration",
          description:
            "The duration format is invalid or outside the allowed range.",
          solution:
            "Please use a valid duration format (e.g., 1h, 2d, 1w, 30m) between 1 minute and 1 year.",
        }),
      );
    }

    // Process user list
    const userList = processUserList(usersString);
    if (userList.length === 0) {
      return interaction.editReply(
        errorEmbed({
          title: "No Valid Users",
          description: "No valid users were found in the provided list.",
          solution:
            "Please provide valid user IDs or mentions separated by commas.",
        }),
      );
    }

    // Calculate expiration time
    const durationMs = parseDuration(durationStr);
    const expiresAt = new Date(Date.now() + durationMs);

    // Process role assignments with rate limiting
    const limit = pLimit(3); // Limit to 3 concurrent operations
    const results = [];

    await interaction.editReply("🔄 Processing role assignments...");

    try {
      await Promise.all(
        userList.map(userId =>
          limit(async () => {
            const result = await assignRoleAndDM({
              userId,
              targetRole,
              expiresAt,
              reason,
              interaction,
              durationStr,
            });
            results.push(result);
          }),
        ),
      );
    } catch (error) {
      logger.error("Error during role assignment", error);
      return interaction.editReply(
        errorEmbed({
          title: "Role Assignment Error",
          description: "An error occurred while assigning roles.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }

    // Create results embed
    const embed = createTempRoleEmbed(
      interaction,
      targetRole,
      results,
      durationStr,
      expiresAt,
      reason,
    );

    await interaction.editReply({ embeds: [embed] });

    const duration = Date.now() - startTime;
    logger.info(
      `Temporary role assignment completed for ${interaction.guild.name} by ${interaction.user.tag} in ${duration}ms`,
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error assigning temporary role after ${duration}ms`, error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "An error occurred while assigning temporary roles.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Assign role and send DM to user
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function assignRoleAndDM({
  userId,
  targetRole,
  expiresAt,
  reason,
  interaction,
  durationStr,
}) {
  const logger = getLogger();
  const result = { userId, status: "", error: null };

  try {
    const targetMember = await interaction.guild.members.fetch(userId);
    if (!targetMember) {
      result.status = "❌ User not found";
      return result;
    }

    if (targetMember.user.bot) {
      result.status = "❌ Cannot assign roles to bots";
      return result;
    }

    const alreadyHasRole = targetMember.roles.cache.has(targetRole.id);
    if (alreadyHasRole) {
      result.status = "⚠️ Already has role";
      return result;
    }

    // Add role with retry logic
    let retries = 2;
    while (retries >= 0) {
      try {
        await targetMember.roles.add(
          targetRole,
          `Temporary role assigned by ${interaction.user.tag}: ${reason}`,
        );
        break;
      } catch (err) {
        if (retries === 0) throw err;
        await new Promise(resolve => {
          setTimeout(resolve, 1000);
        });
        retries--;
      }
    }

    // Store temporary role data
    await addTemporaryRole(
      interaction.guild.id,
      userId,
      targetRole.id,
      expiresAt,
    );

    // Send DM to user
    try {
      const userEmbed = createTempRoleEmbed(
        interaction,
        targetRole,
        [],
        durationStr,
        expiresAt,
        reason,
      );
      await targetMember.user.send({ embeds: [userEmbed] });
    } catch (dmError) {
      // DM failed, but role was assigned successfully
      logger.warn(`Failed to send DM to user ${userId}`, dmError);
    }

    result.status = "✅ Role assigned successfully";
    return result;
  } catch (error) {
    result.status = "❌ Failed to assign role";
    result.error = error.message;
    return result;
  }
}
