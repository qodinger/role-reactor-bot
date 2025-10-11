import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handlePollCreateFromModal } from "./handlers.js";

const logger = getLogger();

/**
 * Handle modal submit interactions for polls
 * @param {import("discord.js").ModalSubmitInteraction} interaction - The modal interaction
 * @param {import("discord.js").Client} _client - The Discord client
 */
export async function handlePollModalSubmit(interaction, _client) {
  const { customId } = interaction;

  try {
    switch (customId) {
      case "poll_creation_modal":
        await handlePollCreateFromModal(interaction, _client);
        break;
      default:
        logger.warn(`Unknown modal interaction: ${customId}`);
        await interaction.reply(
          errorEmbed({
            title: "Unknown Modal",
            description: "This modal is not recognized.",
            solution:
              "Please try again or contact support if the issue persists.",
          }),
          { flags: MessageFlags.Ephemeral },
        );
    }
  } catch (error) {
    logger.error(`Error handling modal interaction ${customId}`, error);
    await interaction.reply(
      errorEmbed({
        title: "Modal Error",
        description: "An error occurred while processing the modal.",
        solution: "Please try again or contact support if the issue persists.",
      }),
      { flags: MessageFlags.Ephemeral },
    );
  }
}
