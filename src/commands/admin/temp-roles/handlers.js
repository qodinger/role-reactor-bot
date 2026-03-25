import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  processUserList,
  validateRole,
  validateDuration,
  logTempRoleAssignment,
  processTempRoles,
  logTempRolesListing,
  removeRoleFromUser,
  logTempRoleRemoval,
} from "./utils.js";
import {
  createTempRoleEmbed,
  createTempRolesListEmbed,
  createTempRoleRemovalEmbed,
} from "./embeds.js";
import { FREE_TIER, PRO_TIER, CORE_STATUS } from "../../../features/premium/config.js";
import { getPremiumManager } from "../../../features/premium/PremiumManager.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import {
  addTemporaryRolesForMultipleUsers,
  getTemporaryRoles,
  getUserTemporaryRoles,
} from "../../../utils/discord/tempRoles.js";
import {
  acquireBulkSlot,
  BulkQueueTimeoutError,
} from "../../../utils/bulkLimiter.js";

/**
 * Handle assign subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {boolean} deferred
 */
export async function handleAssign(interaction, client, deferred) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    const usersString = interaction.options.getString("users", true);
    const role = /** @type {import('discord.js').Role} */ (
      interaction.options.getRole("role", true)
    );
    const duration = interaction.options.getString("duration", true);
    const reason =
      interaction.options.getString("reason") || "No reason provided";
    const notify = interaction.options.getBoolean("notify") || false;
    const notifyExpiry =
      interaction.options.getBoolean("notify-expiry") || false;

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    const dbManager = await getDatabaseManager();
    if (!dbManager) {
      throw new Error("Database not initialized");
    }

    // VPS Protection: Check active slots (counting both temp roles and scheduled roles)
    const activeTempCount =
      await dbManager.temporaryRoles.collection.countDocuments({
        guildId: interaction.guild.id,
      });
    const activeOneTimeCount =
      await dbManager.scheduledRoles.collection.countDocuments({
        guildId: interaction.guild.id,
        executed: false,
        cancelled: false,
      });
    const activeRecurringCount =
      await dbManager.recurringSchedules.collection.countDocuments({
        guildId: interaction.guild.id,
        active: true,
        cancelled: false,
      });
    const totalActive =
      activeTempCount + activeOneTimeCount + activeRecurringCount;

    const maxActiveSchedules = isPro
      ? PRO_TIER.SCHEDULE_MAX_ACTIVE
      : FREE_TIER.SCHEDULE_MAX_ACTIVE;

    if (totalActive >= maxActiveSchedules) {
      const response = errorEmbed({
        title: "Slot Limit Reached",
        description: `This server has reached the maximum of **${maxActiveSchedules} active temporary/scheduled roles**.`,
        solution: isPro
          ? "Please wait for existing roles to expire or cancel them before assigning new ones."
          : `Upgrade to **${CORE_STATUS.PRO.emoji} Pro Engine** for up to 500 active slots! Enable it on our **[website](https://rolereactor.app)** using Cores. You can purchase Cores on the site or earn them for free with /vote.`,
      });

      return deferred
        ? interaction.editReply(response)
        : interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
    }

    // 1. Validate role
    const roleValidation = validateRole(role, interaction.guild);
    if (!roleValidation.valid) {
      const response = errorEmbed({
        title: "Invalid Role",
        description: roleValidation.error,
        solution: roleValidation.solution,
      });
      return deferred
        ? interaction.editReply(response)
        : interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
    }

    // 2. Validate duration
    const durationValidation = validateDuration(duration);
    if (!durationValidation.valid) {
      const response = errorEmbed({
        title: "Invalid Duration",
        description: durationValidation.error,
        solution: durationValidation.solution,
      });
      return deferred
        ? interaction.editReply(response)
        : interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
    }

    // VPS Protection: Calculate bulk limit early so the parser respects it
    const maxBulk = isPro
      ? PRO_TIER.BULK_ACTION_MAX_MEMBERS
      : FREE_TIER.BULK_ACTION_MAX_MEMBERS;

    // 3. Acquire a global bulk operation slot (limits concurrent heavy operations)
    let release;
    try {
      release = await acquireBulkSlot(interaction.guild.id, { isPro });
    } catch (err) {
      if (err instanceof BulkQueueTimeoutError) {
        const response = errorEmbed({
          title: "Server Busy",
          description:
            "The bot is currently processing bulk operations for other servers. Please try again in a moment.",
          solution:
            "This usually clears within 30 seconds. Try running the command again shortly.",
        });
        return deferred
          ? interaction.editReply(response)
          : interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
      }
      throw err;
    }

    try {
      // 4. Process user list (pass Pro-aware limit to avoid silent truncation)
      const userProcessing = await processUserList(usersString, interaction, {
        maxUsers: maxBulk,
      });
      if (!userProcessing.valid) {
        const response = errorEmbed({
          title: "Invalid Users",
          description: userProcessing.error,
          solution: userProcessing.solution,
        });
        return deferred
          ? interaction.editReply(response)
          : interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
      }

      const validUsers = userProcessing.validUsers;
      const userIds = validUsers.map(u => u.id);

      // Safety net: double-check bulk limit (parser should already enforce this)
      if (userIds.length > maxBulk) {
        const response = errorEmbed({
          title: "Too Many Users",
          description: `You are trying to assign roles to **${userIds.length} users**, but the limit is **${maxBulk} users** per action.`,
          solution: isPro
            ? "Try splitting the assignment into smaller groups."
            : `Upgrade to **${CORE_STATUS.PRO.emoji} Pro Engine** for 10x higher bulk capacity (250 users)! Enable it on our **[website](https://rolereactor.app)** using Cores. You can purchase Cores on the site or earn them for free with /vote.`,
        });

        return deferred
          ? interaction.editReply(response)
          : interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
      }

      // 5. Calculate expiration date
      const { parseDuration } = await import(
        "../../../utils/discord/tempRoles/utils.js"
      );
      const durationMs = parseDuration(duration);
      const expiresAt = new Date(Date.now() + durationMs);

      // 6. Assign temporary roles (using bulk handler)
      const result = await addTemporaryRolesForMultipleUsers(
        interaction.guild.id,
        userIds,
        role.id,
        expiresAt,
        client,
        notify,
        notifyExpiry,
      );

      // 7. Log the action
      const executionTime = Date.now() - startTime;
      logTempRoleAssignment(
        interaction.user,
        role,
        validUsers,
        duration,
        reason,
        result.results,
        executionTime,
      );

      // 8. Create and send response
      const embed = createTempRoleEmbed(
        role,
        validUsers,
        duration,
        reason,
        result.results,
        client,
      );

      return deferred
        ? interaction.editReply({ embeds: [embed] })
        : interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } finally {
      // Always release the bulk slot
      release();
    }
  } catch (error) {
    logger.error("Error in handleAssign:", error);
    const response = errorEmbed({
      title: "Assignment Failed",
      description:
        "An unexpected error occurred while assigning temporary roles.",
      solution: "Please try again or contact support if the issue persists.",
    });
    return deferred
      ? interaction.editReply(response)
      : interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
  }
}

