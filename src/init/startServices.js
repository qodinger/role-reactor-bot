import { getLogger } from "../utils/logger.js";
import { getStorageManager } from "../utils/storage/storageManager.js";
import { getBotContext } from "../utils/core/BotContext.js";
import { getVersion } from "../utils/discord/version.js";
import { startWebhookServer, setClient } from "../server/index.js";
import { getScheduler as getRoleExpirationScheduler } from "../features/temporaryRoles/RoleExpirationScheduler.js";

/**
 * Initialize all subsystems after the Discord client is ready.
 * Extracted from index.js clientReady callback for clarity.
 *
 * @param {import('discord.js').Client} client
 */
export async function startServices(client) {
  const logger = getLogger();
  logger.success(`✅ ${client.user.tag} v${getVersion()} is ready!`);

  // Fetch application commands for mentionable references
  try {
    await client.application.commands.fetch();
    logger.debug("✅ Application commands fetched for clickable mentions");
  } catch (error) {
    logger.warn(
      "⚠️ Failed to fetch application commands for clickable mentions:",
      error.message,
    );
  }

  // Start webhook server for crypto payment integration
  try {
    await startWebhookServer();
    setClient(client);
  } catch (error) {
    logger.error("❌ Failed to start webhook server:", error);
  }

  const ctx = getBotContext();

  // ── Schedulers ───────────────────────────────────────────

  // Role scheduler
  const roleScheduler = (
    await import("../features/scheduledRoles/RoleScheduler.js")
  ).getScheduler(client);
  ctx.roleScheduler = roleScheduler;
  roleScheduler.start();

  // Generation history cleanup (fire-and-forget)
  import("../commands/general/avatar/utils/generationHistory.js")
    .then(({ GenerationHistory }) => GenerationHistory.startAutoCleanup())
    .catch(error =>
      logger.warn("Failed to start generation history cleanup:", error.message),
    );

  // Temporary role expiration
  const tempRoleScheduler = getRoleExpirationScheduler(client);
  ctx.tempRoleScheduler = tempRoleScheduler;
  tempRoleScheduler.start();

  // Ticket cleanup
  try {
    const { startTicketCleanup } = await import(
      "../events/ticketing/ticketCleanup.js"
    );
    startTicketCleanup(client);
    logger.info("✅ Ticketing system cleanup started");
  } catch (error) {
    logger.error("❌ Failed to start ticket cleanup:", error);
  }

  // ── Feature Managers ─────────────────────────────────────

  // Giveaway Manager
  try {
    const giveawayManager = (
      await import("../features/giveaway/GiveawayManager.js")
    ).default;
    ctx.giveawayManager = giveawayManager;
    await giveawayManager.init();
    giveawayManager.client = client;

    const { setupGiveawayEvents } = await import("../events/giveaway.js");
    setupGiveawayEvents(giveawayManager, client);
    logger.info("✅ Giveaway Manager initialized");
  } catch (error) {
    logger.error("❌ Failed to initialize Giveaway Manager:", error);
  }

  // Role Bundle Manager
  try {
    const roleBundleManager = (
      await import("../features/rolebundles/RoleBundleManager.js")
    ).default;
    await roleBundleManager.init();
  } catch (error) {
    logger.error("❌ Failed to initialize Role Bundle Manager:", error);
  }

  // Premium Feature scheduler
  try {
    const { getPremiumFeatureScheduler } = await import(
      "../features/premium/PremiumFeatureScheduler.js"
    );
    const { getPremiumManager } = await import(
      "../features/premium/PremiumManager.js"
    );
    const premiumScheduler = getPremiumFeatureScheduler();
    ctx.premiumScheduler = premiumScheduler;

    const premiumManager = getPremiumManager();
    premiumManager.setClient(client);
    premiumScheduler.start();
  } catch (error) {
    logger.error("❌ Failed to start premium scheduler:", error);
  }

  // Streaming Manager
  try {
    const { getStreamingManager } = await import(
      "../features/streaming/StreamingManager.js"
    );
    const streamingManager = getStreamingManager(client);
    ctx.streamingManager = streamingManager;
    await streamingManager.init();
    logger.info("✅ Streaming Manager initialized");
  } catch (error) {
    logger.error("❌ Failed to initialize Streaming Manager:", error);
  }

  // ── Cleanup Intervals ────────────────────────────────────

  // Poll cleanup (every 6 hours)
  if (ctx.pollCleanupInterval) {
    clearInterval(ctx.pollCleanupInterval);
  }
  const POLL_CLEANUP_INTERVAL_MS =
    parseInt(process.env.POLL_CLEANUP_INTERVAL_MS) || 6 * 60 * 60 * 1000;
  ctx.pollCleanupInterval = setInterval(async () => {
    try {
      const storageManager = await getStorageManager();
      const cleanedCount = await storageManager.cleanupEndedPolls();
      if (cleanedCount > 0) {
        logger.info(`🧹 Poll cleanup: Removed ${cleanedCount} ended polls`);
      }
    } catch (error) {
      logger.error("❌ Poll cleanup failed:", error);
    }
  }, POLL_CLEANUP_INTERVAL_MS).unref();

  // ── Post-Init ────────────────────────────────────────────

  // Health check
  const { getHealthCheckRunner } = await import(
    "../utils/monitoring/healthCheck.js"
  );
  getHealthCheckRunner().run(client);

  // Performance monitoring
  const { getPerformanceMonitor } = await import(
    "../utils/monitoring/performanceMonitor.js"
  );
  getPerformanceMonitor().startMonitoring();
}
