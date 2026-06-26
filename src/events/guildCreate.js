import { Events } from "discord.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger();

export const name = Events.GuildCreate;

/**
 * Handle bot joining a guild
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Client} client
 */
export async function execute(guild, _client) {
  logger.info(`📥 Bot joined guild: ${guild.name} (${guild.id})`);

  try {
    const { getStorageManager } = await import(
      "../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();
    if (!storage?.dbManager?.guildHistory) {
      logger.warn("GuildHistoryRepository not available");
      return;
    }

    await storage.dbManager.guildHistory.recordJoin(
      guild.id,
      guild.name,
      guild.icon,
      guild.ownerId,
      guild.memberCount,
    );

    logger.info(`✅ Recorded guild join: ${guild.name} (${guild.id})`);
  } catch (error) {
    logger.error(`❌ Error recording guild join for ${guild.id}:`, error);
  }
}
