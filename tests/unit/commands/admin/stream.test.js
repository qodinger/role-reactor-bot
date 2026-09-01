import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildAlertTestEmbed } from "../../../../src/commands/admin/stream/embeds.js";
import {
  getGuildTwitchConnection,
  getBuiltInTwitchCommand,
  prefixForConnection,
} from "../../../../src/commands/admin/stream/utils.js";
import {
  handleConnect,
  handleBotConnect,
  handleDisconnect,
  handleConfig,
  handleStatus,
  handleAlertTest,
  handleCommandAdd,
  handleCommandRemove,
  handleCommandList,
  handleCommandEdit,
  handleFilterToggle,
  handleFilterConfig,
  handleFilterStatus,
  handleQuoteAdd,
  handleQuoteRemove,
  handleQuoteList,
  handleTimerAdd,
  handleTimerRemove,
  handleTimerList,
  handleDiag,
} from "../../../../src/commands/admin/stream/handlers.js";

// Mock dependencies
vi.mock("../../../../src/config/config.js", () => ({
  config: {
    twitch: {
      enabled: true,
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
    },
  },
}));

vi.mock("../../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("Stream Command Embeds", () => {
  describe("buildAlertTestEmbed", () => {
    it("builds goLive embed", () => {
      const embed = buildAlertTestEmbed("goLive");
      expect(embed).not.toBeNull();
      expect(embed.data.title).toContain("Now Streaming");
    });

    it("builds follow embed", () => {
      const embed = buildAlertTestEmbed("follow");
      expect(embed).not.toBeNull();
      expect(embed.data.title).toContain("New Follower");
    });

    it("builds subscribe embed", () => {
      const embed = buildAlertTestEmbed("subscribe");
      expect(embed).not.toBeNull();
      expect(embed.data.title).toContain("New Subscriber");
    });

    it("builds giftSub embed", () => {
      const embed = buildAlertTestEmbed("giftSub");
      expect(embed).not.toBeNull();
      expect(embed.data.title).toContain("Gift Sub");
    });

    it("builds raid embed", () => {
      const embed = buildAlertTestEmbed("raid");
      expect(embed).not.toBeNull();
      expect(embed.data.title).toContain("Raid");
    });

    it("builds resub embed", () => {
      const embed = buildAlertTestEmbed("resub");
      expect(embed).not.toBeNull();
      expect(embed.data.title).toContain("Resub");
    });

    it("returns null for unknown type", () => {
      const embed = buildAlertTestEmbed("unknown");
      expect(embed).toBeNull();
    });
  });
});

describe("Stream Command Handlers", () => {
  describe("getGuildTwitchConnection", () => {
    it("is exported as a function", () => {
      expect(typeof getGuildTwitchConnection).toBe("function");
    });
  });

  describe("getBuiltInTwitchCommand", () => {
    it("finds built-in commands", () => {
      const cmd = getBuiltInTwitchCommand("bot");
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe("bot");
    });

    it("returns undefined for unknown commands", () => {
      const cmd = getBuiltInTwitchCommand("nonexistent");
      expect(cmd).toBeUndefined();
    });
  });

  describe("prefixForConnection", () => {
    it("returns connection prefix", () => {
      expect(prefixForConnection({ commandPrefix: "?" })).toBe("?");
    });

    it("defaults to !", () => {
      expect(prefixForConnection({})).toBe("!");
      expect(prefixForConnection({ commandPrefix: null })).toBe("!");
    });
  });

  describe("handler exports", () => {
    it("exports all handler functions", () => {
      expect(typeof handleConnect).toBe("function");
      expect(typeof handleBotConnect).toBe("function");
      expect(typeof handleDisconnect).toBe("function");
      expect(typeof handleConfig).toBe("function");
      expect(typeof handleStatus).toBe("function");
      expect(typeof handleAlertTest).toBe("function");
      expect(typeof handleCommandAdd).toBe("function");
      expect(typeof handleCommandRemove).toBe("function");
      expect(typeof handleCommandList).toBe("function");
      expect(typeof handleCommandEdit).toBe("function");
      expect(typeof handleFilterToggle).toBe("function");
      expect(typeof handleFilterConfig).toBe("function");
      expect(typeof handleFilterStatus).toBe("function");
      expect(typeof handleQuoteAdd).toBe("function");
      expect(typeof handleQuoteRemove).toBe("function");
      expect(typeof handleQuoteList).toBe("function");
      expect(typeof handleTimerAdd).toBe("function");
      expect(typeof handleTimerRemove).toBe("function");
      expect(typeof handleTimerList).toBe("function");
      expect(typeof handleDiag).toBe("function");
    });
  });
});
