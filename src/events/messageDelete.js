import { Events } from "discord.js";
import { removeRoleMapping } from "../utils/roleManager.js";
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
  } catch (error) {
    logger.error("Error handling message deletion", error);
  }
}
