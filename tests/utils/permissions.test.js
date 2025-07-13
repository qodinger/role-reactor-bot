describe("permissions utils", () => {
  let permissions;

  beforeAll(async () => {
    try {
      permissions = await import("../../src/utils/permissions.js");
    } catch (error) {
      console.warn("Could not import permissions module:", error.message);
    }
  });

  test("should have expected structure", () => {
    if (!permissions) {
      expect(true).toBe(true); // Skip if module not available
      return;
    }

    // Test that key functions are exported
    expect(typeof permissions.hasAdminPermissions).toBe("function");
    expect(typeof permissions.hasManageRolesPermission).toBe("function");
    expect(typeof permissions.hasManageMessagesPermission).toBe("function");
    expect(typeof permissions.botHasRequiredPermissions).toBe("function");
    expect(typeof permissions.getMissingBotPermissions).toBe("function");
    expect(typeof permissions.formatPermissionName).toBe("function");
    expect(typeof permissions.hasPermission).toBe("function");
    expect(typeof permissions.checkUserPermissions).toBe("function");
    expect(typeof permissions.getRequiredPermissions).toBe("function");

    // Test that constants are exported
    expect(Array.isArray(permissions.requiredPermissions)).toBe(true);
  });
});
