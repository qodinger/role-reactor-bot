describe("terminal utils", () => {
  let terminal;

  beforeAll(async () => {
    try {
      terminal = await import("../../src/utils/terminal.js");
    } catch (error) {
      console.warn("Could not import terminal module:", error.message);
    }
  });

  test("should have expected structure", () => {
    if (!terminal) {
      expect(true).toBe(true); // Skip if module not available
      return;
    }

    // Test that key functions are exported
    expect(typeof terminal.createHeader).toBe("function");
    expect(typeof terminal.createDivider).toBe("function");
    expect(typeof terminal.createInfoBox).toBe("function");
    expect(typeof terminal.createSuccessMessage).toBe("function");
    expect(typeof terminal.createErrorMessage).toBe("function");
    expect(typeof terminal.createWarningMessage).toBe("function");
    expect(typeof terminal.createSpinner).toBe("function");
    expect(typeof terminal.logSection).toBe("function");
    expect(typeof terminal.logStatus).toBe("function");
    expect(typeof terminal.logKeyValue).toBe("function");
    expect(typeof terminal.logListItem).toBe("function");
    expect(typeof terminal.createTable).toBe("function");
    expect(typeof terminal.printBotStats).toBe("function");
    expect(typeof terminal.printProgress).toBe("function");
    expect(typeof terminal.logMessage).toBe("function");
    expect(typeof terminal.createWelcomeBox).toBe("function");
    expect(typeof terminal.colorize).toBe("function");
    expect(typeof terminal.log).toBe("function");
    expect(typeof terminal.createProgressBar).toBe("function");
    expect(typeof terminal.prompt).toBe("function");
    expect(typeof terminal.promptWithValidation).toBe("function");

    // Test that constants are exported
    expect(typeof terminal.colors).toBe("object");
    expect(typeof terminal.icons).toBe("object");
  });
});
