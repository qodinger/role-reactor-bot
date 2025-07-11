// Simple test to check ESM compatibility
describe("Simple ESM Test", () => {
  it("should work with ESM", () => {
    expect(true).toBe(true);
  });

  it("should have access to global utilities", () => {
    expect(typeof createMockInteraction).toBe("function");
    expect(typeof createMockClient).toBe("function");
  });
});
