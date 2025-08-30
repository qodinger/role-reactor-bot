import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import {
  hasAdminPermissions,
  botHasRequiredPermissions,
  getMissingBotPermissions,
} from "../../utils/discord/permissions.js";
import {
  scheduleTemporaryRole,
  validateScheduleTime,
  formatScheduleTime,
} from "../../utils/discord/enhancedTemporaryRoles.js";

import { getLogger } from "../../utils/logger.js";
import {
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

export const data = new SlashCommandBuilder()
  .setName("schedule-role")
  .setDescription(
    "Schedule a temporary role to be assigned at a specific time in the future",
  )
  .addStringOption(option =>
    option
      .setName("users")
      .setDescription(
        "Comma-separated list of user IDs or mentions to assign the temporary role to",
      )
      .setRequired(true),
  )
  .addRoleOption(option =>
    option
      .setName("role")
      .setDescription("The role to assign temporarily")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("schedule_time")
      .setDescription(
        "When to assign the role (e.g., 'today 22:15', 'tomorrow 9am', 'next friday 6pm')",
      )
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("duration")
      .setDescription("How long the role should last (e.g., 1h, 2d, 1w, 30m)")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("reason")
      .setDescription("Reason for scheduling the temporary role")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// Global command execution lock
let isExecuting = false;

export async function execute(interaction, client) {
  const logger = getLogger();

  // Prevent multiple simultaneous executions
  if (isExecuting) {
    logger.warn("Command already executing, rejecting duplicate request");
    return await interaction.reply({
      content:
        "⚠️ Another command is currently running. Please wait a moment and try again.",
      ephemeral: true,
    });
  }

  isExecuting = true;

  // Extract interaction properties early so they're available in catch/finally blocks
  const { guild, member, options } = interaction;

  try {
    logger.info("schedule-role command started");

    // Immediately acknowledge the interaction to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    logger.info("Checking permissions...");

    // Check permissions
    if (!(await hasAdminPermissions(member, ["ManageRoles"]))) {
      return await interaction.editReply({
        ...permissionErrorEmbed({ requiredPermissions: ["ManageRoles"] }),
      });
    }

    const botPermissions = ["ManageRoles"];
    if (!(await botHasRequiredPermissions(guild, botPermissions))) {
      const missingPermissions = await getMissingBotPermissions(
        guild,
        botPermissions,
      );
      return await interaction.editReply({
        ...permissionErrorEmbed({
          requiredPermissions: ["ManageRoles"],
          userPermissions: missingPermissions,
        }),
      });
    }

    logger.info("Parsing inputs...");

    // Parse and validate inputs
    const usersInput = options.getString("users");
    const role = options.getRole("role");
    const scheduleTimeInput = options.getString("schedule_time");
    const durationInput = options.getString("duration");
    const reason =
      options.getString("reason") || "Scheduled temporary role assignment";

    // Validate role
    if (role.managed || (role.tags && role.tags.botId)) {
      return await interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Invalid Role",
            description:
              "Cannot assign managed roles or bot roles as temporary roles.",
          }),
        ],
      });
    }

    // Parse and validate schedule time
    const scheduleTime = validateScheduleTime(scheduleTimeInput);
    if (!scheduleTime) {
      return await interaction.editReply({
        ...errorEmbed({
          title: "Invalid Schedule Time",
          description:
            "Please provide a valid date and time. Examples:\n• `2024-01-15 14:30`\n• `today 22:15`\n• `tomorrow 9am`\n• `next friday 6pm`\n• `22:15` (24-hour format)\n• `in 2 hours`",
        }),
      });
    }

    // Check if schedule time is in the future
    const now = new Date();
    if (scheduleTime <= now) {
      return await interaction.editReply({
        ...errorEmbed({
          title: "Invalid Schedule Time",
          description: "Schedule time must be in the future.",
        }),
      });
    }

    // Parse users
    const userIds = usersInput
      .split(",")
      .map(user => user.trim())
      .filter(user => user.length > 0)
      .map(user => {
        // Extract user ID from mention or use as-is
        const match = user.match(/<@!?(\d+)>/);
        return match ? match[1] : user;
      });

    if (userIds.length === 0) {
      return await interaction.editReply({
        ...errorEmbed({
          title: "Invalid Users",
          description: "Please provide valid user mentions or IDs.",
        }),
      });
    }

    // Schedule the temporary role with timeout protection
    let scheduledRole;
    try {
      logger.info("About to call scheduleTemporaryRole...");

      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Operation timed out")), 5000);
      });

      scheduledRole = await Promise.race([
        scheduleTemporaryRole(
          guild.id,
          userIds,
          role.id,
          scheduleTime,
          durationInput,
          reason,
          interaction.user.id,
        ),
        timeoutPromise,
      ]);

      logger.info("scheduleTemporaryRole completed successfully");
    } catch (error) {
      logger.error("Error scheduling temporary role:", error);

      // Create beautiful error embed
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle("❌ Role Scheduling Failed")
        .setDescription(
          `> 🚨 **An error occurred while scheduling the role**\n\n` +
            `**🔍 Error:** \`${error.message || "Unknown error"}\`\n\n` +
            `> 💡 **Please try again or contact an administrator if the problem persists.**`,
        )
        .setFooter({
          text: `Role Reactor Bot • ${guild.name}`,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setTimestamp();

      return await interaction.editReply({
        embeds: [errorEmbed],
      });
    }

    if (!scheduledRole) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff8800)
        .setTitle("⚠️ Role Scheduling Incomplete")
        .setDescription(
          `> 🚨 **The role scheduling process did not complete properly**\n\n` +
            `**🔍 Issue:** No scheduled role data was generated\n\n` +
            `> 💡 **Please try again or contact an administrator if the problem persists.**`,
        )
        .setFooter({
          text: `Role Reactor Bot • ${guild.name}`,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setTimestamp();

      return await interaction.editReply({
        embeds: [errorEmbed],
      });
    }

    // Create stunning success embed
    const embed = new EmbedBuilder()
      .setTitle("🎯 Role Successfully Scheduled!")
      .setDescription(
        `> ✨ **Temporary role \`${role.name}\` has been scheduled for assignment!**\n\n` +
          `**🎭 Role:** ${role}\n` +
          `**👥 Users:** ${userIds.map(id => `<@${id}>`).join(" • ")}\n` +
          `**⏰ Schedule Time:** \`${formatScheduleTime(scheduleTime)}\`\n` +
          `**⏱️ Duration:** \`${durationInput}\`\n` +
          `**📝 Reason:** \`${reason}\`\n` +
          `**🆔 Schedule ID:** \`${scheduledRole.scheduleId.substring(0, 8)}\``,
      )
      .setColor(0x00ff88)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 128 }) || null)
      .setFooter({
        text: `Role Reactor Bot • ${guild.name}`,
        iconURL: client.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    // Create beautiful action buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cancel_schedule_${scheduledRole.scheduleId}`)
        .setLabel("Cancel Schedule")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🗑️"),
      new ButtonBuilder()
        .setCustomId(`view_schedule_${scheduledRole.scheduleId}`)
        .setLabel("View Details")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("👁️"),
      new ButtonBuilder()
        .setCustomId(`modify_schedule_${scheduledRole.scheduleId}`)
        .setLabel("Modify")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚙️"),
    );

    // Send the final response - this is critical!
    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    logger.info(
      `Scheduled temporary role ${role.name} for ${userIds.length} users in guild ${guild.id}`,
    );

    // Log success for debugging
    logger.info(
      `Command completed successfully for user ${interaction.user.id}`,
    );
  } catch (error) {
    logger.error("Error in schedule-role command:", error);

    // Create beautiful error embed for unexpected errors
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("💥 Unexpected Error")
      .setDescription(
        `> 🚨 **An unexpected error occurred while processing the command**\n\n` +
          `**🔍 Error:** \`${error.message || "Unknown error"}\`\n\n` +
          `> 💡 **Please try again or contact an administrator if the problem persists.**`,
      )
      .setFooter({
        text: `Role Reactor Bot • ${guild.name}`,
        iconURL: client.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    // Try to send error response, but don't fail if interaction is already handled
    try {
      await interaction.editReply({
        embeds: [errorEmbed],
      });
    } catch (replyError) {
      logger.error("Failed to send error response:", replyError);
    }
  } finally {
    // Always release the execution lock
    isExecuting = false;
    logger.info("Command execution lock released");
  }
}
