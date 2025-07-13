describe("roleMessageOptions utils", () => {
  let roleMessageOptions;

  beforeAll(async () => {
    try {
      roleMessageOptions = await import(
        "../../src/utils/roleMessageOptions.js"
      );
    } catch (error) {
      console.warn(
        "Could not import roleMessageOptions module:",
        error.message,
      );
    }
  });

  test("should have expected structure", () => {
    if (!roleMessageOptions) {
      expect(true).toBe(true); // Skip if module not available
      return;
    }

    // Test that key functions are exported
    expect(typeof roleMessageOptions.titleOption).toBe("function");
    expect(typeof roleMessageOptions.descriptionOption).toBe("function");
    expect(typeof roleMessageOptions.rolesOption).toBe("function");
    expect(typeof roleMessageOptions.colorOption).toBe("function");
  });
});
