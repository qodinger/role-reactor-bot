import { PermissionFlagsBits } from "discord.js";
import { formatPermissionName } from "./permissions.js";

/**
 * Generates a Discord bot invite link for the given client and options.
 * @param {import('discord.js').Client} client - The Discord client instance.
 * @param {Object} [options] - Options for invite generation.
 * @param {Array<string>} [options.permissions] - Array of permission names (e.g., 'ManageRoles').
 * @param {Array<string>} [options.scopes] - Array of scopes (e.g., ['bot']).
 * @returns {Promise<string>} The generated invite link.
 */
export async function generateInviteLink(client, options = {}) {
  const defaultOptions = {
    permissions: DEFAULT_INVITE_PERMISSIONS,
    scopes: ["bot"],
  };
  const mergedOptions = {
    permissions: options.permissions || defaultOptions.permissions,
    scopes: options.scopes || defaultOptions.scopes,
  };
  return client.generateInvite(mergedOptions);
}

/**
 * Returns a default invite link for the bot, if client is ready.
 * @param {import('discord.js').Client} client
 * @returns {Promise<string>} The invite link
 */
export async function getDefaultInviteLink(client) {
  return generateInviteLink(client);
}

/**
 * Maps a permission bit to a human-readable name using the shared utility.
 * @param {bigint} permissionBit
 * @returns {string}
 */
export function getInvitePermissionName(permissionBit) {
  return formatPermissionName(permissionBit);
}

export const DEFAULT_INVITE_PERMISSIONS = [
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ViewChannel,
];
