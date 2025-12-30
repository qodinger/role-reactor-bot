import { EmbedBuilder, ActivityType } from "discord.js";
import { THEME, UI_COMPONENTS } from "../../../config/theme.js";
import { getLogger } from "../../../utils/logger.js";
import {
  formatUserFlags,
  formatRoles,
  formatUserStatus,
  formatUserActivity,
} from "./utils.js";

const logger = getLogger();

/**
 * Create user info embed
 * @param {import('discord.js').User} user - Target user
 * @param {Object|null} memberData - Member data if user is in guild
 * @param {import('discord.js').Guild|null} guild - Guild instance
 * @param {number|null} warnCount - Warning count (null if not available)
 * @returns {EmbedBuilder}
 */
export function createUserInfoEmbed(user, memberData, guild, warnCount = null) {
  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle("User Information")
    .setDescription(
      `**${user.displayName || user.username}**${user.bot ? " [BOT]" : ""}`,
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setTimestamp();

  const fields = [];

  // Basic Information - Row 1
  fields.push(
    {
      name: "Username",
      value: `\`${user.tag}\``,
      inline: true,
    },
    {
      name: "User ID",
      value: `\`${user.id}\``,
      inline: true,
    },
    {
      name: "Type",
      value: user.bot ? "Bot" : "User",
      inline: true,
    },
  );

  // Account Information - Row 2
  const row2Fields = [];

  if (user.createdAt) {
    row2Fields.push({
      name: "Account Created",
      value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`,
      inline: true,
    });
  }

  // Status (if member is in guild)
  // If intent is enabled, presence will show real-time status
  // If intent is not enabled or presence is not cached, status field is omitted
  if (memberData) {
    // Check if presence data is available (intent enabled and cached)
    // In Discord.js, presence object might exist but status could be undefined/null
    // For offline users, presence might be null even with intent enabled
    const hasPresence =
      memberData.presence &&
      memberData.presence.status !== undefined &&
      memberData.presence.status !== null;

    if (hasPresence) {
      // User has valid presence data (online, idle, dnd, or offline with cached presence)
      const status = formatUserStatus(memberData.presence);
      const activity = formatUserActivity(memberData.presence);

      // Debug logging for activity detection
      logger.debug("Activity formatting result:", {
        hasActivity: !!activity,
        activityText: activity,
        activitiesCount: memberData.presence.activities?.length || 0,
        activities: memberData.presence.activities?.map(a => {
          let typeName = "Unknown";
          if (a.type === ActivityType.Playing) typeName = "Playing";
          else if (a.type === ActivityType.Streaming) typeName = "Streaming";
          else if (a.type === ActivityType.Listening) typeName = "Listening";
          else if (a.type === ActivityType.Watching) typeName = "Watching";
          else if (a.type === ActivityType.Custom) typeName = "Custom";
          else if (a.type === ActivityType.Competing) typeName = "Competing";

          return {
            type: a.type,
            name: a.name,
            url: a.url,
            typeName,
            isStreaming: a.type === ActivityType.Streaming,
          };
        }),
      });

      // Truncate activity text if too long (Discord field value limit is 1024)
      let activityText = activity;
      if (activity && activity.length > 200) {
        activityText = `${activity.substring(0, 197)}...`;
      }

      const statusValue = activityText
        ? `${status.emoji} ${status.label}\n${activityText}`
        : `${status.emoji} ${status.label}`;

      row2Fields.push({
        name: "Status",
        value: statusValue,
        inline: true,
      });
    } else if (
      memberData.presence === null ||
      memberData.presence === undefined
    ) {
      // Presence is null/undefined - user is likely offline and not cached
      // Show "Offline" as fallback when user is a member but presence unavailable
      // This provides consistent UX even when presence data isn't cached
      row2Fields.push({
        name: "Status",
        value: "⚫ Offline",
        inline: true,
      });
    }
    // If presence exists but has no status, the field is not shown
    // This is an edge case that shouldn't normally happen
  }

  // Badges
  const badges = formatUserFlags(user.flags);
  if (badges.length > 0 && badges[0] !== "None") {
    row2Fields.push({
      name: "Badges",
      value: badges.slice(0, 3).join(", "),
      inline: true,
    });
  }

  // Add row 2 fields if any exist
  if (row2Fields.length > 0) {
    fields.push(...row2Fields);
  }

  // Guild member information (if in guild)
  if (memberData && guild) {
    // Server info - Row 3
    const serverInfo = [];
    if (memberData.joinedAt) {
      serverInfo.push(
        `Joined: <t:${Math.floor(memberData.joinedAt.getTime() / 1000)}:R>`,
      );
    }
    if (memberData.nickname) {
      serverInfo.push(`Nickname: ${memberData.nickname}`);
    }
    if (memberData.premiumSince) {
      serverInfo.push(
        `Booster since <t:${Math.floor(memberData.premiumSince.getTime() / 1000)}:R>`,
      );
    }
    if (memberData.communicationDisabledUntil) {
      const timeoutEnd = new Date(memberData.communicationDisabledUntil);
      const now = new Date();
      if (timeoutEnd > now) {
        serverInfo.push(
          `Timeout until: <t:${Math.floor(timeoutEnd.getTime() / 1000)}:R>`,
        );
      }
    }
    if (memberData.voice?.channel) {
      serverInfo.push(`Voice: ${memberData.voice.channel.toString()}`);
    }

    // Add warning count if available
    if (warnCount !== null && warnCount > 0) {
      serverInfo.push(`Warnings: ${warnCount}`);
    }

    if (serverInfo.length > 0) {
      fields.push({
        name: "Server Member",
        value: serverInfo.join("\n"),
        inline: false,
      });
    }

    // Roles (full width)
    if (memberData.roles) {
      const roles = formatRoles(memberData.roles);
      const rolesCount = memberData.roles.filter(r => r.id !== guild.id).size;
      const rolesValue =
        roles.length > 1024 ? `${roles.substring(0, 1021)}...` : roles;
      fields.push({
        name: `Roles [${rolesCount}]`,
        value: rolesValue || "None",
        inline: false,
      });
    }
  } else if (guild) {
    fields.push({
      name: "Server Status",
      value: "Not a member of this server",
      inline: false,
    });
  }

  embed
    .addFields(fields)
    .setFooter(
      UI_COMPONENTS.createFooter(
        `User ID: ${user.id}`,
        user.displayAvatarURL(),
      ),
    );

  return embed;
}

/**
 * Create error embed
 * @param {import('discord.js').User} user - User who triggered the error
 * @returns {EmbedBuilder}
 */
export function createErrorEmbed(user) {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle("Error")
    .setDescription(
      "Sorry! I couldn't retrieve user information right now.\n\n" +
        "This might be due to:\n" +
        "• Temporary Discord API issues\n" +
        "• Network connectivity problems\n" +
        "• Bot maintenance\n\n" +
        "Please try again in a few moments!",
    )
    .setFooter(
      UI_COMPONENTS.createFooter(
        "If this problem persists, contact support",
        user.displayAvatarURL(),
      ),
    )
    .setTimestamp();
}
