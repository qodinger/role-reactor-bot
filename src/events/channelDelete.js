import { Events } from "discord.js";
import {
  getAllRoleMappings,
  removeRoleMapping,
} from "../utils/discord/roleMappingManager.js";
import { getLogger } from "../utils/logger.js";
import { getTicketManager } from "../features/ticketing/TicketManager.js";

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

    // 2. Handle Ticket Deletion (Sync Database)
    const ticketManager = getTicketManager();
    await ticketManager.initialize();
    const ticket = await ticketManager.storage.getTicketByChannel(channel.id);
    if (ticket && (ticket.status === "open" || ticket.status === "closed")) {
      logger.info(
        `🗑️ Ticket channel/thread deleted: ${ticket.ticketId}. Syncing DB...`,
      );
      await ticketManager.storage.closeTicket(ticket.ticketId, {
        closedBy: "SYSTEM",
        reason: "Channel/Thread deleted manually",
      });
    }
  } catch (error) {
    logger.error("Error handling channel deletion", error);
  }
}
