import { PermissionFlagsBits, EmbedBuilder, MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { THEME, EMOJIS } from "../../../config/theme.js";
import { delay } from "../../../utils/delay.js";
import {
  canModerateMember,
  botCanModerateMember,
  validateTimeoutDuration,
  formatDuration,
  logModerationAction,
  getWarnCount,
  getModerationHistory,
  getAllModerationHistory,
  removeWarning,
  parseMultipleUsers,
} from "./utils.js";
import config from "../../../config/config.js";
import {
  createTimeoutEmbed,
  createWarnEmbed,
  createPurgeEmbed,
  createHistoryEmbed,
  createHistoryPaginationButtons,
  createWarningDMEmbed,
  createTimeoutDMEmbed,
  createBanDMEmbed,
  createKickDMEmbed,
  createUnbanDMEmbed,
  createBansListEmbed,
  createBulkOperationEmbed,
  createModerationErrorEmbed,
} from "./embeds.js";

const logger = getLogger();

/**
 * Helper function to execute a moderation action with rate limit handling
 * @param {Function} action - The moderation action to execute (async function)
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<void>}
 */
async function executeWithRateLimitHandling(action, maxRetries = 3) {
  let retries = maxRetries;
  let lastError = null;

  while (retries > 0) {
    try {
      await action();
      return; // Success, exit retry loop
    } catch (error) {
      lastError = error;
      // Check if it's a rate limit error (429)
      const isRateLimit =
        error.code === 429 ||
        error.status === 429 ||
        error.message?.toLowerCase().includes("rate limit");

      if (isRateLimit && retries > 1) {
        // Calculate retry delay (use Discord's retry_after if available, otherwise exponential backoff)
        const retryDelay = error.retry_after
          ? error.retry_after * 1000
          : Math.min(1000 * Math.pow(2, maxRetries - retries), 5000);
        logger.warn(
          `Rate limited, retrying in ${retryDelay}ms (${retries - 1} retries left)`,
        );
        await delay(retryDelay);
        retries--;
      } else {
        throw error; // Not a rate limit error or out of retries
      }
    }
  }

  if (lastError) {
    throw lastError; // All retries exhausted
  }
}

/**
 * Handle timeout subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleTimeout(interaction, client) {
  try {
    const usersString = interaction.options.getString("users", true);
    const durationStr = interaction.options.getString("duration");
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    // Validate duration
    const durationValidation = validateTimeoutDuration(durationStr);
    if (!durationValidation.valid) {
      const embed = createModerationErrorEmbed(
        "Invalid Duration",
        durationValidation.error,
        durationValidation.solution,
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Parse users (can be single or multiple)
    const userValidation = await parseMultipleUsers(
      usersString,
      interaction.guild,
      client,
    );

    if (!userValidation.valid) {
      const embed = createModerationErrorEmbed(
        "Invalid Users",
        userValidation.error,
        userValidation.solution,
      );
      return interaction.editReply({ embeds: [embed] });
    }

    const validUsers = userValidation.validUsers;
    const MAX_BULK_OPERATIONS = 15; // Optimized for performance and safety
    if (validUsers.length > MAX_BULK_OPERATIONS) {
      const embed = createModerationErrorEmbed(
        "Too Many Users",
        `You can only timeout up to ${MAX_BULK_OPERATIONS} users at once. You provided ${validUsers.length} users.`,
        `Please split the operation into smaller batches of ${MAX_BULK_OPERATIONS} or fewer.`,
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Single user - use simpler embed
    if (validUsers.length === 1) {
      const { user: targetUser, member: targetMember } = validUsers[0];

      if (!targetMember) {
        const embed = createModerationErrorEmbed(
          "Member Not Found",
          "The user is not a member of this server.",
        );
        return interaction.editReply({ embeds: [embed] });
      }

      // Check if moderator can moderate target
      const canModerate = canModerateMember(interaction.member, targetMember);
      if (!canModerate.canModerate) {
        const embed = createModerationErrorEmbed(
          "Cannot Moderate",
          canModerate.reason,
        );
        return interaction.editReply({ embeds: [embed] });
      }

      // Check if bot can moderate target
      const botMember = interaction.guild.members.me;
      const botCanModerate = botCanModerateMember(botMember, targetMember);
      if (!botCanModerate.canModerate) {
        const embed = createModerationErrorEmbed(
          "Bot Cannot Moderate",
          botCanModerate.reason,
          "Move the bot's role above the target user's highest role in Server Settings → Roles",
        );
        return interaction.editReply({ embeds: [embed] });
      }

      // Check bot permissions
      if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        const embed = createModerationErrorEmbed(
          "Missing Bot Permissions",
          "I need the `Moderate Members` permission to timeout users.",
          "Please grant me the `Moderate Members` permission in Server Settings → Roles",
        );
        return interaction.editReply({ embeds: [embed] });
      }

      // Timeout the member
      await targetMember.timeout(durationValidation.milliseconds, reason);

      // Calculate timeout end time for logging
      const timeoutUntil = new Date(
        Date.now() + durationValidation.milliseconds,
      );

      // Log the action
      const caseId = await logModerationAction({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        action: "timeout",
        reason,
        metadata: {
          duration: durationValidation.milliseconds,
          durationFormatted: formatDuration(durationValidation.milliseconds),
          timeoutUntil: timeoutUntil.toISOString(),
        },
      });

      // Send DM notification to user (if possible)
      try {
        const dmEmbed = createTimeoutDMEmbed(
          interaction.guild,
          formatDuration(durationValidation.milliseconds),
          reason,
          caseId,
        );
        await targetUser.send({ embeds: [dmEmbed] });
        logger.debug(
          `📧 Sent timeout DM to ${targetUser.tag} (${targetUser.id})`,
        );
      } catch (dmError) {
        logger.debug(
          `${EMOJIS.MODERATION.WARN} Could not send timeout DM to ${targetUser.tag} (${targetUser.id}): ${dmError.message}`,
        );
      }

      // Create success embed
      const embed = createTimeoutEmbed(
        targetUser,
        formatDuration(durationValidation.milliseconds),
        reason,
        caseId,
      );

      await interaction.editReply({ embeds: [embed] });

      logger.info(
        `${EMOJIS.MODERATION.TIMEOUT} User ${targetUser.tag} (${targetUser.id}) timed out by ${interaction.user.tag} (${interaction.user.id}) for ${formatDuration(durationValidation.milliseconds)} - Reason: ${reason}`,
      );
      return;
    }

    // Multiple users
    const results = { success: [], failed: [] };
    // Reduced delay: Discord.js handles global rate limits automatically
    // This delay prevents per-route rate limits (5 ops/5s per guild for moderation actions)
    const OPERATION_DELAY = 150; // 150ms delay = ~6.6 ops/sec (safe for 5 ops/5s limit)

    for (let i = 0; i < validUsers.length; i++) {
      const { user, member } = validUsers[i];

      // Add delay between operations to respect Discord rate limits
      if (i > 0) {
        await delay(OPERATION_DELAY);
      }

      try {
        if (!member) {
          results.failed.push({ user, error: "User is not in the server" });
          continue;
        }

        const canModerate = canModerateMember(interaction.member, member);
        if (!canModerate.canModerate) {
          results.failed.push({
            user,
            error: canModerate.reason || "Cannot moderate this user",
          });
          continue;
        }

        const botCanModerate = botCanModerateMember(
          interaction.guild.members.me,
          member,
        );
        if (!botCanModerate.canModerate) {
          results.failed.push({
            user,
            error: botCanModerate.reason || "Bot cannot moderate this user",
          });
          continue;
        }

        // Execute timeout with rate limit handling
        await executeWithRateLimitHandling(
          () => member.timeout(durationValidation.milliseconds, reason),
          3,
        );
        const caseId = await logModerationAction({
          guildId: interaction.guild.id,
          userId: user.id,
          moderatorId: interaction.user.id,
          action: "timeout",
          reason,
          metadata: {
            duration: durationValidation.milliseconds,
            durationFormatted: formatDuration(durationValidation.milliseconds),
          },
        });

        try {
          const dmEmbed = createTimeoutDMEmbed(
            interaction.guild,
            formatDuration(durationValidation.milliseconds),
            reason,
            caseId,
          );
          await user.send({ embeds: [dmEmbed] });
        } catch (dmError) {
          logger.debug(
            `Failed to send timeout DM to ${user.tag}: ${dmError.message}`,
          );
        }

        results.success.push({ user, caseId });
      } catch (error) {
        logger.error(`Error timing out user ${user.id}:`, error);
        results.failed.push({
          user,
          error: error.message || "Unknown error",
        });
      }
    }

    const embed = createBulkOperationEmbed(
      "Timeout",
      results.success.length,
      results.failed.length,
      validUsers.length,
      results.success.map(r => r.user),
      results.failed.map(r => ({ user: r.user, error: r.error })),
      `Duration: ${formatDuration(durationValidation.milliseconds)}`,
      reason,
    );

    await interaction.editReply({ embeds: [embed] });
    logger.info(
      `${EMOJIS.MODERATION.TIMEOUT} Timeout: ${results.success.length} succeeded, ${results.failed.length} failed by ${interaction.user.tag} (${interaction.user.id})`,
    );
  } catch (error) {
    logger.error("Error handling timeout:", error);
    const embed = createModerationErrorEmbed(
      "Timeout Failed",
      error.message || "An error occurred while timing out the user.",
    );
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle warn subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleWarn(interaction, client) {
  try {
    const usersString = interaction.options.getString("users", true);
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    // Parse users (can be single or multiple)
    const userValidation = await parseMultipleUsers(
      usersString,
      interaction.guild,
      client,
    );

    if (!userValidation.valid) {
      const embed = createModerationErrorEmbed(
        "Invalid Users",
        userValidation.error,
        userValidation.solution,
      );
      return interaction.editReply({ embeds: [embed] });
    }

    const validUsers = userValidation.validUsers;
    const MAX_BULK_OPERATIONS = 15; // Optimized for performance and safety
    if (validUsers.length > MAX_BULK_OPERATIONS) {
      const embed = createModerationErrorEmbed(
        "Too Many Users",
        `You can only warn up to ${MAX_BULK_OPERATIONS} users at once. You provided ${validUsers.length} users.`,
        `Please split the operation into smaller batches of ${MAX_BULK_OPERATIONS} or fewer.`,
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Single user - use simpler embed
    if (validUsers.length === 1) {
      const { user: targetUser, member: targetMember } = validUsers[0];

      if (!targetMember) {
        const embed = createModerationErrorEmbed(
          "Member Not Found",
          "The user is not a member of this server.",
        );
        return interaction.editReply({ embeds: [embed] });
      }

      const canModerate = canModerateMember(interaction.member, targetMember);
      if (!canModerate.canModerate) {
        const embed = createModerationErrorEmbed(
          "Cannot Moderate",
          canModerate.reason,
        );
        return interaction.editReply({ embeds: [embed] });
      }

      // Log the warning
      const caseId = await logModerationAction({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        action: "warn",
        reason,
      });

      // Get total warn count
      const warnCount = await getWarnCount(interaction.guild.id, targetUser.id);

      // Send DM notification to user (if possible)
      try {
        const dmEmbed = createWarningDMEmbed(
          interaction.guild,
          reason,
          warnCount,
          caseId,
        );
        await targetUser.send({ embeds: [dmEmbed] });
        logger.debug(
          `📧 Sent warning DM to ${targetUser.tag} (${targetUser.id})`,
        );
      } catch (dmError) {
        logger.debug(
          `${EMOJIS.MODERATION.WARN} Could not send warning DM to ${targetUser.tag} (${targetUser.id}): ${dmError.message}`,
        );
      }

      // Check for auto-escalation
      const autoEscalation = config.corePricing?.autoEscalation || {};
      const timeoutAfterWarnings = autoEscalation.timeoutAfterWarnings || 0;
      const kickAfterWarnings = autoEscalation.kickAfterWarnings || 0;
      const timeoutDuration = autoEscalation.timeoutDuration || "1h";

      let escalationAction = null;
      let escalationMessage = "";

      // Auto-kick (higher priority than timeout)
      if (kickAfterWarnings > 0 && warnCount >= kickAfterWarnings) {
        try {
          await targetMember.kick(
            `Auto-kicked after ${warnCount} warnings (threshold: ${kickAfterWarnings})`,
          );
          escalationAction = "kick";
          escalationMessage = `User was automatically kicked after reaching ${warnCount} warnings (threshold: ${kickAfterWarnings})`;
          logger.info(
            `${EMOJIS.MODERATION.KICK} Auto-kicked ${targetUser.tag} (${targetUser.id}) after ${warnCount} warnings`,
          );
        } catch (kickError) {
          logger.error(
            `Failed to auto-kick ${targetUser.tag} after ${warnCount} warnings:`,
            kickError,
          );
        }
      }
      // Auto-timeout (if not kicked and threshold reached)
      else if (
        timeoutAfterWarnings > 0 &&
        warnCount >= timeoutAfterWarnings &&
        !escalationAction
      ) {
        try {
          const durationValidation = validateTimeoutDuration(timeoutDuration);
          if (durationValidation.valid) {
            await targetMember.timeout(
              durationValidation.milliseconds,
              `Auto-timeout after ${warnCount} warnings (threshold: ${timeoutAfterWarnings})`,
            );
            escalationAction = "timeout";
            escalationMessage = `User was automatically timed out for ${formatDuration(durationValidation.milliseconds)} after reaching ${warnCount} warnings (threshold: ${timeoutAfterWarnings})`;
            logger.info(
              `${EMOJIS.MODERATION.TIMEOUT} Auto-timed out ${targetUser.tag} (${targetUser.id}) after ${warnCount} warnings`,
            );
          }
        } catch (timeoutError) {
          logger.error(
            `Failed to auto-timeout ${targetUser.tag} after ${warnCount} warnings:`,
            timeoutError,
          );
        }
      }

      // Create success embed
      const embed = createWarnEmbed(
        targetUser,
        reason,
        warnCount,
        caseId,
        escalationMessage,
      );

      await interaction.editReply({ embeds: [embed] });

      logger.info(
        `${EMOJIS.MODERATION.WARN} User ${targetUser.tag} (${targetUser.id}) warned by ${interaction.user.tag} (${interaction.user.id}) - Reason: ${reason} (Total warnings: ${warnCount})${escalationAction ? ` - Auto-${escalationAction} triggered` : ""}`,
      );
      return;
    }

    // Multiple users
    {
      const userValidation = await parseMultipleUsers(
        usersString,
        interaction.guild,
        client,
      );

      if (!userValidation.valid) {
        const embed = createModerationErrorEmbed(
          "Invalid Users",
          userValidation.error,
          userValidation.solution,
        );
        return interaction.editReply({ embeds: [embed] });
      }

      const validUsers = userValidation.validUsers;
      const MAX_BULK_OPERATIONS = 15; // Optimized for performance and safety
      if (validUsers.length > MAX_BULK_OPERATIONS) {
        const embed = createModerationErrorEmbed(
          "Too Many Users",
          `You can only warn up to ${MAX_BULK_OPERATIONS} users at once. You provided ${validUsers.length} users.`,
          `Please split the operation into smaller batches of ${MAX_BULK_OPERATIONS} or fewer.`,
        );
        return interaction.editReply({ embeds: [embed] });
      }

      const results = { success: [], failed: [] };
      // Reduced delay: Discord.js handles global rate limits automatically
      // This delay prevents per-route rate limits (5 ops/5s per guild for moderation actions)
      const OPERATION_DELAY = 150; // 150ms delay = ~6.6 ops/sec (safe for 5 ops/5s limit)

      for (let i = 0; i < validUsers.length; i++) {
        const { user, member } = validUsers[i];

        // Add delay between operations to respect Discord rate limits
        if (i > 0) {
          await delay(OPERATION_DELAY);
        }

        try {
          if (!member) {
            results.failed.push({ user, error: "User is not in the server" });
            continue;
          }

          const canModerate = canModerateMember(interaction.member, member);
          if (!canModerate.canModerate) {
            results.failed.push({
              user,
              error: canModerate.reason || "Cannot moderate this user",
            });
            continue;
          }

          const caseId = await logModerationAction({
            guildId: interaction.guild.id,
            userId: user.id,
            moderatorId: interaction.user.id,
            action: "warn",
            reason,
          });

          const warnCount = await getWarnCount(interaction.guild.id, user.id);

          try {
            const dmEmbed = createWarningDMEmbed(
              interaction.guild,
              reason,
              warnCount,
              caseId,
            );
            await user.send({ embeds: [dmEmbed] });
          } catch (dmError) {
            logger.debug(
              `Failed to send warning DM to ${user.tag}: ${dmError.message}`,
            );
          }

          // Check for auto-escalation
          const autoEscalation = config.corePricing?.autoEscalation || {};
          const timeoutAfterWarnings = autoEscalation.timeoutAfterWarnings || 0;
          const kickAfterWarnings = autoEscalation.kickAfterWarnings || 0;
          const timeoutDuration = autoEscalation.timeoutDuration || "1h";

          let escalationNote = "";
          if (kickAfterWarnings > 0 && warnCount >= kickAfterWarnings) {
            try {
              await member.kick(
                `Auto-kicked after ${warnCount} warnings (threshold: ${kickAfterWarnings})`,
              );
              escalationNote = ` (auto-kicked at ${warnCount} warnings)`;
              logger.info(
                `${EMOJIS.MODERATION.KICK} Auto-kicked ${user.tag} (${user.id}) after ${warnCount} warnings`,
              );
            } catch (kickError) {
              logger.error(`Failed to auto-kick ${user.tag}:`, kickError);
            }
          } else if (
            timeoutAfterWarnings > 0 &&
            warnCount >= timeoutAfterWarnings
          ) {
            try {
              const durationValidation =
                validateTimeoutDuration(timeoutDuration);
              if (durationValidation.valid) {
                await member.timeout(
                  durationValidation.milliseconds,
                  `Auto-timeout after ${warnCount} warnings (threshold: ${timeoutAfterWarnings})`,
                );
                escalationNote = ` (auto-timed out at ${warnCount} warnings)`;
                logger.info(
                  `${EMOJIS.MODERATION.TIMEOUT} Auto-timed out ${user.tag} (${user.id}) after ${warnCount} warnings`,
                );
              }
            } catch (timeoutError) {
              logger.error(`Failed to auto-timeout ${user.tag}:`, timeoutError);
            }
          }

          results.success.push({ user, caseId, escalationNote });
        } catch (error) {
          logger.error(`Error warning user ${user.id}:`, error);
          results.failed.push({
            user,
            error: error.message || "Unknown error",
          });
        }
      }

      const embed = createBulkOperationEmbed(
        "Warn",
        results.success.length,
        results.failed.length,
        validUsers.length,
        results.success.map(r => r.user),
        results.failed.map(r => ({ user: r.user, error: r.error })),
        null,
        reason,
      );

      await interaction.editReply({ embeds: [embed] });
      logger.info(
        `${EMOJIS.MODERATION.WARN} Warn: ${results.success.length} succeeded, ${results.failed.length} failed by ${interaction.user.tag} (${interaction.user.id})`,
      );
    }
  } catch (error) {
    logger.error("Error handling warn:", error);
    const embed = createModerationErrorEmbed(
      "Warn Failed",
      error.message || "An error occurred while warning the user.",
    );
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle ban subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleBan(interaction, client) {
  try {
    const usersString = interaction.options.getString("users", true);
    const reason =
      interaction.options.getString("reason") || "No reason provided";
    const deleteDays = interaction.options.getInteger("delete-days") || 0;

    // Parse users (can be single or multiple)
    {
      const userValidation = await parseMultipleUsers(
        usersString,
        interaction.guild,
        client,
      );

      if (!userValidation.valid) {
        const embed = createModerationErrorEmbed(
          "Invalid Users",
          userValidation.error,
          userValidation.solution,
        );
        return interaction.editReply({ embeds: [embed] });
      }

      const validUsers = userValidation.validUsers;
      const MAX_BULK_OPERATIONS = 15; // Optimized for performance and safety
      if (validUsers.length > MAX_BULK_OPERATIONS) {
        const embed = createModerationErrorEmbed(
          "Too Many Users",
          `You can only ban up to ${MAX_BULK_OPERATIONS} users at once. You provided ${validUsers.length} users.`,
          `Please split the operation into smaller batches of ${MAX_BULK_OPERATIONS} or fewer.`,
        );
        return interaction.editReply({ embeds: [embed] });
      }

      const results = { success: [], failed: [] };
      // Reduced delay: Discord.js handles global rate limits automatically
      // This delay prevents per-route rate limits (5 ops/5s per guild for moderation actions)
      const OPERATION_DELAY = 150; // 150ms delay = ~6.6 ops/sec (safe for 5 ops/5s limit)

      // Fetch all bans once to check against (more efficient than checking each user individually)
      const existingBans = await interaction.guild.bans.fetch();

      for (let i = 0; i < validUsers.length; i++) {
        const { user, member } = validUsers[i];

        // Add delay between operations to respect Discord rate limits
        if (i > 0) {
          await delay(OPERATION_DELAY);
        }

        try {
          if (member) {
            const canModerate = canModerateMember(interaction.member, member);
            if (!canModerate.canModerate) {
              results.failed.push({
                user,
                error: canModerate.reason || "Cannot moderate this user",
              });
              continue;
            }

            const botCanModerate = botCanModerateMember(
              interaction.guild.members.me,
              member,
            );
            if (!botCanModerate.canModerate) {
              results.failed.push({
                user,
                error: botCanModerate.reason || "Bot cannot moderate this user",
              });
              continue;
            }
          }

          // Check if user is already banned (using pre-fetched bans)
          if (existingBans.has(user.id)) {
            results.failed.push({ user, error: "User is already banned" });
            continue;
          }

          // Execute ban with rate limit handling
          await executeWithRateLimitHandling(
            () =>
              interaction.guild.members.ban(user.id, {
                reason: `${reason} (Ban by ${interaction.user.tag})`,
                deleteMessageDays: deleteDays,
              }),
            3,
          );

          const caseId = await logModerationAction({
            guildId: interaction.guild.id,
            userId: user.id,
            moderatorId: interaction.user.id,
            action: "ban",
            reason,
            metadata: { deleteDays },
          });

          try {
            const dmEmbed = createBanDMEmbed(interaction.guild, reason, caseId);
            await user.send({ embeds: [dmEmbed] });
          } catch (dmError) {
            logger.debug(
              `Failed to send ban DM to ${user.tag}: ${dmError.message}`,
            );
          }

          results.success.push({ user, caseId });
        } catch (error) {
          logger.error(`Error banning user ${user.id}:`, error);
          results.failed.push({
            user,
            error: error.message || "Unknown error",
          });
        }
      }

      const embed = createBulkOperationEmbed(
        "Ban",
        results.success.length,
        results.failed.length,
        validUsers.length,
        results.success.map(r => r.user),
        results.failed.map(r => ({ user: r.user, error: r.error })),
        deleteDays > 0
          ? `Deleted ${deleteDays} day${deleteDays !== 1 ? "s" : ""} of messages`
          : null,
        reason,
      );

      await interaction.editReply({ embeds: [embed] });
      logger.info(
        `${EMOJIS.MODERATION.BAN} Ban: ${results.success.length} succeeded, ${results.failed.length} failed by ${interaction.user.tag} (${interaction.user.id})`,
      );
      return;
    }
  } catch (error) {
    logger.error("Error handling ban:", error);
    const embed = createModerationErrorEmbed(
      "Ban Failed",
      error.message || "An error occurred while banning the user.",
    );
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle kick subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleKick(interaction, client) {
  try {
    const usersString = interaction.options.getString("users", true);
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    // Parse users (can be single or multiple)
    {
      const userValidation = await parseMultipleUsers(
        usersString,
        interaction.guild,
        client,
      );

      if (!userValidation.valid) {
        const embed = createModerationErrorEmbed(
          "Invalid Users",
          userValidation.error,
          userValidation.solution,
        );
        return interaction.editReply({ embeds: [embed] });
      }

      const validUsers = userValidation.validUsers;
      const MAX_BULK_OPERATIONS = 15; // Optimized for performance and safety
      if (validUsers.length > MAX_BULK_OPERATIONS) {
        const embed = createModerationErrorEmbed(
          "Too Many Users",
          `You can only kick up to ${MAX_BULK_OPERATIONS} users at once. You provided ${validUsers.length} users.`,
          `Please split the operation into smaller batches of ${MAX_BULK_OPERATIONS} or fewer.`,
        );
        return interaction.editReply({ embeds: [embed] });
      }

      const results = { success: [], failed: [] };
      // Reduced delay: Discord.js handles global rate limits automatically
      // This delay prevents per-route rate limits (5 ops/5s per guild for moderation actions)
      const OPERATION_DELAY = 150; // 150ms delay = ~6.6 ops/sec (safe for 5 ops/5s limit)

      for (let i = 0; i < validUsers.length; i++) {
        const { user, member } = validUsers[i];

        // Add delay between operations to respect Discord rate limits
        if (i > 0) {
          await delay(OPERATION_DELAY);
        }

        try {
          if (!member) {
            results.failed.push({ user, error: "User is not in the server" });
            continue;
          }

          const canModerate = canModerateMember(interaction.member, member);
          if (!canModerate.canModerate) {
            results.failed.push({
              user,
              error: canModerate.reason || "Cannot moderate this user",
            });
            continue;
          }

          const botCanModerate = botCanModerateMember(
            interaction.guild.members.me,
            member,
          );
          if (!botCanModerate.canModerate) {
            results.failed.push({
              user,
              error: botCanModerate.reason || "Bot cannot moderate this user",
            });
            continue;
          }

          // Execute kick with rate limit handling
          await executeWithRateLimitHandling(
            () => member.kick(`${reason} (Kick by ${interaction.user.tag})`),
            3,
          );

          const caseId = await logModerationAction({
            guildId: interaction.guild.id,
            userId: user.id,
            moderatorId: interaction.user.id,
            action: "kick",
            reason,
          });

          try {
            const dmEmbed = createKickDMEmbed(
              interaction.guild,
              reason,
              caseId,
            );
            await user.send({ embeds: [dmEmbed] });
          } catch (dmError) {
            logger.debug(
              `Failed to send kick DM to ${user.tag}: ${dmError.message}`,
            );
          }

          results.success.push({ user, caseId });
        } catch (error) {
          logger.error(`Error kicking user ${user.id}:`, error);
          results.failed.push({
            user,
            error: error.message || "Unknown error",
          });
        }
      }

      const embed = createBulkOperationEmbed(
        "Kick",
        results.success.length,
        results.failed.length,
        validUsers.length,
        results.success.map(r => r.user),
        results.failed.map(r => ({ user: r.user, error: r.error })),
        null,
        reason,
      );

      await interaction.editReply({ embeds: [embed] });
      logger.info(
        `${EMOJIS.MODERATION.KICK} Kick: ${results.success.length} succeeded, ${results.failed.length} failed by ${interaction.user.tag} (${interaction.user.id})`,
      );
      return;
    }
  } catch (error) {
    logger.error("Error handling kick:", error);
    const embed = createModerationErrorEmbed(
      "Kick Failed",
      error.message || "An error occurred while kicking the user.",
    );
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle unban subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleUnban(interaction, client) {
  try {
    const usersString = interaction.options.getString("users", true);

    // Check bot permissions
    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      const embed = createModerationErrorEmbed(
        "Missing Bot Permissions",
        "I need the `Ban Members` permission to unban users.",
        "Please grant me the `Ban Members` permission in Server Settings → Roles",
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Parse users (can be single or multiple)
    const userValidation = await parseMultipleUsers(
      usersString,
      interaction.guild,
      client,
    );

    if (!userValidation.valid) {
      const embed = createModerationErrorEmbed(
        "Invalid Users",
        userValidation.error,
        userValidation.solution,
      );
      return interaction.editReply({ embeds: [embed] });
    }

    const validUsers = userValidation.validUsers;
    const MAX_BULK_OPERATIONS = 15; // Same limit as other bulk operations
    if (validUsers.length > MAX_BULK_OPERATIONS) {
      const embed = createModerationErrorEmbed(
        "Too Many Users",
        `You can only unban up to ${MAX_BULK_OPERATIONS} users at once. You provided ${validUsers.length} users.`,
        `Please split the operation into smaller batches of ${MAX_BULK_OPERATIONS} or fewer.`,
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Fetch all bans to check which users are actually banned
    const bans = await interaction.guild.bans.fetch();
    const results = { success: [], failed: [] };
    const OPERATION_DELAY = 150; // 150ms delay between operations

    for (let i = 0; i < validUsers.length; i++) {
      const { user } = validUsers[i];

      // Add delay between operations to respect Discord rate limits
      if (i > 0) {
        await delay(OPERATION_DELAY);
      }

      try {
        // Check if user is actually banned
        const ban = bans.get(user.id);
        if (!ban) {
          results.failed.push({
            user,
            error: "User is not banned",
          });
          continue;
        }

        // Execute unban with rate limit handling
        await executeWithRateLimitHandling(
          () =>
            interaction.guild.members.unban(
              user.id,
              `Unbanned by ${interaction.user.tag}`,
            ),
          3,
        );

        // Log the action
        const caseId = await logModerationAction({
          guildId: interaction.guild.id,
          userId: user.id,
          moderatorId: interaction.user.id,
          action: "unban",
          reason: `Unbanned by ${interaction.user.tag}`,
        });

        // Send DM notification to user (if possible)
        try {
          const dmEmbed = createUnbanDMEmbed(interaction.guild, caseId);
          await user.send({ embeds: [dmEmbed] });
          logger.debug(`📧 Sent unban DM to ${user.tag} (${user.id})`);
        } catch (dmError) {
          logger.debug(
            `${EMOJIS.MODERATION.WARN} Could not send unban DM to ${user.tag} (${user.id}): ${dmError.message}`,
          );
        }

        results.success.push({ user, caseId });
      } catch (error) {
        logger.error(`Error unbanning user ${user.id}:`, error);
        results.failed.push({
          user,
          error: error.message || "Unknown error",
        });
      }
    }

    const embed = createBulkOperationEmbed(
      "Unban",
      results.success.length,
      results.failed.length,
      validUsers.length,
      results.success.map(r => r.user),
      results.failed.map(r => ({ user: r.user, error: r.error })),
      null,
      `Unbanned by ${interaction.user.tag}`,
    );

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      `${EMOJIS.MODERATION.UNBAN} Unban: ${results.success.length} succeeded, ${results.failed.length} failed by ${interaction.user.tag} (${interaction.user.id})`,
    );
  } catch (error) {
    logger.error("Error handling unban:", error);
    const embed = createModerationErrorEmbed(
      "Unban Failed",
      error.message || "An error occurred while unbanning the user.",
    );
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle purge subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handlePurge(interaction, _client) {
  try {
    const amount = interaction.options.getInteger("amount");
    const channel =
      interaction.options.getChannel("channel") || interaction.channel;

    // Validate amount (1-100)
    if (amount < 1 || amount > 100) {
      const embed = createModerationErrorEmbed(
        "Invalid Amount",
        "You can only purge between 1 and 100 messages at a time.",
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Check if channel is a text channel
    if (!channel.isTextBased() || channel.isThread()) {
      const embed = createModerationErrorEmbed(
        "Invalid Channel",
        "You can only purge messages in text channels.",
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Check bot permissions
    const botMember = interaction.guild.members.me;
    if (
      !botMember.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages)
    ) {
      const embed = createModerationErrorEmbed(
        "Missing Bot Permissions",
        `I need the \`Manage Messages\` permission in ${channel} to purge messages.`,
        `Please grant me the \`Manage Messages\` permission in ${channel}`,
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Fetch messages
    const messages = await channel.messages.fetch({ limit: amount });

    if (messages.size === 0) {
      const embed = createModerationErrorEmbed(
        "No Messages Found",
        `No messages found in ${channel} to delete.`,
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Filter out messages older than 14 days (Discord bulkDelete limitation)
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const deletableMessages = messages.filter(
      msg => msg.createdTimestamp > fourteenDaysAgo,
    );

    if (deletableMessages.size === 0) {
      const embed = createModerationErrorEmbed(
        "Messages Too Old",
        `All messages in ${channel} are older than 14 days. Discord only allows bulk deletion of messages less than 14 days old.`,
        "Try deleting individual messages or use a different channel.",
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Delete messages
    const deleted = await channel.bulkDelete(deletableMessages, true);

    // Create success embed with additional info if some messages couldn't be deleted
    let description = `Deleted **${deleted.size}** message${deleted.size !== 1 ? "s" : ""} in ${channel}`;
    if (messages.size > deletableMessages.size) {
      const skipped = messages.size - deletableMessages.size;
      description += `\n\n${EMOJIS.STATUS.WARNING} ${skipped} message${skipped !== 1 ? "s were" : " was"} skipped (older than 14 days)`;
    }

    const embed = createPurgeEmbed(deleted.size, channel, description);

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      `🧹 ${deleted.size} message(s) purged in ${channel.name} (${channel.id}) by ${interaction.user.tag} (${interaction.user.id})${messages.size > deletableMessages.size ? ` (${messages.size - deletableMessages.size} skipped - too old)` : ""}`,
    );
  } catch (error) {
    logger.error("Error handling purge:", error);
    const embed = createModerationErrorEmbed(
      "Purge Failed",
      error.message || "An error occurred while purging messages.",
    );
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle history subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleHistory(interaction, client) {
  try {
    const targetUser = interaction.options.getUser("user");
    const isServerHistory = !targetUser;

    let history;
    let warnCount = 0;

    if (isServerHistory) {
      // Get all moderation history for the server
      history = await getAllModerationHistory(interaction.guild.id);

      if (history.length === 0) {
        const embed = createModerationErrorEmbed(
          "No History Found",
          "This server has no moderation history.",
        );
        return interaction.editReply({ embeds: [embed] });
      }

      // Get warning count across all users
      warnCount = history.filter(log => log.action === "warn").length;

      // Fetch user information for all unique user IDs in history
      const userIds = [...new Set(history.map(log => log.userId))];
      const userMap = new Map();
      for (const userId of userIds) {
        try {
          const user = await client.users.fetch(userId).catch(() => null);
          if (user) {
            userMap.set(userId, user.tag);
          }
        } catch {
          // Keep user ID if fetch fails
        }
      }

      // Create server history embed (page 1 by default)
      const { embed, totalPages, currentPage } = createHistoryEmbed(
        null, // No target user for server history
        history,
        warnCount,
        1,
        5,
        interaction.guild,
        userMap, // Pass user map instead of client
      );

      // Create pagination buttons if there are multiple pages
      // Use "server" as the identifier for server-wide history
      const components =
        totalPages > 1
          ? createHistoryPaginationButtons(
              currentPage,
              totalPages,
              "server",
              interaction.guild.id,
            )
          : [];

      await interaction.editReply({
        embeds: [embed],
        components,
      });

      logger.info(
        `📋 Server moderation history viewed by ${interaction.user.tag} (${interaction.user.id}) - ${history.length} total actions, ${warnCount} warnings`,
      );
    } else {
      // Get moderation history for specific user
      history = await getModerationHistory(interaction.guild.id, targetUser.id);

      if (history.length === 0) {
        const embed = createModerationErrorEmbed(
          "No History Found",
          `${targetUser.tag} has no moderation history.`,
        );
        return interaction.editReply({ embeds: [embed] });
      }

      // Get warning count
      warnCount = history.filter(log => log.action === "warn").length;

      // Create history embed (page 1 by default)
      const { embed, totalPages, currentPage } = createHistoryEmbed(
        targetUser,
        history,
        warnCount,
        1,
        5,
        null, // No guild needed for user-specific history
        null, // No user map needed for user-specific history
      );

      // Create pagination buttons if there are multiple pages
      const components =
        totalPages > 1
          ? createHistoryPaginationButtons(
              currentPage,
              totalPages,
              targetUser.id,
              null, // No guild ID needed for user-specific history
            )
          : [];

      await interaction.editReply({
        embeds: [embed],
        components,
      });

      logger.info(
        `📋 Moderation history viewed for ${targetUser.tag} (${targetUser.id}) by ${interaction.user.tag} (${interaction.user.id}) - ${history.length} total actions, ${warnCount} warnings`,
      );
    }
  } catch (error) {
    logger.error("Error handling history:", error);
    const embed = createModerationErrorEmbed(
      "History Failed",
      error.message || "An error occurred while fetching moderation history.",
    );
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle moderation history pagination button interactions
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleHistoryPagination(interaction, client) {
  try {
    const customId = interaction.customId;

    // Parse custom ID: mod_history_{prev|next|page}_{userId|server}_{page}
    // For server history, userId will be "server" and we'll use guildId from parts[4]
    const parts = customId.split("_");
    if (parts.length < 5) {
      logger.warn("Invalid moderation history pagination custom ID", {
        customId,
      });
      await interaction.deferUpdate();
      return;
    }

    const identifier = parts[3]; // userId or "server"
    const pageStr = parts[4];
    const page = parseInt(pageStr, 10);

    if (isNaN(page) || page < 1) {
      logger.warn("Invalid page number in moderation history pagination", {
        customId,
        page,
      });
      await interaction.deferUpdate();
      return;
    }

    const isServerHistory = identifier === "server";

    if (isServerHistory) {
      // Server-wide history
      const history = await getAllModerationHistory(interaction.guild.id);

      if (history.length === 0) {
        const embed = createModerationErrorEmbed(
          "No History Found",
          "This server has no moderation history.",
        );
        await interaction.update({ embeds: [embed], components: [] });
        return;
      }

      const warnCount = history.filter(log => log.action === "warn").length;

      // Fetch user information for all unique user IDs in history
      const userIds = [...new Set(history.map(log => log.userId))];
      const userMap = new Map();
      for (const userId of userIds) {
        try {
          const user = await client.users.fetch(userId).catch(() => null);
          if (user) {
            userMap.set(userId, user.tag);
          }
        } catch {
          // Keep user ID if fetch fails
        }
      }

      // Create server history embed with the requested page
      const { embed, totalPages, currentPage } = createHistoryEmbed(
        null, // No target user for server history
        history,
        warnCount,
        page,
        5,
        interaction.guild,
        userMap, // Pass user map instead of client
      );

      // Create pagination buttons
      const components =
        totalPages > 1
          ? createHistoryPaginationButtons(
              currentPage,
              totalPages,
              "server",
              interaction.guild.id,
            )
          : [];

      await interaction.update({
        embeds: [embed],
        components,
      });

      logger.debug(
        `📋 Server moderation history pagination: page ${currentPage}/${totalPages} by ${interaction.user.tag}`,
      );
    } else {
      // User-specific history
      // Fetch the user
      let targetUser;
      try {
        targetUser = await client.users.fetch(identifier);
      } catch (error) {
        logger.error(
          `Failed to fetch user ${identifier} for history pagination:`,
          error,
        );
        await interaction.reply({
          content: "❌ Failed to fetch user information.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Get moderation history
      const history = await getModerationHistory(
        interaction.guild.id,
        targetUser.id,
      );

      if (history.length === 0) {
        const embed = createModerationErrorEmbed(
          "No History Found",
          `${targetUser.tag} has no moderation history.`,
        );
        await interaction.update({ embeds: [embed], components: [] });
        return;
      }

      // Get warning count
      const warnCount = history.filter(log => log.action === "warn").length;

      // Create history embed with the requested page
      const { embed, totalPages, currentPage } = createHistoryEmbed(
        targetUser,
        history,
        warnCount,
        page,
        5,
        null, // No guild needed for user-specific history
        null, // No user map needed for user-specific history
      );

      // Create pagination buttons
      const components =
        totalPages > 1
          ? createHistoryPaginationButtons(
              currentPage,
              totalPages,
              targetUser.id,
              null, // No guild ID needed for user-specific history
            )
          : [];

      await interaction.update({
        embeds: [embed],
        components,
      });

      logger.debug(
        `📋 Moderation history pagination: page ${currentPage}/${totalPages} for ${targetUser.tag} (${targetUser.id}) by ${interaction.user.tag}`,
      );
    }
  } catch (error) {
    logger.error("Error handling moderation history pagination:", error);
    // Check if interaction was already replied/updated
    if (interaction.replied || interaction.deferred) {
      try {
        await interaction.editReply({
          content: "❌ An error occurred while updating the history page.",
          embeds: [],
          components: [],
        });
      } catch (editError) {
        logger.debug(
          "Failed to edit reply in pagination error handler:",
          editError,
        );
      }
    } else {
      await interaction.reply({
        content: "❌ An error occurred while updating the history page.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

/**
 * Handle remove-warn subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} _client
 */
export async function handleRemoveWarn(interaction, _client) {
  try {
    const targetUser = interaction.options.getUser("user");
    const caseId = interaction.options.getString("case-id");

    // Remove the warning
    const result = await removeWarning(
      interaction.guild.id,
      targetUser.id,
      caseId,
    );

    if (!result.success) {
      const embed = createModerationErrorEmbed(
        "Remove Warning Failed",
        result.error || "Failed to remove warning",
      );
      return interaction.editReply({ embeds: [embed] });
    }

    if (!result.removed) {
      const embed = createModerationErrorEmbed(
        "Warning Not Found",
        result.error || `No warning found with case ID: ${caseId}`,
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Get updated warn count
    const warnCount = await getWarnCount(interaction.guild.id, targetUser.id);

    // Create success embed
    const embed = new EmbedBuilder()
      .setColor(THEME.SUCCESS)
      .setTitle("Warning Removed")
      .setDescription(
        `Warning **${caseId}** has been removed from **${targetUser.tag}**`,
      )
      .addFields({
        name: "Remaining Warnings",
        value: `${warnCount} warning${warnCount !== 1 ? "s" : ""}`,
        inline: true,
      })
      .setFooter({ text: "Moderation" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      `🗑️ Warning ${caseId} removed from ${targetUser.tag} (${targetUser.id}) by ${interaction.user.tag} (${interaction.user.id}) - Remaining warnings: ${warnCount}`,
    );
  } catch (error) {
    logger.error("Error handling remove-warn:", error);
    const embed = createModerationErrorEmbed(
      "Remove Warning Failed",
      error.message || "An error occurred while removing the warning.",
    );
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle list-bans subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} _client
 */
export async function handleListBans(interaction, _client) {
  try {
    // Check bot permissions
    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      const embed = createModerationErrorEmbed(
        "Missing Bot Permissions",
        "I need the `Ban Members` permission to view banned users.",
        "Please grant me the `Ban Members` permission in Server Settings → Roles",
      );
      return interaction.editReply({ embeds: [embed] });
    }

    // Fetch all bans
    const bans = await interaction.guild.bans.fetch();
    const bansArray = Array.from(bans.values());

    // Sort by username for consistency
    bansArray.sort((a, b) => a.user.tag.localeCompare(b.user.tag));

    // Create embed
    const embed = createBansListEmbed(bansArray, bansArray.length);

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      `📋 Banned users list viewed by ${interaction.user.tag} (${interaction.user.id}) - ${bansArray.length} total bans`,
    );
  } catch (error) {
    logger.error("Error handling list-bans:", error);
    const embed = createModerationErrorEmbed(
      "List Bans Failed",
      error.message || "An error occurred while fetching banned users.",
    );
    await interaction.editReply({ embeds: [embed] });
  }
}
