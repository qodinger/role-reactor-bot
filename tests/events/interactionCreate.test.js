describe("interactionCreate Event", () => {
  let eventHandler;

  beforeAll(async () => {
    eventHandler = await import("../../src/events/interactionCreate.js");
  });

  test("should have a name property", () => {
    expect(eventHandler).toHaveProperty("name");
    expect(typeof eventHandler.name).toBe("string");
  });

  test("should have an execute function", () => {
    expect(eventHandler).toHaveProperty("execute");
    expect(typeof eventHandler.execute).toBe("function");
  });
});
