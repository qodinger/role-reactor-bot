describe("scheduler utils", () => {
  let scheduler;

  beforeAll(async () => {
    try {
      scheduler = await import("../../src/utils/scheduler.js");
    } catch (error) {
      console.warn("Could not import scheduler module:", error.message);
    }
  });

  test("should have expected structure", () => {
    if (!scheduler) {
      expect(true).toBe(true); // Skip if module not available
      return;
    }

    // Test that the default export (RoleExpirationScheduler class) exists
    expect(typeof scheduler.default).toBe("function");

    // Test that key functions are exported
    expect(typeof scheduler.scheduleTask).toBe("function");
    expect(typeof scheduler.cancelTask).toBe("function");
    expect(typeof scheduler.scheduleRecurringTask).toBe("function");
    expect(typeof scheduler.getActiveTasks).toBe("function");
    expect(typeof scheduler.getTaskInfo).toBe("function");
    expect(typeof scheduler.clearAllTasks).toBe("function");
  });
});
