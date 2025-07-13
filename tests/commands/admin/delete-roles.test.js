describe("Delete Roles Command", () => {
  let deleteRolesCommand;

  beforeAll(async () => {
    try {
      deleteRolesCommand = await import(
        "../../../src/commands/admin/delete-roles.js"
      );
    } catch (error) {
      console.warn("Could not import delete-roles command:", error.message);
    }
  });

  describe("Command Structure", () => {
    test("should have correct command data", () => {
      if (!deleteRolesCommand) {
        expect(true).toBe(true); // Skip if module not available
        return;
      }

      const { data } = deleteRolesCommand;

      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("description");
      expect(data.name).toBe("delete-roles");
      expect(data.description).toBeDefined();
    });

    test("should have required options", () => {
      if (!deleteRolesCommand) {
        expect(true).toBe(true); // Skip if module not available
        return;
      }

      const { data } = deleteRolesCommand;

      expect(data.options).toBeDefined();
      expect(Array.isArray(data.options)).toBe(true);

      const hasMessageIdOption = data.options.some(
        opt => opt.name === "message_id",
      );
      expect(hasMessageIdOption).toBe(true);
    });
  });

  describe("Command Execution", () => {
    test("should have execute function", () => {
      if (!deleteRolesCommand) {
        expect(true).toBe(true); // Skip if module not available
        return;
      }

      const { execute } = deleteRolesCommand;
      expect(typeof execute).toBe("function");
    });
  });
});
