import { Events } from "discord.js";
import {
  getAllRoleMappings,
  removeRoleMapping,
} from "../utils/discord/roleManager.js";
import { getLogger } from "../utils/logger.js";

export const name = Events.GuildDelete;

export async function execute(guild, client) {
  const logger = getLogger();

  if (!guild) throw new Error("Missing guild");
  if (!client) throw new Error("Missing client");

  try {
    // Get all role mappings and check if any are in the deleted guild
    const allMappings = await getAllRoleMappings();
    let removedCount = 0;

    for (const [messageId, mapping] of Object.entries(allMappings)) {
      if (mapping.guildId === guild.id) {
        const removedMapping = await removeRoleMapping(messageId);
        if (removedMapping) {
          logger.info(`🗑️ Role mapping removed for left guild: ${messageId}`);
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      logger.info(
        `📊 Removed ${removedCount} role mappings from left guild: ${guild.name}`,
      );
    }
  } catch (error) {
    logger.error("Error handling guild deletion", error);
  }
}
