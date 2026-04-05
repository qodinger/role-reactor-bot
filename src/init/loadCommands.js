import fs from "fs";
import path from "path";
import { getLogger } from "../utils/logger.js";
import { getCommandHandler } from "../utils/core/commandHandler.js";

export async function loadCommands(client, commandsPath) {
  const logger = getLogger();
  const commandHandler = getCommandHandler();

  try {
    commandHandler.setClient(client);

    const commandFolders = await fs.promises.readdir(commandsPath);
    let loadedCount = 0;
    let errorCount = 0;

    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      const stats = await fs.promises.stat(folderPath);

      if (!stats.isDirectory()) continue;

      const commandFiles = (await fs.promises.readdir(folderPath)).filter(
        file => file.endsWith(".js"),
      );

      const subfolders = [];
      for (const item of await fs.promises.readdir(folderPath)) {
        const itemPath = path.join(folderPath, item);
        try {
          const itemStats = await fs.promises.stat(itemPath);
          if (itemStats.isDirectory()) {
            try {
              await fs.promises.access(path.join(itemPath, "index.js"));
              subfolders.push(item);
            } catch {
              // index.js doesn't exist, skip this subfolder
            }
          }
        } catch {
          // Can't stat item, skip
        }
      }

      for (const file of commandFiles) {
        try {
          const filePath = path.join(folderPath, file);
          const command = await import(filePath);

          if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
            const registered = commandHandler.registerCommand(command);

            if (registered) {
              loadedCount++;
              logger.debug(`✅ Loaded command: ${command.data.name}`);
            } else {
              errorCount++;
              logger.error(
                `❌ Failed to register command: ${command.data.name}`,
              );
            }
          } else {
            errorCount++;
            logger.warn(
              `⚠️ Command file ${file} is missing data or execute function`,
            );
          }
        } catch (error) {
          errorCount++;
          logger.error(`❌ Failed to load command from ${file}:`, error);
        }
      }

      for (const subfolder of subfolders) {
        try {
          const indexPath = path.join(folderPath, subfolder, "index.js");
          const command = await import(indexPath);

          if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
            const registered = commandHandler.registerCommand(command);

            if (registered) {
              loadedCount++;
              logger.debug(`✅ Loaded command: ${command.data.name}`);
            } else {
              errorCount++;
              logger.error(
                `❌ Failed to register command: ${command.data.name}`,
              );
            }
          } else {
            errorCount++;
            logger.warn(
              `⚠️ Command file ${subfolder}/index.js is missing data or execute function`,
            );
          }
        } catch (error) {
          errorCount++;
          logger.error(
            `❌ Failed to load command from ${subfolder}/index.js:`,
            error,
          );
        }
      }
    }

    const debugInfo = commandHandler.getAllCommandsDebug();

    if (!debugInfo.synchronized) {
      logger.warn(`⚠️ Command collections are not synchronized!`);
      logger.warn(
        `📊 Handler: ${debugInfo.handlerCount} commands, Client: ${debugInfo.clientCount} commands`,
      );

      const missingInClient = debugInfo.handler.filter(
        cmd => !debugInfo.client.includes(cmd),
      );
      const missingInHandler = debugInfo.client.filter(
        cmd => !debugInfo.handler.includes(cmd),
      );

      if (missingInClient.length > 0) {
        logger.warn(
          `⚠️ Commands missing in client: ${missingInClient.join(", ")}`,
        );
      }
      if (missingInHandler.length > 0) {
        logger.warn(
          `⚠️ Commands missing in handler: ${missingInHandler.join(", ")}`,
        );
      }
    } else {
      logger.info(
        `✅ Command collections are synchronized (${debugInfo.handlerCount} commands)`,
      );
    }

    logger.info(
      `✅ Loaded ${loadedCount} commands successfully (${errorCount} errors)`,
    );
    logger.info(
      `📊 Client commands: ${debugInfo.clientCount}, Handler commands: ${debugInfo.handlerCount}`,
    );

    logger.debug(`📋 Handler commands: ${debugInfo.handler.join(", ")}`);
    logger.debug(`📋 Client commands: ${debugInfo.client.join(", ")}`);
  } catch (error) {
    logger.error("❌ Failed to load commands:", error);
    throw error;
  }
}
