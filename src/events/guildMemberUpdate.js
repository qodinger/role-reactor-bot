import { Events } from "discord.js";

/**
 * Handle guild member updates (including role changes)
 * @param {import("discord.js").GuildMember} _oldMember - Previous member state
 * @param {import("discord.js").GuildMember} _newMember - New member state
 * @param {import("discord.js").Client} _client - Discord client (passed by event handler, unused)
 */
export async function execute(_oldMember, _newMember, _client) {
  // Role changes are handled by Discord's permission system
}

export const name = Events.GuildMemberUpdate;
export const once = false;
