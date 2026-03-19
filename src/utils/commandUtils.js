/**
 * Utility functions for Discord commands
 * @module utils/commandUtils
 */

/**
 * Gets the clickable command format </name:id> if registered,
 * or falls back to plain text `/name` if not found.
 *
 * @param {Object} client - Discord client instance
 * @param {string} fullCommandName - Name of the application command
 * @returns {string} Clickable command tag or plain string
 */
export function getMentionableCommand(client, fullCommandName) {
  if (!client || !client.application || !client.application.commands) {
    return `\`/${fullCommandName}\``;
  }

  // Split out the base command from any subcommands (e.g., "giveaway create" -> "giveaway", "create")
  const parts = fullCommandName.trim().split(" ");
  const baseCommandName = parts[0];

  const commandsCache = client.application.commands.cache;
  const cmd = commandsCache.find(c => c.name === baseCommandName);

  if (cmd) {
    // If there are subcommands, append them inside the mention
    return `</${fullCommandName}:${cmd.id}>`;
  }

  return `\`/${fullCommandName}\``;
}
