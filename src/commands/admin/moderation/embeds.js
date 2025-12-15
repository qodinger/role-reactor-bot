import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { THEME, UI_COMPONENTS, EMOJIS } from "../../../config/theme.js";

/**
 * Create timeout success embed
 * @param {import('discord.js').User} targetUser - Target user
 * @param {string} duration - Formatted duration string
 * @param {string} reason - Reason for timeout
 * @param {string} caseId - Case ID
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createTimeoutEmbed(targetUser, duration, reason, caseId) {
  return new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle("User Timed Out")
    .setDescription(`**${targetUser.tag}** has been timed out`)
    .addFields(
      {
        name: "Duration",
        value: duration,
        inline: true,
      },
      {
        name: "Reason",
        value: reason || "No reason provided",
        inline: true,
      },
      {
        name: "Case ID",
        value: caseId,
        inline: true,
      },
    )
    .setFooter({ text: "Moderation" })
    .setTimestamp();
}

/**
 * Create warn success embed
 * @param {import('discord.js').User} targetUser - Target user
 * @param {string} reason - Reason for warning
 * @param {number} warnCount - Total warning count
 * @param {string} caseId - Case ID
 * @param {string} [escalationMessage] - Auto-escalation message if triggered
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createWarnEmbed(
  targetUser,
  reason,
  warnCount,
  caseId,
  escalationMessage = null,
) {
  const embed = new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle("User Warned")
    .setDescription(`**${targetUser.tag}** has been warned`)
    .addFields(
      {
        name: "Reason",
        value: reason || "No reason provided",
        inline: false,
      },
      {
        name: "Total Warnings",
        value: `${warnCount} warning${warnCount !== 1 ? "s" : ""}`,
        inline: true,
      },
      {
        name: "Case ID",
        value: caseId,
        inline: true,
      },
    );

  if (escalationMessage) {
    embed.addFields({
      name: "Auto-Escalation",
      value: escalationMessage,
      inline: false,
    });
  }

  return embed.setFooter({ text: "Moderation" }).setTimestamp();
}

/**
 * Create ban success embed
 * @param {import('discord.js').User} targetUser - Target user
 * @param {string} reason - Reason for ban
 * @param {number} deleteDays - Days of messages to delete
 * @param {string} caseId - Case ID
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createBanEmbed(targetUser, reason, deleteDays, caseId) {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle("User Banned")
    .setDescription(`**${targetUser.tag}** has been banned`)
    .addFields(
      {
        name: "Reason",
        value: reason || "No reason provided",
        inline: false,
      },
      {
        name: "Messages Deleted",
        value: `${deleteDays} day${deleteDays !== 1 ? "s" : ""}`,
        inline: true,
      },
      {
        name: "Case ID",
        value: caseId,
        inline: true,
      },
    )
    .setFooter({ text: "Moderation" })
    .setTimestamp();
}

/**
 * Create kick success embed
 * @param {import('discord.js').User} targetUser - Target user
 * @param {string} reason - Reason for kick
 * @param {string} caseId - Case ID
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createKickEmbed(targetUser, reason, caseId) {
  return new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle("User Kicked")
    .setDescription(`**${targetUser.tag}** has been kicked`)
    .addFields(
      {
        name: "Reason",
        value: reason || "No reason provided",
        inline: false,
      },
      {
        name: "Case ID",
        value: caseId,
        inline: true,
      },
    )
    .setFooter({ text: "Moderation" })
    .setTimestamp();
}

/**
 * Create unban success embed
 * @param {import('discord.js').User} targetUser - Target user
 * @param {string} caseId - Case ID
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createUnbanEmbed(targetUser, caseId) {
  return new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle("User Unbanned")
    .setDescription(`**${targetUser.tag}** has been unbanned`)
    .addFields({
      name: "Case ID",
      value: caseId,
      inline: true,
    })
    .setFooter({ text: "Moderation" })
    .setTimestamp();
}

/**
 * Create purge success embed
 * @param {number} deletedCount - Number of messages deleted
 * @param {import('discord.js').TextChannel} channel - Channel where purge occurred
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createPurgeEmbed(
  deletedCount,
  channel,
  customDescription = null,
) {
  const description =
    customDescription ||
    `Deleted **${deletedCount}** message${deletedCount !== 1 ? "s" : ""} in ${channel}`;
  return new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle("Messages Purged")
    .setDescription(description)
    .setFooter({ text: "Moderation" })
    .setTimestamp();
}

/**
 * Create history embed showing user's moderation history or server-wide history
 * @param {import('discord.js').User|null} targetUser - Target user (null for server-wide history)
 * @param {Array} history - Array of moderation logs
 * @param {number} _warnCount - Warning count (unused, kept for compatibility)
 * @param {number} [page=1] - Current page number (1-indexed)
 * @param {number} [itemsPerPage=5] - Number of items per page
 * @param {import('discord.js').Guild|null} [guild=null] - Guild instance (for server-wide history)
 * @param {Map<string, string>|null} [userMap=null] - Map of userId to userTag (for server-wide history)
 * @returns {{embed: EmbedBuilder, totalPages: number, currentPage: number}}
 */
