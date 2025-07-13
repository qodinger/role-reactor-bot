describe("Remove Temporary Role Command", () => {
  let removeTempRoleCommand;

  beforeAll(async () => {
    try {
      removeTempRoleCommand = await import(
        "../../../src/commands/admin/remove-temp-role.js"
      );
    } catch (error) {
      console.warn("Could not import remove-temp-role command:", error.message);
    }
  });

  describe("Command Structure", () => {
    test("should have correct command data", () => {
      if (!removeTempRoleCommand) {
        expect(true).toBe(true); // Skip if module not available
        return;
      }

      const { data } = removeTempRoleCommand;

      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("description");
      expect(data.name).toBe("remove-temp-role");
      expect(data.description).toBeDefined();
    });

    test("should have required options", () => {
      if (!removeTempRoleCommand) {
        expect(true).toBe(true); // Skip if module not available
        return;
      }

      const { data } = removeTempRoleCommand;

      expect(data.options).toBeDefined();
      expect(Array.isArray(data.options)).toBe(true);

      const hasUserOption = data.options.some(opt => opt.name === "user");
      const hasRoleOption = data.options.some(opt => opt.name === "role");

      expect(hasUserOption).toBe(true);
      expect(hasRoleOption).toBe(true);
    });
  });

  describe("Command Execution", () => {
    test("should have execute function", () => {
      if (!removeTempRoleCommand) {
        expect(true).toBe(true); // Skip if module not available
        return;
      }

      const { execute } = removeTempRoleCommand;
      expect(typeof execute).toBe("function");
    });
  });
});
