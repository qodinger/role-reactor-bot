import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getLogger } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let versionCache = null;

/**
 * Gets the current version of the application from package.json.
 * @returns {string}
 */
export function getVersion() {
  if (versionCache) {
    return versionCache;
  }

  const logger = getLogger();
  try {
    const packageJsonPath = join(__dirname, "../../../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    versionCache = packageJson.version || "Unknown";
    return versionCache;
  } catch (error) {
    logger.error("Failed to read version from package.json", error);
    return "Unknown";
  }
}
