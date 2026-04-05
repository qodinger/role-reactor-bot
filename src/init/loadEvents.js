import fs from "fs";
import path from "path";
import { getLogger } from "../utils/logger.js";
import { getEventHandler } from "../utils/core/eventHandler.js";

export async function loadEvents(client, eventsPath) {
  const logger = getLogger();
  const eventHandler = getEventHandler();

  try {
    const eventFiles = (await fs.promises.readdir(eventsPath)).filter(file =>
      file.endsWith(".js"),
    );

    let loadedEvents = 0;

    for (const file of eventFiles) {
      try {
        const filePath = path.join(eventsPath, file);
        const event = await import(filePath);

        if (!event.name || !event.execute) {
          logger.warn(`Event file ${file} is missing name or execute function`);
          continue;
        }

        const eventExecutor = (...args) =>
          eventHandler.processEvent(event.name, event.execute, ...args, client);

        if (event.once) {
          client.once(event.name, eventExecutor);
        } else {
          client.on(event.name, eventExecutor);
        }

        loadedEvents++;
        logger.debug(`Loaded event: ${event.name}`);
      } catch (error) {
        logger.error(`Failed to load event from ${file}:`, error);
      }
    }

    logger.info(`✅ Loaded ${loadedEvents} events`);
  } catch (error) {
    logger.error("Failed to load events:", error);
    throw error;
  }
}
