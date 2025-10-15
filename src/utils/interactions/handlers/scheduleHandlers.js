import { MessageFlags } from "discord.js";
import { THEME, THEME_COLOR, EMOJIS } from "../../../config/theme.js";
import { getLogger } from "../../logger.js";

/**
 * Schedule role button interaction handlers
 * Handles all schedule-related button interactions
 */

/**
 * Helper function to format display IDs consistently
 * @param {string} id - The ID to format
 * @returns {string} Formatted ID
 */
const formatDisplayId = id => {
  if (id.length <= 12) {
    return id;
  }
  return `${id.substring(0, 8)}...${id.substring(id.length - 4)}`;
};

/**
 * Handle cancel schedule button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleCancelSchedule = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Extract schedule ID from button customId
    const scheduleId = interaction.customId.replace("cancel_schedule_", "");

    // Import required modules
    const { EmbedBuilder } = await import("discord.js");
    const { cancelScheduledRole } = await import(
      "../../discord/temporaryRoles.js"
    );

    // Cancel the scheduled role
    const cancelled = await cancelScheduledRole(scheduleId);

    if (!cancelled) {
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(THEME.ERROR)
            .setTitle(`${EMOJIS.STATUS.ERROR} Schedule Not Found`)
            .setDescription(
              "The scheduled role could not be found or has already been cancelled.",
            )
            .setTimestamp(),
        ],
      });
    }

    // Create success embed
    const embed = new EmbedBuilder()
      .setColor(THEME.SUCCESS)
      .setTitle(`${EMOJIS.STATUS.SUCCESS} Schedule Cancelled`)
      .setDescription("The scheduled role has been cancelled successfully.")
      .addFields({
        name: `${EMOJIS.UI.ID} Schedule ID`,
        value: `\`${formatDisplayId(scheduleId)}\``,
        inline: true,
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
    });

    logger.info(
      `Scheduled role ${scheduleId} cancelled by ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling cancel schedule button", error);
    await handleScheduleError(interaction, "cancelling the schedule");
  }
};

/**
 * Handle view schedule button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleViewSchedule = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Extract schedule ID from button customId
    const scheduleId = interaction.customId.replace("view_schedule_", "");

    // Import required modules
    const { EmbedBuilder } = await import("discord.js");
    const { getScheduledRoles, getRecurringSchedules } = await import(
      "../../discord/temporaryRoles.js"
    );

    // Get schedule details
    const [scheduledRoles, recurringSchedules] = await Promise.all([
      getScheduledRoles(interaction.guild.id),
      getRecurringSchedules(interaction.guild.id),
    ]);

    const scheduledRole = scheduledRoles.find(r => r.scheduleId === scheduleId);
    const recurringSchedule = recurringSchedules.find(
      r => r.scheduleId === scheduleId,
    );

    if (!scheduledRole && !recurringSchedule) {
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(THEME.ERROR)
            .setTitle(`${EMOJIS.STATUS.ERROR} Schedule Not Found`)
            .setDescription("The scheduled role could not be found.")
            .setTimestamp(),
        ],
      });
    }

    let embed;
    if (scheduledRole) {
      // Create scheduled role detail embed
      const role = interaction.guild.roles.cache.get(scheduledRole.roleId);
      const roleName = role ? role.name : "Unknown Role";
      const scheduledBy = interaction.guild.members.cache.get(
        scheduledRole.scheduledBy,
      );
      const scheduledByName = scheduledBy
        ? scheduledBy.displayName
        : "Unknown User";

      embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.TIME.ALARM} Scheduled Role Details`)
        .setDescription(`Details for scheduled role assignment **${roleName}**`)
        .setColor(THEME_COLOR)
        .addFields(
          {
            name: `${EMOJIS.UI.ID} Schedule ID`,
            value: `\`${formatDisplayId(scheduledRole.scheduleId)}\``,
            inline: true,
          },
          {
            name: `${EMOJIS.ACTIONS.ROLE} Role`,
            value: roleName,
            inline: true,
          },
          {
            name: `${EMOJIS.TIME.CALENDAR} Schedule Time`,
            value: new Date(scheduledRole.scheduleTime).toLocaleString(),
            inline: true,
          },
          {
            name: `${EMOJIS.TIME.TIMER} Duration`,
            value: scheduledRole.duration,
            inline: true,
          },
          {
            name: `${EMOJIS.UI.USERS} Users`,
            value: `${scheduledRole.userIds.length} user(s)`,
            inline: true,
          },
          {
            name: `${EMOJIS.ACTIONS.WRITING} Reason`,
            value: scheduledRole.reason || "No reason specified",
            inline: true,
          },
          {
            name: `${EMOJIS.UI.USER} Scheduled By`,
            value: scheduledByName,
            inline: true,
          },
          {
            name: `${EMOJIS.UI.PROGRESS} Status`,
            value: scheduledRole.status,
            inline: true,
          },
        )
        .setTimestamp();
    } else {
      // Create recurring schedule detail embed
      const role = interaction.guild.roles.cache.get(recurringSchedule.roleId);
      const roleName = role ? role.name : "Unknown Role";
      const createdBy = interaction.guild.members.cache.get(
        recurringSchedule.createdBy,
      );
      const createdByName = createdBy ? createdBy.displayName : "Unknown User";

      embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.ACTIONS.REFRESH} Recurring Schedule Details`)
        .setDescription(`Details for recurring role schedule **${roleName}**`)
        .setColor(THEME_COLOR)
        .addFields(
          {
            name: `${EMOJIS.UI.ID} Schedule ID`,
            value: `\`${formatDisplayId(recurringSchedule.scheduleId)}\``,
            inline: true,
          },
          {
            name: `${EMOJIS.ACTIONS.ROLE} Role`,
            value: roleName,
            inline: true,
          },
          {
            name: `${EMOJIS.TIME.CALENDAR} Schedule Type`,
            value: recurringSchedule.schedule.type,
            inline: true,
          },
          {
            name: `${EMOJIS.TIME.TIMER} Duration`,
            value: recurringSchedule.duration,
            inline: true,
          },
          {
            name: `${EMOJIS.UI.USERS} Users`,
            value: `${recurringSchedule.userIds.length} user(s)`,
            inline: true,
          },
          {
            name: `${EMOJIS.ACTIONS.WRITING} Reason`,
            value: recurringSchedule.reason || "No reason specified",
            inline: true,
          },
          {
            name: `${EMOJIS.UI.USER} Created By`,
            value: createdByName,
            inline: true,
          },
          {
            name: `${EMOJIS.UI.PROGRESS} Status`,
            value: recurringSchedule.status,
            inline: true,
          },
        )
        .setTimestamp();
    }

    await interaction.editReply({
      embeds: [embed],
    });

    logger.info(
      `Schedule details viewed for ${scheduleId} by ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling view schedule button", error);
    await handleScheduleError(interaction, "loading schedule details");
  }
};

/**
 * Handle modify schedule button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleModifySchedule = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Extract schedule ID from button customId
    const scheduleId = interaction.customId.replace("modify_schedule_", "");

    // Import required modules
    const { EmbedBuilder } = await import("discord.js");

    // For now, show a message that modification is not yet implemented
    // This can be expanded later to allow editing schedule parameters
    const embed = new EmbedBuilder()
      .setColor(THEME.WARNING)
      .setTitle(`${EMOJIS.STATUS.WARNING} Modification Not Available`)
      .setDescription("Schedule modification is not yet implemented.")
      .addFields({
        name: `${EMOJIS.UI.ID} Schedule ID`,
        value: `\`${formatDisplayId(scheduleId)}\``,
        inline: true,
      })
      .addFields({
        name: `${EMOJIS.ACTIONS.ALTERNATIVE} Alternative`,
        value:
          "You can cancel this schedule and create a new one with the desired parameters.",
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
    });

    logger.info(
      `Schedule modification requested for ${scheduleId} by ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling modify schedule button", error);
    await handleScheduleError(
      interaction,
      "processing the modification request",
    );
  }
};

/**
 * Handle schedule system errors
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 * @param {string} action - The action that failed
 */
const handleScheduleError = async (interaction, action) => {
  const logger = getLogger();

  // Only respond if the interaction hasn't been responded to yet
  if (!interaction.replied && !interaction.deferred) {
    try {
      await interaction.reply({
        content: `${EMOJIS.STATUS.ERROR} An error occurred while ${action}.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (replyError) {
      logger.error("Error sending error reply", replyError);
    }
  } else if (interaction.deferred) {
    try {
      await interaction.editReply({
        content: `${EMOJIS.STATUS.ERROR} An error occurred while ${action}.`,
      });
    } catch (editError) {
      logger.error("Error sending error edit reply", editError);
    }
  }
};
