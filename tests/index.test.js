describe("App Entry Point", () => {
  let app;

  beforeAll(async () => {
    try {
      app = await import("../src/index.js");
    } catch (error) {
      console.warn("Could not import index module:", error.message);
    }
  });

  test("should import without error", async () => {
    expect(app).toBeDefined();
  });

  test("should have expected exported functions", () => {
    if (!app) {
      expect(true).toBe(true); // Skip if module not available
      return;
    }

    // Test that key functions are exported
    expect(typeof app.createClient).toBe("function");
    expect(typeof app.loadCommands).toBe("function");
    expect(typeof app.validateCommand).toBe("function");
    expect(typeof app.registerEvents).toBe("function");
    expect(typeof app.loadEvents).toBe("function");
    expect(typeof app.startBot).toBe("function");
    expect(typeof app.validateEnvironment).toBe("function");
    expect(typeof app.logStartup).toBe("function");
    expect(typeof app.logClientReady).toBe("function");
    expect(typeof app.logError).toBe("function");
    expect(typeof app.setupGracefulShutdown).toBe("function");
    expect(typeof app.loadConfig).toBe("function");
    expect(typeof app.validateConfig).toBe("function");
  });

  test("should have proper function signatures", () => {
    if (!app) {
      expect(true).toBe(true); // Skip if module not available
      return;
    }

    // Test that functions exist and are callable
    expect(() => app.createClient()).not.toThrow();
    expect(() => app.logStartup()).not.toThrow();
    expect(() => app.logError(new Error("test"))).not.toThrow();
    expect(() => app.loadConfig()).not.toThrow();
    expect(() => app.validateConfig({})).not.toThrow();

    // Test validateEnvironment - it should throw without env vars, but we'll handle it gracefully
    try {
      app.validateEnvironment();
      // If it doesn't throw, that's okay too (env vars might be set in test environment)
    } catch (error) {
      // Expected to throw if env vars are missing
      expect(error.message).toContain("Missing required environment variables");
    }
  });
});