export function createHistoryEmbed(
  targetUser,
  history,
  _warnCount,
  page = 1,
  itemsPerPage = 5,
  guild = null,
  userMap = null,
) {
  const isServerHistory = !targetUser;

  const embed = new EmbedBuilder().setColor(THEME.PRIMARY);

  if (isServerHistory) {
    embed
      .setTitle(`Server Moderation History`)
      .setThumbnail(guild?.iconURL({ dynamic: true }) || null)
      .setFooter({ text: "Moderation" })
      .setTimestamp();
  } else {
    embed
      .setTitle(`Moderation History: ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "Moderation" })
      .setTimestamp();
  }

  // Sort history by timestamp (newest first)
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
  );

  // Count actions by type
  const actionCounts = {
    warn: history.filter(log => log.action === "warn").length,
    timeout: history.filter(log => log.action === "timeout").length,
    ban: history.filter(log => log.action === "ban").length,
    kick: history.filter(log => log.action === "kick").length,
    unban: history.filter(log => log.action === "unban").length,
  };

  // Add summary fields
  const summaryFields = [];
  if (actionCounts.warn > 0) {
    summaryFields.push({
      name: "Warnings",
      value: `${actionCounts.warn}`,
      inline: true,
    });
  }
  if (actionCounts.timeout > 0) {
    summaryFields.push({
      name: "Timeouts",
      value: `${actionCounts.timeout}`,
      inline: true,
    });
  }
  if (actionCounts.ban > 0) {
    summaryFields.push({
      name: "Bans",
      value: `${actionCounts.ban}`,
      inline: true,
    });
  }
  if (actionCounts.kick > 0) {
    summaryFields.push({
      name: "Kicks",
      value: `${actionCounts.kick}`,
      inline: true,
    });
  }
  if (actionCounts.unban > 0) {
    summaryFields.push({
      name: "Unbans",
      value: `${actionCounts.unban}`,
      inline: true,
    });
  }

  if (summaryFields.length > 0) {
    embed.addFields(summaryFields);
  }

  // Calculate pagination
  const totalPages = Math.max(
    1,
    Math.ceil(sortedHistory.length / itemsPerPage),
  );
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageActions = sortedHistory.slice(startIndex, endIndex);

  if (pageActions.length > 0) {
    let actionText = "";
    const MAX_REASON_LENGTH = 60; // Reduced for server-wide history (need space for user info)
    const MAX_TOTAL_LENGTH = 1000; // Leave some buffer below 1024 limit

    for (let i = 0; i < pageActions.length; i++) {
      const log = pageActions[i];
      const date = new Date(log.timestamp);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const actionEmoji =
        {
          warn: EMOJIS.MODERATION.WARN,
          timeout: EMOJIS.MODERATION.TIMEOUT,
          ban: EMOJIS.MODERATION.BAN,
          kick: EMOJIS.MODERATION.KICK,
          unban: EMOJIS.MODERATION.UNBAN,
        }[log.action] || EMOJIS.MODERATION.DEFAULT;

      // Truncate reason if too long
      let reason = log.reason || "No reason provided";
      if (reason.length > MAX_REASON_LENGTH) {
        reason = `${reason.substring(0, MAX_REASON_LENGTH - 3)}...`;
      }

      // For server-wide history, include user information
      let entry;
      if (isServerHistory && log.userId) {
        // Get user tag from map, fallback to user ID
        const userTag = userMap?.get(log.userId) || log.userId;
        entry = `${actionEmoji} **${log.action.toUpperCase()}** - ${userTag} (${dateStr})\n   Case: \`${log.caseId}\`\n   Reason: ${reason}`;
      } else {
        entry = `${actionEmoji} **${log.action.toUpperCase()}** (${dateStr})\n   Case: \`${log.caseId}\`\n   Reason: ${reason}`;
      }

      const entryWithSeparator = i > 0 ? `\n\n${entry}` : entry;

      // Check if adding this entry would exceed the limit
      if (actionText.length + entryWithSeparator.length > MAX_TOTAL_LENGTH) {
        // Add a note that more entries exist on next page
        if (currentPage < totalPages) {
          actionText += `\n\n*... and ${sortedHistory.length - (startIndex + i)} more action${sortedHistory.length - (startIndex + i) !== 1 ? "s" : ""}*`;
        }
        break;
      }

      actionText += entryWithSeparator;
    }

    const displayCount =
      totalPages > 1
        ? `${startIndex + 1}-${Math.min(startIndex + pageActions.length, sortedHistory.length)} of ${sortedHistory.length}`
        : `${sortedHistory.length}`;

    embed.addFields({
      name: `Actions (${displayCount})`,
      value: actionText || "No actions found",
      inline: false,
    });
  } else {
    embed.addFields({
      name: "Actions",
      value: "No actions found",
      inline: false,
    });
  }

  return { embed, totalPages, currentPage };
}