/**
 * Handle list subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {boolean} deferred
 */
export async function handleList(interaction, client, deferred) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    const targetUser = interaction.options.getUser("user");
    let tempRoles = [];

    if (targetUser) {
      tempRoles = await getUserTemporaryRoles(
        interaction.guild.id,
        targetUser.id,
      );
    } else {
      tempRoles = await getTemporaryRoles(interaction.guild.id);
    }

    // Process roles to add info and filter expired
    const processedRoles = await processTempRoles(tempRoles, interaction.guild);

    // Log listing
    logTempRolesListing(
      interaction.user,
      targetUser,
      processedRoles.length,
      interaction.guild,
      Date.now() - startTime,
    );

    const embed = createTempRolesListEmbed(
      processedRoles,
      targetUser,
      interaction.guild,
      client,
    );

    return deferred
      ? interaction.editReply({ embeds: [embed] })
      : interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    logger.error("Error in handleList:", error);
    const response = errorEmbed({
      title: "Listing Failed",
      description: "An error occurred while fetching temporary roles.",
      solution: "Please try again later.",
    });
    return deferred
      ? interaction.editReply(response)
      : interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
  }
}

/**
 * Handle remove subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {boolean} deferred
 */
export async function handleRemove(interaction, client, deferred) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    const usersString = interaction.options.getString("users", true);
    const role = /** @type {import('discord.js').Role} */ (
      interaction.options.getRole("role", true)
    );
    const reason =
      interaction.options.getString("reason") ||
      "Manually removed by administrator";
    const notify = interaction.options.getBoolean("notify") || false;

    // 1. Process user list
    const userProcessing = await processUserList(usersString, interaction);
    if (!userProcessing.valid) {
      const response = errorEmbed({
        title: "Invalid Users",
        description: userProcessing.error,
        solution: userProcessing.solution,
      });
      return deferred
        ? interaction.editReply(response)
        : interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
    }

    const validUsers = userProcessing.validUsers;
    const results = [];

    // 2. Process removals
    for (const user of validUsers) {
      const result = await removeRoleFromUser(
        user,
        role,
        interaction.guild,
        reason,
      );
      results.push(result);

      // Notify if requested
      if (notify && result.success) {
        try {
          const { createTempRoleRemovedEmbed } = await import("./embeds.js");
          const dmEmbed = createTempRoleRemovedEmbed(
            user,
            role,
            reason,
            interaction.user,
            result.tempRole,
            client,
          );
          await user.send({ embeds: [dmEmbed] }).catch(() => {
            logger.debug(`Could not send removal DM to ${user.tag}`);
          });
        } catch (dmError) {
          logger.debug(
            `Error sending removal notification: ${dmError.message}`,
          );
        }
      }
    }

    // 3. Log results
    logTempRoleRemoval(
      interaction.user,
      role,
      validUsers,
      reason,
      results,
      Date.now() - startTime,
    );

    // 4. Send response
    const embed = createTempRoleRemovalEmbed(
      role,
      validUsers,
      reason,
      results,
      interaction.user,
      client,
    );

    return deferred
      ? interaction.editReply({ embeds: [embed] })
      : interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    logger.error("Error in handleRemove:", error);
    const response = errorEmbed({
      title: "Removal Failed",
      description: "An error occurred while removing temporary roles.",
      solution: "Please try again or check bot permissions.",
    });
    return deferred
      ? interaction.editReply(response)
      : interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
  }
}
