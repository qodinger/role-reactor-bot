import { getLogger } from "../../../utils/logger.js";
import { createServerInfoEmbed, createErrorEmbed } from "./embeds.js";
import {
  getServerStats,
  getChannelCounts,
  getBoostInfo,
  calculateServerAge,
} from "./utils.js";

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ ephemeral: false });

    const guild = interaction.guild;

    // Get server statistics
    const { totalMembers, onlineMembers, botCount, humanCount } =
      getServerStats(guild);
    const { textChannels, voiceChannels, categories } = getChannelCounts(guild);
    const roleCount = guild.roles.cache.size;
    const ageInDays = calculateServerAge(guild.createdAt);
    const { boostLevel, boostCount, boostPerks } = getBoostInfo(guild);

    const embed = createServerInfoEmbed(
      guild,
      { totalMembers, onlineMembers, botCount, humanCount },
      { textChannels, voiceChannels, categories },
      roleCount,
      ageInDays,
      { boostLevel, boostCount, boostPerks },
      interaction.user,
    );

    await interaction.editReply({ embeds: [embed] });
    logger.logCommand("serverinfo", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in serverinfo command", error);
    await interaction.editReply({
      embeds: [createErrorEmbed()],
    });
  }
}
