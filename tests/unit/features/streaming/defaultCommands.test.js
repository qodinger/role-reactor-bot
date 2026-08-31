import { describe, it, expect } from "vitest";
import { GLOBAL_DEFAULT_TWITCH_COMMANDS } from "../../../../src/features/streaming/utils/defaultCommands.js";

describe("Default Twitch Commands", () => {
  describe("command definitions", () => {
    it("defines all required commands", () => {
      const names = GLOBAL_DEFAULT_TWITCH_COMMANDS.map((c) => c.name);
      expect(names).toContain("bot");
      expect(names).toContain("commands");
      expect(names).toContain("uptime");
      expect(names).toContain("title");
      expect(names).toContain("game");
      expect(names).toContain("quote");
      expect(names).toContain("so");
      expect(names).toContain("poll");
      expect(names).toContain("timeout");
      expect(names).toContain("untimeout");
      expect(names).toContain("ban");
    });

    it("has response or null for special commands", () => {
      for (const cmd of GLOBAL_DEFAULT_TWITCH_COMMANDS) {
        if (["quote", "so", "poll", "timeout", "untimeout", "ban"].includes(cmd.name)) {
          expect(cmd.response).toBeNull();
        } else {
          expect(typeof cmd.response).toBe("string");
        }
      }
    });

    it("has userlevel for all commands", () => {
      for (const cmd of GLOBAL_DEFAULT_TWITCH_COMMANDS) {
        expect(cmd.userlevel).toBeDefined();
        expect(["everyone", "subscriber", "vip", "moderator", "owner"]).toContain(cmd.userlevel);
      }
    });

    it("has description for all commands", () => {
      for (const cmd of GLOBAL_DEFAULT_TWITCH_COMMANDS) {
        expect(cmd.description).toBeDefined();
        expect(typeof cmd.description).toBe("string");
        expect(cmd.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe("moderator-only commands", () => {
    it("requires moderator for !so", () => {
      const cmd = GLOBAL_DEFAULT_TWITCH_COMMANDS.find((c) => c.name === "so");
      expect(cmd.userlevel).toBe("moderator");
    });

    it("requires moderator for !poll", () => {
      const cmd = GLOBAL_DEFAULT_TWITCH_COMMANDS.find((c) => c.name === "poll");
      expect(cmd.userlevel).toBe("moderator");
    });

    it("requires moderator for !timeout", () => {
      const cmd = GLOBAL_DEFAULT_TWITCH_COMMANDS.find((c) => c.name === "timeout");
      expect(cmd.userlevel).toBe("moderator");
    });

    it("requires moderator for !untimeout", () => {
      const cmd = GLOBAL_DEFAULT_TWITCH_COMMANDS.find((c) => c.name === "untimeout");
      expect(cmd.userlevel).toBe("moderator");
    });

    it("requires moderator for !ban", () => {
      const cmd = GLOBAL_DEFAULT_TWITCH_COMMANDS.find((c) => c.name === "ban");
      expect(cmd.userlevel).toBe("moderator");
    });
  });

  describe("variable expansion commands", () => {
    it("title command uses {title} variable", () => {
      const cmd = GLOBAL_DEFAULT_TWITCH_COMMANDS.find((c) => c.name === "title");
      expect(cmd.response).toContain("{title}");
    });

    it("game command uses {game} variable", () => {
      const cmd = GLOBAL_DEFAULT_TWITCH_COMMANDS.find((c) => c.name === "game");
      expect(cmd.response).toContain("{game}");
    });

    it("uptime command uses {uptime} variable", () => {
      const cmd = GLOBAL_DEFAULT_TWITCH_COMMANDS.find((c) => c.name === "uptime");
      expect(cmd.response).toContain("{uptime}");
    });

    it("commands command uses {commands} variable", () => {
      const cmd = GLOBAL_DEFAULT_TWITCH_COMMANDS.find((c) => c.name === "commands");
      expect(cmd.response).toContain("{commands}");
    });
  });
});
