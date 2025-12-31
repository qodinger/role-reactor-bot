import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    // Test environment
    environment: "node",

    // File patterns to test
    include: ["**/tests/**/*.test.js", "**/tests/**/*.spec.js"],

    // Test timeout
    testTimeout: 10000,

    // Global setup
    setupFiles: ["./tests/setup.js"],

    // Coverage configuration
    coverage: {
      enabled: false, // Disabled for now, enable with --coverage flag
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "node_modules/**",
        "tests/**",
        "src/index.js",
        "src/config/**", // Exclude config files from coverage
      ],
    },

    // Globals (allows using describe, it, expect without imports)
    globals: false, // Explicit imports for clarity

    // Watch mode options
    watch: false,

    // Output configuration
    reporter: ["verbose"], // Options: "verbose" (default), "dot", "json", "junit", "hanging-process"
    // Use "verbose" for detailed output, "dot" for minimal dots, "json" for JSON format

    // Suppress stdout during tests (stderr/errors still shown)
    onConsoleLog(log, type) {
      if (type === "stdout") {
        return false; // Suppress all stdout messages
      }
      return true; // Keep stderr/errors
    },

    // Pool options to reduce worker termination issues
    // Using threads instead of forks to avoid EPERM errors on macOS
    // In Vitest 4, poolOptions are now top-level options
    pool: "threads",
    threads: {
      singleThread: false,
      isolate: true,
    },

    // Suppress console output during tests (errors are still caught)
    silent: false, // Keep false, use onConsoleLog above to filter stdout

    // Log configuration
    logHeapUsage: false,
  },
  resolve: {
    alias: {
      "^src/(.*)$": resolve(__dirname, "./src/$1"),
    },
  },
});
