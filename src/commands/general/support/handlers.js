import { getLogger } from "../../../utils/logger.js";
import { createSupportEmbed, createErrorEmbed } from "./embeds.js";
import { createSupportButtons } from "./components.js";

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    // Defer immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    const embed = createSupportEmbed(interaction.user);
    const components = await createSupportButtons();

    await interaction.editReply({
      embeds: [embed],
      components: components ? [components] : [],
    });
    logger.logCommand("support", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in support command", error);
    await interaction.editReply({
      embeds: [createErrorEmbed()],
    });
  }
}
