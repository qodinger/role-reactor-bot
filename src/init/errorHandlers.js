import { getLogger } from "../utils/logger.js";
import { getBotContext } from "../utils/core/BotContext.js";

export function setupErrorHandlers() {
  process.on("unhandledRejection", error => {
    getLogger().error("Unhandled promise rejection:", error);
  });

  process.on("uncaughtException", async error => {
    getLogger().error("Uncaught exception:", error);
    try {
      const ctx = getBotContext();
      if (ctx.client) {
        await ctx.shutdown();
      }
    } catch (shutdownError) {
      getLogger().error("Error during emergency shutdown:", shutdownError);
    }
    process.exit(1);
  });
}
