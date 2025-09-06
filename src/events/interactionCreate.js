import { Events } from "discord.js";
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
  await interactionManager.handleInteraction(interaction, client);
}
