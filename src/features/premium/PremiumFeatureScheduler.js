import { getPremiumManager } from "./PremiumManager.js";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

export class PremiumFeatureScheduler {
  constructor() {
    this.intervalId = null;
    // Check every 6 hours
    this.checkInterval = 6 * 60 * 60 * 1000;
  }

  start() {
    if (this.intervalId) return;

    logger.info("🕐 Starting Premium Feature scheduler...");

    // Initial check
    this.runCheck();

    this.intervalId = setInterval(() => {
      this.runCheck();
    }, this.checkInterval);

    // Allow the process to exit if only the interval is remaining
    this.intervalId.unref();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("🛑 Stopped Premium Feature scheduler.");
    }
  }

  async runCheck() {
    try {
      const manager = getPremiumManager();
      await manager.processRenewals();
    } catch (error) {
      logger.error("❌ Premium Feature check failed:", error);
    }
  }
}

let scheduler = null;
export function getPremiumFeatureScheduler() {
  if (!scheduler) scheduler = new PremiumFeatureScheduler();
  return scheduler;
}
