import { Events } from "discord.js";
import {
  getAllRoleMappings,
  removeRoleMapping,
} from "../utils/discord/roleMappingManager.js";
import { getLogger } from "../utils/logger.js";

export const name = Events.ChannelDelete;

export async function execute(channel, client) {
  const logger = getLogger();

  if (!channel) throw new Error("Missing channel");
  if (!client) throw new Error("Missing client");

  try {
    // Get all role mappings and check if any are in the deleted channel
    const allMappings = await getAllRoleMappings();
    let removedCount = 0;

    for (const [messageId, mapping] of Object.entries(allMappings)) {
      if (mapping.channelId === channel.id) {
        const removedMapping = await removeRoleMapping(messageId);
        if (removedMapping) {
          logger.info(
            `🗑️ Role mapping removed for deleted channel: ${messageId}`,
          );
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      logger.info(
        `📊 Removed ${removedCount} role mappings from deleted channel: ${channel.name}`,
      );
    }
  } catch (error) {
    logger.error("Error handling channel deletion", error);
  }
}
