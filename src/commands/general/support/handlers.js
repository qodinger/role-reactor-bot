import { getLogger } from "../../../utils/logger.js";
import { createSupportEmbed, createErrorEmbed } from "./embeds.js";

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    const embed = createSupportEmbed(interaction.user);
    await interaction.reply({ embeds: [embed] });
    logger.logCommand("support", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in support command", error);
    await interaction.reply({
      embeds: [createErrorEmbed()],
    });
  }
}
