/**
 * Utility functions for the invite command
 */

import { getLogger } from "../../../utils/logger.js";

/**
 * Generate a bot invite link with required permissions
 * @param {Object} client - Discord client instance
 * @returns {Promise<string>} Generated invite link
 */
export async function generateInviteLink(client) {
  try {
    const inviteLink = client.inviteLink;
    if (inviteLink) {
      return inviteLink;
    }

    // Fallback to default invite generation
    const { getDefaultInviteLink } = await import(
      "../../../utils/discord/invite.js"
    );
    return await getDefaultInviteLink(client);
  } catch (error) {
    const logger = getLogger();
    logger.error("Error generating invite link:", error);
    return null;
  }
}

/**
 * Validate if a bot invite link is properly formatted
 * @param {string} inviteLink - The invite link to validate
 * @returns {boolean} True if valid Discord invite link
 */
export function isValidInviteLink(inviteLink) {
  if (!inviteLink) return false;
  return (
    inviteLink.includes("discord.com/invite/") ||
    inviteLink.includes("discord.gg/")
  );
}
