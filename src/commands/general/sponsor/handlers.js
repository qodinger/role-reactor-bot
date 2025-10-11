import { getLogger } from "../../../utils/logger.js";
import { createSponsorEmbed, createErrorEmbed } from "./embeds.js";
import { createSponsorButtons } from "./components.js";

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    // Defer immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    const embed = createSponsorEmbed(interaction.user);
    const components = createSponsorButtons();

    await interaction.editReply({
      embeds: [embed],
      components: components ? [components] : [],
    });
    logger.logCommand("sponsor", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in sponsor command", error);
    await interaction.editReply({
      embeds: [createErrorEmbed()],
    });
  }
}
