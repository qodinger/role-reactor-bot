export default {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],
  collectCoverage: false,
  collectCoverageFrom: ["src/**/*.js", "!src/index.js", "!**/node_modules/**"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  // Worker process cleanup options
  forceExit: true,
  detectOpenHandles: false,
  globals: {
    "ts-jest": {
      useESM: true,
    },
  },
  transform: {
    "^.+\\.js$": [
      "babel-jest",
      {
        presets: [["@babel/preset-env", { targets: { node: "current" } }]],
      },
    ],
  },
  moduleFileExtensions: ["js", "json"],
  testRunner: "jest-circus/runner",
};
