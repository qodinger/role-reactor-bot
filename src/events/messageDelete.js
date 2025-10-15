import { Events } from "discord.js";
import { removeRoleMapping } from "../utils/discord/roleMappingManager.js";
import { getStorageManager } from "../utils/storage/storageManager.js";
import { getLogger } from "../utils/logger.js";

export const name = Events.MessageDelete;

export async function execute(message, client) {
  const logger = getLogger();

  if (!message) throw new Error("Missing message");
  if (!client) throw new Error("Missing client");

  try {
    logger.info(
      `🔍 Message deleted: ${message.id} in channel ${message.channel?.id}`,
    );

    // Check if this is a role message that was deleted
    const roleMapping = await removeRoleMapping(message.id);

    if (roleMapping) {
      logger.info(`🗑️ Role mapping removed for deleted message: ${message.id}`);
      logger.info(
        `📊 Removed ${Object.keys(roleMapping.roles || {}).length} role mappings`,
      );
    } else {
      logger.info(
        `ℹ️ No role mapping found for deleted message: ${message.id}`,
      );
    }

    // Check if this is a poll message that was deleted
    const storageManager = await getStorageManager();
    const poll = await storageManager.getPollByMessageId(message.id);

    if (poll) {
      logger.info(`🗳️ Poll found for deleted message: ${message.id}`);
      logger.info(`📊 Poll ID: ${poll.id}, Question: "${poll.question}"`);

      // Delete the poll from database
      const deleted = await storageManager.deletePoll(poll.id);

      if (deleted) {
        logger.info(`✅ Poll data removed from database: ${poll.id}`);
      } else {
        logger.warn(`⚠️ Failed to remove poll data from database: ${poll.id}`);
      }
    } else {
      logger.info(`ℹ️ No poll found for deleted message: ${message.id}`);
    }
  } catch (error) {
    logger.error("Error handling message deletion", error);
  }
}
