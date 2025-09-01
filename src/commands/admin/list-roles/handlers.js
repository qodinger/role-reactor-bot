import { getLogger } from "../../../utils/logger.js";
import { getAllRoleMappings } from "../../../utils/discord/roleMappingManager.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { createListRolesEmbed } from "./embeds.js";

/**
 * Handle the main list roles logic
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleListRoles(interaction, client) {
  const logger = getLogger();
  const start = Date.now();

  try {
    // Defer the reply first
    await interaction.deferReply({ flags: 64 }); // 64 = ephemeral flag

    const allMappings = await getAllRoleMappings();
    logger.debug("Retrieved mappings", {
      count: Object.keys(allMappings).length,
    });

    const guildMappings = Object.entries(allMappings).filter(
      ([, mapping]) => mapping.guildId === interaction.guild.id,
    );

    logger.debug("Guild mappings found", { count: guildMappings.length });

    if (guildMappings.length === 0) {
      return interaction.editReply(
        errorEmbed({
          title: "No Role-Reaction Messages Found",
          description:
            "There are no role-reaction messages set up in this server yet.",
          solution:
            "Use `/setup-roles` to create your first role-reaction message!",
          fields: [
            {
              name: "🎯 Getting Started",
              value:
                "Create role-reaction messages to let members self-assign roles with just a click!",
              inline: false,
            },
            {
              name: "📝 Quick Setup",
              value:
                '`/setup-roles title:"Choose Your Roles!" description:"Pick your roles!" roles:"🎮:Gamer,🎨:Artist"`',
              inline: false,
            },
          ],
        }),
      );
    }

    // Create the embed
    const embed = createListRolesEmbed(guildMappings, client);

    await interaction.editReply({
      embeds: [embed],
      flags: 64,
    });

    logger.info(`list-roles command completed in ${Date.now() - start}ms`);
  } catch (error) {
    logger.error("Error listing roles", error);

    // Only try to reply if we haven't already
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "❌ **Error**\nAn error occurred while listing the role-reaction messages. Please try again.",
          flags: 64,
        });
      } else if (interaction.deferred) {
        try {
          await interaction.editReply({
            content:
              "❌ **Error**\nAn error occurred while listing the role-reaction messages. Please try again.",
            flags: 64,
          });
        } catch (editError) {
          // If editReply fails due to unknown interaction, send a follow-up
          if (
            editError.code === 10062 ||
            (editError.rawError &&
              editError.rawError.message === "Unknown interaction")
          ) {
            try {
              await interaction.followUp({
                content:
                  "❌ **Error**\nAn error occurred while listing the role-reaction messages. Please try again.",
                flags: 64,
              });
            } catch (followUpError) {
              logger.error(
                "Failed to send follow-up error response",
                followUpError,
              );
            }
          } else {
            logger.error("Failed to send error response", editError);
          }
        }
      }
    } catch (replyError) {
      logger.error("Failed to send error response", replyError);
    }
  }
}
