import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

setupCommonMocks();

vi.mock("src/config/theme.js", () => ({
  EMOJIS: {
    STATUS: { LOADING: "⏳" },
  },
}));

vi.mock("src/commands/general/ping/embeds.js", () => ({
  createPingEmbed: vi.fn().mockReturnValue({ data: { title: "Pong!" } }),
  createErrorEmbed: vi.fn().mockReturnValue({ data: { title: "Error" } }),
}));

vi.mock("src/commands/general/ping/utils.js", () => ({
  calculateLatency: vi.fn().mockReturnValue({
    status: "good",
    statusEmoji: "🟢",
    statusColor: 0x57f287,
    statusDescription: "Excellent connection",
  }),
  formatUptime: vi.fn().mockReturnValue("1d 2h 3m"),
}));

import { execute } from "../../../../src/commands/general/ping/handlers.js";

describe("Ping Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = createMockInteraction({
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    });

    mockClient = createMockClient({
      ws: { ping: 42 },
      uptime: 90000,
    });
  });

  describe("execute", () => {
    it("should defer reply and respond with ping embed", async () => {
      await execute(mockInteraction, mockClient);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should call editReply once (single round-trip after defer)", async () => {
      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalledTimes(1);
    });

    it("should handle errors gracefully and send error embed", async () => {
      mockClient.ws = null; // causes error when accessing .ping

      await expect(execute(mockInteraction, mockClient)).resolves.not.toThrow();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });
});
