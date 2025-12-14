import { getLogger } from "../../../utils/logger.js";
import { createServerInfoEmbed, createErrorEmbed } from "./embeds.js";

const logger = getLogger();

/**
 * Handle serverinfo command execution
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function execute(interaction, client) {
  try {
    await interaction.deferReply();

    const guild = interaction.guild;

    if (!guild) {
      const errorEmbed = createErrorEmbed(
        interaction.user,
        "This command can only be used in a server.",
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // Fetch full guild data if needed
    await guild.fetch();

    // Try to fetch all members for accurate counts (with timeout for large servers)
    let membersFetched = false;
    const cachedBeforeFetch = guild.members.cache.size;

    if (cachedBeforeFetch < guild.memberCount) {
      try {
        // For large servers, set a timeout
        const memberCount = guild.memberCount;
        const timeoutMs = memberCount > 5000 ? 30000 : 15000; // 30s for large, 15s for small

        if (memberCount > 5000) {
          await interaction.editReply({
            content: `⏳ Fetching ${memberCount.toLocaleString()} members for accurate data...`,
          });
        }

        const fetchPromise = guild.members.fetch();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Member fetch timed out")),
            timeoutMs,
          );
        });

        await Promise.race([fetchPromise, timeoutPromise]);
        membersFetched = true;
        logger.debug(
          `Fetched all ${guild.members.cache.size} members for serverinfo`,
        );
      } catch (fetchError) {
        if (fetchError.message?.includes("timed out")) {
          logger.warn(
            `Member fetch timed out for guild ${guild.name} - using cached members`,
          );
        } else if (fetchError.message?.includes("Missing Access")) {
          logger.warn(
            `Missing GUILD_MEMBERS intent for guild ${guild.name} - using cached members`,
          );
        } else {
          logger.warn(
            `Failed to fetch all members: ${fetchError.message} - using cached members`,
          );
        }
        // Continue with cached members
      }
    } else {
      membersFetched = true; // All members already cached
    }

    // Create embed with server information
    const embed = createServerInfoEmbed(guild, client, membersFetched);

    logger.debug(`Serverinfo command executed by ${interaction.user.tag}`, {
      userId: interaction.user.id,
      guildId: guild.id,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error executing serverinfo command", error);

    const errorEmbed = createErrorEmbed(interaction.user);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
