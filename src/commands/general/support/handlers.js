import { getLogger } from "../../../utils/logger.js";
import { createSupportEmbed, createErrorEmbed } from "./embeds.js";
import { createSupportButtons } from "./components.js";

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    const embed = createSupportEmbed(interaction.user);
    const components = createSupportButtons();

    await interaction.reply({
      embeds: [embed],
      components: components ? [components] : [],
    });
    logger.logCommand("support", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in support command", error);
    await interaction.reply({
      embeds: [createErrorEmbed()],
    });
  }
}
