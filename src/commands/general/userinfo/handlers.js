import { getLogger } from "../../../utils/logger.js";
import { createUserInfoEmbed, createErrorEmbed } from "./embeds.js";
import { getWarnCount } from "../../admin/moderation/utils.js";

const logger = getLogger();

/**
 * Handle userinfo command execution
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function execute(interaction, _client) {
  try {
    await interaction.deferReply();

    // Get target user (defaults to command user)
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const member = interaction.guild?.members.cache.get(targetUser.id);

    // If user is not in the guild, show basic user info
    if (!member && interaction.guild) {
      const embed = createUserInfoEmbed(targetUser, null, interaction.guild);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get additional member data if available
    const memberData = member
      ? {
          joinedAt: member.joinedAt,
          roles: member.roles.cache,
          permissions: member.permissions,
          displayName: member.displayName,
          nickname: member.nickname,
          premiumSince: member.premiumSince,
          communicationDisabledUntil: member.communicationDisabledUntil,
          voice: member.voice,
          presence: member.presence,
        }
      : null;

    // Get warning count if user is in guild
    let warnCount = null;
    if (interaction.guild) {
      try {
        warnCount = await getWarnCount(interaction.guild.id, targetUser.id);
      } catch (error) {
        logger.debug(
          `Failed to get warning count for ${targetUser.id}:`,
          error.message,
        );
      }
    }

    // Create embed with user information
    const embed = createUserInfoEmbed(
      targetUser,
      memberData,
      interaction.guild,
      warnCount,
    );

    logger.debug(
      `Userinfo command executed by ${interaction.user.tag} for ${targetUser.tag}`,
      {
        userId: interaction.user.id,
        targetUserId: targetUser.id,
        guildId: interaction.guild?.id,
      },
    );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error executing userinfo command", error);

    const errorEmbed = createErrorEmbed(interaction.user);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
