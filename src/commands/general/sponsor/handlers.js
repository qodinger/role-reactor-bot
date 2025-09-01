import { getLogger } from "../../../utils/logger.js";
import { createSponsorEmbed, createErrorEmbed } from "./embeds.js";

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    const embed = createSponsorEmbed(interaction.user);
    await interaction.reply({ embeds: [embed] });
    logger.logCommand("sponsor", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in sponsor command", error);
    await interaction.reply({
      embeds: [createErrorEmbed()],
    });
  }
}
