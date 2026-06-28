import { Events } from "discord.js";
import {
  getAllRoleMappings,
  removeRoleMapping,
} from "../utils/discord/roleMappingManager.js";
import { getLogger } from "../utils/logger.js";

export const name = Events.GuildDelete;

export async function execute(guild, client) {
  const logger = getLogger();

  if (!guild) throw new Error("Missing guild");
  if (!client) throw new Error("Missing client");

  logger.info(`➖ Bot left guild: ${guild.name} (${guild.id})`);

  try {
    const { getDatabaseManager } = await import(
      "../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    // Clean up role mappings from cache/DB
    const allMappings = await getAllRoleMappings();
    let removedMappings = 0;
    for (const [messageId, mapping] of Object.entries(allMappings)) {
      if (mapping.guildId === guild.id) {
        const removed = await removeRoleMapping(messageId);
        if (removed) removedMappings++;
      }
    }
    if (removedMappings > 0) {
      logger.debug(
        `🗑️ Removed ${removedMappings} role mappings for guild ${guild.id}`,
      );
    }

    // Only clean ephemeral data — keep settings, XP, logs, configs
    // so data is preserved if the bot is reinstalled
    const ephemeralTasks = [
      {
        name: "temporary_roles",
        fn: () =>
          dbManager.temporaryRoles?.collection?.deleteMany({
            guildId: guild.id,
          }),
      },
      { name: "tickets", fn: () => dbManager.tickets?.deleteByGuild(guild.id) },
      {
        name: "ticket_panels",
        fn: () =>
          dbManager.ticketPanels?.collection?.deleteMany({ guildId: guild.id }),
      },
    ];

    let cleaned = 0;
    for (const task of ephemeralTasks) {
      try {
        const result = await task.fn();
        if (result?.deletedCount > 0) {
          cleaned += result.deletedCount;
          logger.debug(`🗑️ Cleaned ${task.name} for guild ${guild.id}`);
        }
      } catch {
        // Repository may not be initialized — skip
      }
    }

    if (cleaned > 0) {
      logger.info(
        `🗑️ Cleaned ${cleaned} ephemeral documents for left guild: ${guild.name} (${guild.id})`,
      );
    }

    // Record guild leave in history
    if (dbManager.guildHistory) {
      await dbManager.guildHistory.recordLeave(guild.id);
      logger.info(`📝 Recorded guild leave: ${guild.name} (${guild.id})`);
    }
  } catch (error) {
    logger.error(`Error handling guild deletion for ${guild.id}`, error);
  }
}