/**
 * Create pagination buttons for moderation history
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total number of pages
 * @param {string} identifier - User ID or "server" for server-wide history
 * @param {string|null} [guildId=null] - Guild ID (for server-wide history)
 * @returns {Array<ActionRowBuilder>}
 */
export function createHistoryPaginationButtons(
  currentPage,
  totalPages,
  identifier,
  _guildId = null,
) {
  const row = new ActionRowBuilder();

  // Previous button
  const prevCustomId = `mod_history_prev_${identifier}_${Math.max(1, currentPage - 1)}`;
  const prevButton = new ButtonBuilder()
    .setCustomId(prevCustomId)
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(EMOJIS.ACTIONS.BACK || "◀️")
    .setDisabled(currentPage <= 1);

  // Next button
  const nextCustomId = `mod_history_next_${identifier}_${Math.min(totalPages, currentPage + 1)}`;
  const nextButton = new ButtonBuilder()
    .setCustomId(nextCustomId)
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(EMOJIS.ACTIONS.FORWARD || "▶️")
    .setDisabled(currentPage >= totalPages);

  // Page info button (disabled, just for display)
  const pageCustomId = `mod_history_page_${identifier}_${currentPage}`;
  const pageButton = new ButtonBuilder()
    .setCustomId(pageCustomId)
    .setLabel(`${currentPage}/${totalPages}`)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  row.addComponents(prevButton, pageButton, nextButton);

  return [row];
}

