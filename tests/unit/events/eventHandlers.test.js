/**
 * Tests for Event Handlers - Exports and Structure
 * Verifies event handlers export correctly and have proper structure
 */

import { describe, it, expect } from "vitest";

describe("Event Handlers - Exports", () => {
  describe("guildMemberAdd (Welcome)", () => {
    it("should export name", async () => {
      const event = await import("../../../src/events/guildMemberAdd.js");
      expect(event.name).toBe("guildMemberAdd");
    });

    it("should export execute function", async () => {
      const event = await import("../../../src/events/guildMemberAdd.js");
      expect(event.execute).toBeDefined();
      expect(typeof event.execute).toBe("function");
    });

    it("should not export once (continuous event)", async () => {
      const event = await import("../../../src/events/guildMemberAdd.js");
      expect(event.once).toBeFalsy();
    });
  });

  describe("guildMemberRemove (Goodbye)", () => {
    it("should export name", async () => {
      const event = await import("../../../src/events/guildMemberRemove.js");
      expect(event.name).toBe("guildMemberRemove");
    });

    it("should export execute function", async () => {
      const event = await import("../../../src/events/guildMemberRemove.js");
      expect(event.execute).toBeDefined();
      expect(typeof event.execute).toBe("function");
    });

    it("should not export once (continuous event)", async () => {
      const event = await import("../../../src/events/guildMemberRemove.js");
      expect(event.once).toBeFalsy();
    });
  });

  describe("messageReactionAdd (Role Reactions)", () => {
    it("should export name", async () => {
      const event = await import("../../../src/events/messageReactionAdd.js");
      expect(event.name).toBe("messageReactionAdd");
    });

    it("should export execute function", async () => {
      const event = await import("../../../src/events/messageReactionAdd.js");
      expect(event.execute).toBeDefined();
      expect(typeof event.execute).toBe("function");
    });

    it("should not export once (continuous event)", async () => {
      const event = await import("../../../src/events/messageReactionAdd.js");
      expect(event.once).toBeFalsy();
    });
  });

  describe("messageReactionRemove (Role Reactions)", () => {
    it("should export name", async () => {
      const event = await import("../../../src/events/messageReactionRemove.js");
      expect(event.name).toBe("messageReactionRemove");
    });

    it("should export execute function", async () => {
      const event = await import("../../../src/events/messageReactionRemove.js");
      expect(event.execute).toBeDefined();
      expect(typeof event.execute).toBe("function");
    });

    it("should not export once (continuous event)", async () => {
      const event = await import("../../../src/events/messageReactionRemove.js");
      expect(event.once).toBeFalsy();
    });
  });

  describe("interactionCreate (Command Handler)", () => {
    it("should export name", async () => {
      const event = await import("../../../src/events/interactionCreate.js");
      expect(event.name).toBe("interactionCreate");
    });

    it("should export execute function", async () => {
      const event = await import("../../../src/events/interactionCreate.js");
      expect(event.execute).toBeDefined();
      expect(typeof event.execute).toBe("function");
    });
  });

  describe("voiceStateUpdate (Voice XP)", () => {
    it("should export name", async () => {
      const event = await import("../../../src/events/voiceStateUpdate.js");
      expect(event.name).toBe("voiceStateUpdate");
    });

    it("should export execute function", async () => {
      const event = await import("../../../src/events/voiceStateUpdate.js");
      expect(event.execute).toBeDefined();
      expect(typeof event.execute).toBe("function");
    });
  });

  describe("guildMemberUpdate (Role Changes)", () => {
    it("should export name", async () => {
      const event = await import("../../../src/events/guildMemberUpdate.js");
      expect(event.name).toBe("guildMemberUpdate");
    });

    it("should export execute function", async () => {
      const event = await import("../../../src/events/guildMemberUpdate.js");
      expect(event.execute).toBeDefined();
      expect(typeof event.execute).toBe("function");
    });
  });
});

describe("Event Handlers - File Structure", () => {
  it("should have all required event files", async () => {
    const events = [
      "guildMemberAdd",
      "guildMemberRemove",
      "guildMemberUpdate",
      "interactionCreate",
      "messageReactionAdd",
      "messageReactionRemove",
      "voiceStateUpdate",
      "messageCreate",
      "ready",
    ];

    for (const eventName of events) {
      const event = await import(`../../../src/events/${eventName}.js`);
      expect(event.name).toBeDefined();
      expect(event.execute).toBeDefined();
    }
  });
});
