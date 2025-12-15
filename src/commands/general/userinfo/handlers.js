import { ActivityType } from "discord.js";
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
    let member = interaction.guild?.members.cache.get(targetUser.id);

    // Try to fetch member if not in cache (this ensures we get fresh presence data)
    if (!member && interaction.guild) {
      try {
        member = await interaction.guild.members.fetch(targetUser.id);
      } catch (error) {
        logger.debug(
          `Failed to fetch member ${targetUser.id} from guild:`,
          error.message,
        );
      }
    }

    // If user is not in the guild, show basic user info
    if (!member && interaction.guild) {
      const embed = createUserInfoEmbed(targetUser, null, interaction.guild);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get presence data - try multiple sources
    // Note: Activities might not be in member.presence, need to check guild's presence cache
    let presence = null;
    if (member && _client && interaction.guild) {
      // Try guild's presence cache first (this is more reliable for activities)
      const guildPresence = interaction.guild.presences.cache.get(
        targetUser.id,
      );
      if (guildPresence) {
        presence = guildPresence;
        logger.debug(`Found presence in guild cache for ${targetUser.tag}`, {
          hasActivities: (presence.activities?.length || 0) > 0,
          activitiesCount: presence.activities?.length || 0,
        });
      }

      // Fallback to member.presence if guild cache doesn't have it
      if (!presence) {
        presence = member.presence;
        logger.debug(`Using member.presence for ${targetUser.tag}`, {
          hasActivities: (presence?.activities?.length || 0) > 0,
          activitiesCount: presence?.activities?.length || 0,
        });
      }

      // Last resort: try client's global presence cache
      if (
        !presence ||
        !presence.activities ||
        presence.activities.length === 0
      ) {
        const clientPresence = _client.guilds.cache
          .get(interaction.guild.id)
          ?.presences?.cache?.get(targetUser.id);
        if (clientPresence && clientPresence.activities?.length > 0) {
          presence = clientPresence;
          logger.debug(`Found presence in client cache for ${targetUser.tag}`, {
            activitiesCount: presence.activities?.length || 0,
          });
        }
      }
    } else if (member) {
      // Fallback if no client or guild
      presence = member.presence;
    }

    // Debug logging
    logger.debug(
      `Presence data for ${targetUser.tag}:`,
      presence
        ? {
            status: presence.status,
            activitiesCount: presence.activities?.length || 0,
            activities: presence.activities?.map(a => {
              let typeName = "Unknown";
              if (a.type === ActivityType.Playing) typeName = "Playing";
              else if (a.type === ActivityType.Streaming)
                typeName = "Streaming";
              else if (a.type === ActivityType.Listening)
                typeName = "Listening";
              else if (a.type === ActivityType.Watching) typeName = "Watching";
              else if (a.type === ActivityType.Custom) typeName = "Custom";
              else if (a.type === ActivityType.Competing)
                typeName = "Competing";

              return {
                type: a.type,
                name: a.name,
                url: a.url,
                typeName,
                isStreaming: a.type === ActivityType.Streaming,
              };
            }),
          }
        : "null/undefined",
    );

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
          presence,
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
