import { Events } from "discord.js";
import { getTicketManager } from "../features/ticketing/TicketManager.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger();

export const name = Events.ThreadDelete;

/**
 * Handle thread deletion to keep ticketing database in sync
 */
export async function execute(thread) {
  try {
    const ticketManager = getTicketManager();
    await ticketManager.initialize();

    // Check if this thread was a ticket
    const ticket = await ticketManager.storage.getTicketByChannel(thread.id);
    if (!ticket) return;

    // If it was still open, mark it as closed (or archived/deleted)
    if (ticket.status === "open" || ticket.status === "closed") {
      logger.info(`Ticket thread deleted manually: ${ticket.ticketId}. Syncing database...`);
      
      // We mark as 'archived' or 'closed' to allow user to open new tickets
      await ticketManager.storage.closeTicket(ticket.ticketId, {
        closedBy: "SYSTEM",
        reason: "Thread deleted manually from Discord",
      });
    }
  } catch (error) {
    logger.error("Error handling thread deletion for ticketing:", error);
  }
}
