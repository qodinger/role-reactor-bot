import { Events, MessageFlags } from "discord.js";
import { InteractionManager } from "../utils/interactions/InteractionManager.js";

export const name = Events.InteractionCreate;

// Create a singleton instance of the interaction manager
const interactionManager = new InteractionManager();

/**
 * Main interaction handler - delegates to InteractionManager
 * @param {import('discord.js').Interaction} interaction - The Discord interaction
 * @param {import('discord.js').Client} client - The Discord client
 */
export async function execute(interaction, client) {
  // Best-effort early acknowledgment for the stream command, which performs
  // heavy Twitch/DB work. Deferring here (before any routing/permission/cooldown
  // logic) gives the best chance of beating Discord's 3s interaction window when
  // the event is received close to the deadline or the event loop is busy.
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "stream" &&
    !interaction.deferred &&
    !interaction.replied
  ) {
    await interaction
      .deferReply({ flags: MessageFlags.Ephemeral })
      .catch(() => {});
  }

  await interactionManager.handleInteraction(interaction, client);
}
