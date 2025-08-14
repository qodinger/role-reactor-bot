#!/usr/bin/env node

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load environment variables based on NODE_ENV
 * Priority: .env.{NODE_ENV} > .env.local > .env
 */
function loadEnvironment() {
  const env = process.env.NODE_ENV || "development";
  const projectRoot = join(__dirname, "..");

  // Define environment file paths in order of priority
  const envFiles = [
    join(projectRoot, `.env.${env}`),
    join(projectRoot, ".env.local"),
    join(projectRoot, ".env"),
  ];

  // Load the first available environment file
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      console.log(`📁 Loading environment from: ${envFile}`);
      config({ path: envFile });
      return;
    }
  }

  // Fallback to default .env if no specific environment file exists
  if (fs.existsSync(join(projectRoot, ".env"))) {
    console.log("📁 Loading environment from: .env");
    config();
  } else {
    console.warn(
      "⚠️  No environment file found. Using system environment variables.",
    );
    console.warn(`📁 Please create .env.${env} from env.template.${env}`);
    console.warn(`💡 Example: cp env.template.${env} .env.${env}`);
  }
}

// Load environment variables
loadEnvironment();

// Export for use in other scripts
export { loadEnvironment };