/**
 * Create DM embed for warning notification
 * @param {import('discord.js').Guild} guild - The guild where warning occurred
 * @param {string} reason - Reason for warning
 * @param {number} warnCount - Total warning count
 * @param {string} caseId - Case ID
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createWarningDMEmbed(guild, reason, warnCount, caseId) {
  return new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle(`${EMOJIS.MODERATION.WARN} You have been warned`)
    .setDescription(`You received a warning in **${guild.name}**`)
    .addFields(
      {
        name: "Reason",
        value: reason || "No reason provided",
        inline: false,
      },
      {
        name: "Total Warnings",
        value: `${warnCount} warning${warnCount !== 1 ? "s" : ""}`,
        inline: true,
      },
      {
        name: "Case ID",
        value: caseId,
        inline: true,
      },
    )
    .setFooter({ text: `Moderation • ${guild.name}` })
    .setTimestamp();
}

/**
 * Create DM embed for timeout notification
 * @param {import('discord.js').Guild} guild - The guild where timeout occurred
 * @param {string} duration - Formatted duration string
 * @param {string} reason - Reason for timeout
 * @param {string} caseId - Case ID
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createTimeoutDMEmbed(guild, duration, reason, caseId) {
  return new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle(`${EMOJIS.MODERATION.TIMEOUT} You have been timed out`)
    .setDescription(`You have been timed out (muted) in **${guild.name}**`)
    .addFields(
      {
        name: "Duration",
        value: duration,
        inline: true,
      },
      {
        name: "Reason",
        value: reason || "No reason provided",
        inline: false,
      },
      {
        name: "Case ID",
        value: caseId,
        inline: true,
      },
    )
    .setFooter({ text: `Moderation • ${guild.name}` })
    .setTimestamp();
}

/**
 * Create DM embed for ban notification
 * @param {import('discord.js').Guild} guild - The guild where ban occurred
 * @param {string} reason - Reason for ban
 * @param {string} caseId - Case ID
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createBanDMEmbed(guild, reason, caseId) {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.MODERATION.BAN} You have been banned`)
    .setDescription(`You have been banned from **${guild.name}**`)
    .addFields(
      {
        name: "Reason",
        value: reason || "No reason provided",
        inline: false,
      },
      {
        name: "Case ID",
        value: caseId,
        inline: true,
      },
    )
    .setFooter({ text: `Moderation • ${guild.name}` })
    .setTimestamp();
}

/**
 * Create DM embed for kick notification
 * @param {import('discord.js').Guild} guild - The guild where kick occurred
 * @param {string} reason - Reason for kick
 * @param {string} caseId - Case ID
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createKickDMEmbed(guild, reason, caseId) {
  return new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle(`${EMOJIS.MODERATION.KICK} You have been kicked`)
    .setDescription(`You have been kicked from **${guild.name}**`)
    .addFields(
      {
        name: "Reason",
        value: reason || "No reason provided",
        inline: false,
      },
      {
        name: "Case ID",
        value: caseId,
        inline: true,
      },
    )
    .setFooter({ text: `Moderation • ${guild.name}` })
    .setTimestamp();
}

/**
 * Create DM embed for unban notification
 * @param {import('discord.js').Guild} guild - The guild where unban occurred
 * @param {string} caseId - Case ID
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createUnbanDMEmbed(guild, caseId) {
  return new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.MODERATION.UNBAN} You have been unbanned`)
    .setDescription(`You have been unbanned from **${guild.name}**`)
    .addFields({
      name: "Case ID",
      value: caseId,
      inline: true,
    })
    .setFooter({ text: `Moderation • ${guild.name}` })
    .setTimestamp();
}

/**
 * Create banned users list embed
 * @param {Array<import('discord.js').GuildBan>} bans - Array of ban objects
 * @param {number} totalCount - Total number of bans
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createBansListEmbed(bans, totalCount) {
  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle("Banned Users")
    .setTimestamp();

  if (bans.length === 0) {
    embed.setDescription("No users are currently banned from this server.");
    return embed;
  }

  // Format bans list (show up to 20 most recent)
  const displayBans = bans.slice(0, 20);
  const banList = displayBans
    .map((ban, index) => {
      const user = ban.user;
      const reason = ban.reason || "No reason provided";
      const truncatedReason =
        reason.length > 50 ? `${reason.substring(0, 47)}...` : reason;
      return `${index + 1}. **${user.tag}** (\`${user.id}\`)\n   Reason: ${truncatedReason}`;
    })
    .join("\n\n");

  embed.setDescription(banList);

  // Add footer with count
  if (totalCount > 20) {
    embed.setFooter({
      text: `Showing 20 of ${totalCount} banned users`,
    });
  } else {
    embed.setFooter({
      text: `${totalCount} banned user${totalCount !== 1 ? "s" : ""}`,
    });
  }

  return embed;
}

/**
 * Create bulk operation result embed
 * @param {string} actionName - Name of the action (e.g., "Bulk Timeout")
 * @param {number} successCount - Number of successful operations
 * @param {number} failedCount - Number of failed operations
 * @param {number} totalCount - Total number of users processed
 * @param {Array<import('discord.js').User>} successfulUsers - Array of successfully processed users
 * @param {Array<Object>} failedUsers - Array of failed users with errors [{user, error}]
 * @param {string|null} [additionalInfo] - Additional information to display
 * @param {string} [reason] - Reason for the action
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createBulkOperationEmbed(
  actionName,
  successCount,
  failedCount,
  totalCount,
  successfulUsers = [],
  failedUsers = [],
  additionalInfo = null,
  reason = null,
) {
  const embed = new EmbedBuilder()
    .setColor(successCount > 0 ? THEME.SUCCESS : THEME.ERROR)
    .setTitle(`${actionName} Results`)
    .setTimestamp();

  // Summary
  const summaryFields = [
    {
      name: "Summary",
      value: `✅ **${successCount}** succeeded\n❌ **${failedCount}** failed\n📊 **${totalCount}** total`,
      inline: false,
    },
  ];

  // Add reason if provided
  if (reason) {
    summaryFields.push({
      name: "Reason",
      value: reason.length > 1024 ? `${reason.substring(0, 1021)}...` : reason,
      inline: false,
    });
  }

  // Add additional info if provided
  if (additionalInfo) {
    summaryFields.push({
      name: "Details",
      value: additionalInfo,
      inline: false,
    });
  }

  embed.addFields(summaryFields);

  // Show successful users (up to 10)
  if (successfulUsers.length > 0) {
    const successList = successfulUsers
      .slice(0, 10)
      .map(user => `• ${user.tag} (\`${user.id}\`)`)
      .join("\n");
    const successValue =
      successfulUsers.length > 10
        ? `${successList}\n*...and ${successfulUsers.length - 10} more*`
        : successList;

    embed.addFields({
      name: `✅ Successful (${successfulUsers.length})`,
      value: successValue || "None",
      inline: false,
    });
  }

  // Show failed users (up to 10)
  if (failedUsers.length > 0) {
    const failedList = failedUsers
      .slice(0, 10)
      .map(({ user, error }) => {
        const truncatedError =
          error.length > 50 ? `${error.substring(0, 47)}...` : error;
        return `• ${user.tag} (\`${user.id}\`) - ${truncatedError}`;
      })
      .join("\n");
    const failedValue =
      failedUsers.length > 10
        ? `${failedList}\n*...and ${failedUsers.length - 10} more*`
        : failedList;

    embed.addFields({
      name: `❌ Failed (${failedUsers.length})`,
      value: failedValue || "None",
      inline: false,
    });
  }

  embed.setFooter(UI_COMPONENTS.createFooter("Moderation"));

  return embed;
}

/**
 * Create error embed for moderation actions
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @param {string} [solution] - Optional solution
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createModerationErrorEmbed(title, description, solution) {
  const embed = new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Moderation" })
    .setTimestamp();

  if (solution) {
    embed.addFields({
      name: "Solution",
      value: solution,
      inline: false,
    });
  }

  return embed;
}
