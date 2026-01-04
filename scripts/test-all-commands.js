#!/usr/bin/env node

/**
 * Test All Commands Script
 *
 * This script helps verify that all commands are working correctly
 * by running unit tests and providing a checklist for manual testing.
 *
 * Usage:
 *   node scripts/test-all-commands.js
 *   node scripts/test-all-commands.js --category general
 *   node scripts/test-all-commands.js --missing
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Command categories
const COMMAND_CATEGORIES = {
  admin: [
    "goodbye",
    "moderation",
    "role-reactions",
    "schedule-role",
    "temp-roles",
    "voice-roles",
    "welcome",
    "xp",
  ],
  developer: ["core-management", "health", "imagine", "performance", "storage"],
  general: [
    "8ball",
    "ask",
    "avatar",
    "core",
    "help",
    "invite",
    "leaderboard",
    "level",
    "ping",
    "poll",
    "rps",
    "serverinfo",
    "support",
    "userinfo",
    "wyr",
  ],
};

// Commands with existing tests
const COMMANDS_WITH_TESTS = {
  admin: [
    "goodbye",
    "moderation",
    "role-reactions",
    "schedule-role",
    "temp-roles",
    "welcome",
    "xp",
  ],
  developer: ["core-management", "health", "performance"],
  general: [
    "8ball",
    "help",
    "invite",
    "leaderboard",
    "level",
    "poll",
    "rps",
    "serverinfo",
    "userinfo",
  ],
};

/**
 * Get commands missing tests
 */
function getMissingTests() {
  const missing = {
    admin: [],
    developer: [],
    general: [],
  };

  for (const category of Object.keys(COMMAND_CATEGORIES)) {
    const allCommands = COMMAND_CATEGORIES[category];
    const testedCommands = COMMANDS_WITH_TESTS[category] || [];
    missing[category] = allCommands.filter(
      cmd => !testedCommands.includes(cmd),
    );
  }

  return missing;
}

/**
 * Run tests for a specific category
 */
function runTestsForCategory(category) {
  const testPath = join(projectRoot, "tests", "unit", "commands", category);

  if (!existsSync(testPath)) {
    console.log(`❌ No test directory found for category: ${category}`);
    return false;
  }

  try {
    console.log(`\n🧪 Running tests for ${category} commands...\n`);
    execSync(`pnpm test ${testPath}`, {
      stdio: "inherit",
      cwd: projectRoot,
    });
    return true;
  } catch (_error) {
    console.error(`\n❌ Tests failed for ${category} commands`);
    return false;
  }
}

/**
 * Run all command tests
 */
function runAllTests() {
  console.log("🚀 Running all command tests...\n");
  try {
    execSync("pnpm test tests/unit/commands/", {
      stdio: "inherit",
      cwd: projectRoot,
    });
    return true;
  } catch (_error) {
    console.error("\n❌ Some tests failed");
    return false;
  }
}

/**
 * Display test coverage summary
 */
function displayCoverageSummary() {
  console.log("\n📊 Command Test Coverage Summary\n");
  console.log("=".repeat(60));

  let totalCommands = 0;
  let totalTested = 0;

  for (const category of Object.keys(COMMAND_CATEGORIES)) {
    const commands = COMMAND_CATEGORIES[category];
    const tested = COMMANDS_WITH_TESTS[category] || [];
    const missing = commands.filter(cmd => !tested.includes(cmd));

    totalCommands += commands.length;
    totalTested += tested.length;

    console.log(`\n${category.toUpperCase()} Commands:`);
    console.log(`  Total: ${commands.length}`);
    console.log(`  ✅ Tested: ${tested.length}`);
    console.log(`  ❌ Missing: ${missing.length}`);

    if (missing.length > 0) {
      console.log(`  Missing tests: ${missing.join(", ")}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`\nOverall: ${totalTested}/${totalCommands} commands have tests`);
  console.log(`Coverage: ${((totalTested / totalCommands) * 100).toFixed(1)}%`);
}

/**
 * Display missing tests
 */
function displayMissingTests() {
  const missing = getMissingTests();
  console.log("\n❌ Commands Missing Tests\n");
  console.log(`${"=".repeat(60)}`);

  let hasMissing = false;

  for (const category of Object.keys(missing)) {
    if (missing[category].length > 0) {
      hasMissing = true;
      console.log(`\n${category.toUpperCase()}:`);
      for (const cmd of missing[category]) {
        const testPath = `tests/unit/commands/${category}/${cmd}.test.js`;
        console.log(`  - ${cmd} (${testPath})`);
      }
    }
  }

  if (!hasMissing) {
    console.log("\n✅ All commands have tests!");
  }

  console.log(`\n${"=".repeat(60)}`);
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const category = args
    .find(arg => arg.startsWith("--category="))
    ?.split("=")[1];
  const showMissing = args.includes("--missing");
  const showSummary = args.includes("--summary") || (!category && !showMissing);

  if (showSummary) {
    displayCoverageSummary();
  }

  if (showMissing) {
    displayMissingTests();
    return;
  }

  if (category) {
    if (!["admin", "developer", "general"].includes(category)) {
      console.error(`❌ Invalid category: ${category}`);
      console.error("Valid categories: admin, developer, general");
      process.exit(1);
    }
    const success = runTestsForCategory(category);
    process.exit(success ? 0 : 1);
  } else {
    const success = runAllTests();
    process.exit(success ? 0 : 1);
  }
}

main();
