module.exports = {
  // Test environment
  testEnvironment: "node",

  // Test file patterns
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],

  // Directories to ignore
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],

  // Coverage settings
  collectCoverage: false,
  collectCoverageFrom: ["src/**/*.js", "!src/index.js", "!**/node_modules/**"],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

  // Module name mapping
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,
};
