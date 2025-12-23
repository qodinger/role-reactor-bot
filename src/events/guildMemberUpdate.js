import { Events } from "discord.js";
import { getLogger } from "../utils/logger.js";

/**
 * Handle guild member updates (including role changes)
 * @param {import("discord.js").GuildMember} oldMember - Previous member state
 * @param {import("discord.js").GuildMember} newMember - New member state
 * @param {import("discord.js").Client} _client - Discord client (passed by event handler, unused)
 */
export async function execute(oldMember, newMember, _client) {
  // Role changes are handled by Discord's permission system
}

export const name = Events.GuildMemberUpdate;
export const once = false;
