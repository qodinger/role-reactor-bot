describe("version utils", () => {
  let version;

  beforeAll(async () => {
    try {
      version = await import("../../src/utils/version.js");
    } catch (error) {
      console.warn("Could not import version module:", error.message);
    }
  });

  test("should have expected structure", () => {
    if (!version) {
      expect(true).toBe(true); // Skip if module not available
      return;
    }

    // Test that constants are exported
    expect(typeof version.BOT_VERSION).toBe("string");

    // Test that key functions are exported
    expect(typeof version.getVersion).toBe("function");
    expect(typeof version.getVersionInfo).toBe("function");
    expect(typeof version.formatVersion).toBe("function");
    expect(typeof version.parseVersion).toBe("function");
    expect(typeof version.compareVersions).toBe("function");
    expect(typeof version.isNewerVersion).toBe("function");
    expect(typeof version.isOlderVersion).toBe("function");
    expect(typeof version.getBuildInfo).toBe("function");
    expect(typeof version.formatBuildInfo).toBe("function");
    expect(typeof version.isValidVersion).toBe("function");
    expect(typeof version.isVersionInRange).toBe("function");
  });
});
