import { GLOBAL_DEFAULT_TWITCH_COMMANDS } from "../../../features/streaming/utils/defaultCommands.js";

/**
 * Get the Twitch connection for a guild.
 * @param {string} guildId
 * @returns {Promise<Object|null>}
 */
export async function getGuildTwitchConnection(guildId) {
  const { getStreamConnections } = await import(
    "../../../features/streaming/utils/streamConfig.js"
  );
  const connections = await getStreamConnections(guildId);
  return (
    connections.find(connection => connection.platform === "twitch") || null
  );
}

/**
 * Find a built-in Twitch command by name.
 * @param {string} name
 * @returns {Object|undefined}
 */
export function getBuiltInTwitchCommand(name) {
  return GLOBAL_DEFAULT_TWITCH_COMMANDS.find(command => command.name === name);
}

/**
 * Get the command prefix for a connection (default: "!").
 * @param {Object} connection
 * @returns {string}
 */
export function prefixForConnection(connection) {
  return connection.commandPrefix || "!";
}
