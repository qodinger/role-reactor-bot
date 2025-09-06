/**
 * @fileoverview Jest configuration for Role Reactor Bot
 *
 * Configures Jest for testing with ES modules,
 * proper mocking, and coverage reporting.
 *
 * @author Tyecode
 * @version 0.1.0
 * @license MIT
 */

export default {
  // Test environment
  testEnvironment: "node",

  // File extensions to test
  testMatch: ["**/tests/**/*.test.js", "**/tests/**/*.spec.js"],

  // Coverage configuration - disabled for now since tests focus on behavior
  collectCoverage: false,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],

  // Files to collect coverage from
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/index.js", // Exclude main entry point
    "!src/config/**", // Exclude config files
    "!**/node_modules/**",
    "!**/tests/**",
  ],

  // Setup files - temporarily disabled to fix module resolution
  // setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

  // Transform configuration
  transform: {},

  // ES Module support
  globals: {
    "ts-jest": {
      useESM: true,
    },
  },

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Reset modules between tests
  resetModules: true,

  // Force exit to prevent hanging processes
  forceExit: true,

  // Detect open handles to find leaks
  detectOpenHandles: true,

  // Module name mapping for better resolution
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
