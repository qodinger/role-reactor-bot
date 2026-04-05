import fs from "fs";
import { getLogger } from "../utils/logger.js";

export function isDockerEnvironment() {
  return (
    process.env.NODE_ENV === "production" &&
    (process.env.DOCKER_ENV === "true" ||
      fs.existsSync("/.dockerenv") ||
      (fs.existsSync("/proc/1/cgroup") &&
        fs.readFileSync("/proc/1/cgroup", "utf8").includes("docker")))
  );
}

export async function waitForDockerStartup() {
  if (!isDockerEnvironment()) return;

  const logger = getLogger();
  logger.info(
    "🐳 Docker environment detected, waiting for system stability...",
  );

  await new Promise(resolve => {
    setTimeout(resolve, 2000);
  });

  try {
    await fs.promises.access("./data", fs.constants.R_OK | fs.constants.W_OK);
    logger.info("✅ Data directory is accessible");
  } catch (_error) {
    logger.warn("⚠️ Data directory not accessible, creating...");
    try {
      await fs.promises.mkdir("./data", { recursive: true });
      logger.info("✅ Data directory created");
    } catch (mkdirError) {
      logger.error("❌ Failed to create data directory:", mkdirError);
    }
  }

  await new Promise(resolve => {
    setTimeout(resolve, 1000);
  });
  logger.info("🚀 Docker startup wait completed");
}
