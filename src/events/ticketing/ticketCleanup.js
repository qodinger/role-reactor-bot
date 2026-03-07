import { getTicketTranscript } from "../../features/ticketing/TicketTranscript.js";
import { getTicketManager } from "../../features/ticketing/TicketManager.js";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

/**
 * Auto-cleanup cron job for expired transcripts and tickets
 * Runs every 6 hours
 */
export function startTicketCleanup() {
  logger.info("🎫 Starting ticket cleanup cron job...");

  // Run every 6 hours
  const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000;

  setInterval(async () => {
    try {
      await runCleanup();
    } catch (error) {
      logger.error("Ticket cleanup error:", error);
    }
  }, CLEANUP_INTERVAL);

  // Run on startup
  setTimeout(() => {
    runCleanup().catch(error => {
      logger.error("Initial ticket cleanup error:", error);
    });
  }, 60000); // 1 minute after startup

  logger.info("✅ Ticket cleanup cron job started (runs every 6 hours)");
}

/**
 * Run cleanup for all guilds
 */
async function runCleanup() {
  try {
    const storage = await import("../../utils/storage/storageManager.js");
    const storageManager = await storage.getStorageManager();

    if (!storageManager.dbManager) {
      logger.warn("Database not available, skipping ticket cleanup");
      return;
    }

    // Get all guilds with tickets using aggregation
    const result = await storageManager.dbManager.tickets.collection.aggregate([
      { $match: { status: "open" } },
      { $group: { _id: "$guildId" } }
    ]).toArray();

    const guildIds = result.map(r => r._id);

    let totalDeleted = 0;
    let totalTranscriptsDeleted = 0;

    for (const guildId of guildIds) {
      try {
        const cleanupResult = await cleanupGuild(guildId, storageManager);
        totalDeleted += cleanupResult.ticketsDeleted;
        totalTranscriptsDeleted += cleanupResult.transcriptsDeleted;
      } catch (error) {
        logger.error(`Cleanup error for guild ${guildId}:`, error.message);
      }
    }

    if (totalDeleted > 0 || totalTranscriptsDeleted > 0) {
      logger.info(
        `🎫 Ticket cleanup complete: ` +
          `${totalDeleted} tickets, ${totalTranscriptsDeleted} transcripts deleted`,
      );
    } else {
      logger.debug("🎫 Ticket cleanup: No expired tickets found");
    }
  } catch (error) {
    logger.error("Ticket cleanup run error:", error);
  }
}

/**
 * Cleanup expired tickets and transcripts for a guild
 * @param {string} guildId - Guild ID
 * @param {Object} storageManager - Storage manager instance
 * @returns {Promise<Object>} Cleanup results
 */
async function cleanupGuild(guildId, storageManager) {
  const ticketManager = getTicketManager();
  const ticketTranscript = getTicketTranscript();

  await ticketManager.initialize();
  await ticketTranscript.initialize();

  // Get expired tickets (7+ days inactive for free, 30+ for pro)
  const expiredTickets = await ticketManager.getExpiredTickets(guildId, 7);

  let ticketsDeleted = 0;
  let transcriptsDeleted = 0;

  for (const ticket of expiredTickets) {
    try {
      // Check if channel still exists
      const guild =
        await storageManager.dbManager.connectionManager.db.adapter.db.client.guilds
          .fetch(guildId)
          .catch(() => null);

      if (!guild) {
        // Guild no longer exists, delete ticket
        await ticketManager.deleteTicket(ticket.ticketId);
        ticketsDeleted++;
        continue;
      }

      const channel = await guild.channels
        .fetch(ticket.channelId)
        .catch(() => null);

      if (!channel) {
        // Channel deleted, clean up database
        await ticketManager.deleteTicket(ticket.ticketId);
        ticketsDeleted++;
        logger.info(
          `🎫 Deleted ticket ${ticket.ticketId} (channel no longer exists)`,
        );
        continue;
      }

      // Check last message activity
      const messages = await channel.messages
        .fetch({ limit: 1 })
        .catch(() => []);
      if (messages.size === 0) {
        // Empty channel, check ticket age
        const ticketAge = Date.now() - new Date(ticket.openedAt).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        if (ticketAge > sevenDays) {
          // Generate transcript before closing
          await ticketTranscript.generateFromChannel({
            ticketId: ticket.ticketId,
            guildId,
            channel,
            ticket,
            format: "html",
          });

          // Close and delete
          await ticketManager.closeTicket(
            ticket.ticketId,
            "system",
            "Auto-closed: inactive",
          );
          await channel.delete("Auto-closed: inactive for 7+ days");
          ticketsDeleted++;
          logger.info(
            `🎫 Auto-closed ticket ${ticket.ticketId} (inactive for 7+ days)`,
          );
        }
      }
    } catch (error) {
      logger.error(
        `Cleanup error for ticket ${ticket.ticketId}:`,
        error.message,
      );
    }
  }

  // Cleanup expired transcripts
  transcriptsDeleted = await ticketTranscript.cleanupExpired(guildId);

  return { ticketsDeleted, transcriptsDeleted };
}

/**
 * Stop the cleanup cron job
 */
export function stopTicketCleanup() {
  logger.info("🎫 Stopping ticket cleanup cron job...");
  // Interval will be cleared automatically when process exits
}
