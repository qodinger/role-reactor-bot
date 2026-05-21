import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

setupCommonMocks();

vi.mock("src/config/theme.js", () => ({
  THEME: { PRIMARY: 0x5865f2, ERROR: 0xed4245 },
}));

vi.mock("src/config/emojis.js", () => ({
  emojiConfig: {
    customEmojis: { core: "⚡" },
  },
}));

vi.mock("src/config/config.js", () => ({
  default: {
    externalLinks: { vote: "https://top.gg/bot/test/vote" },
  },
  config: {
    externalLinks: { vote: "https://top.gg/bot/test/vote" },
  },
}));

vi.mock("src/webhooks/topgg.js", () => ({
  getVoteStatus: vi.fn().mockResolvedValue({
    canVote: true,
    nextVote: null,
    totalVotes: 5,
  }),
}));

import { execute } from "../../../../src/commands/general/vote/index.js";

describe("Vote Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = createMockInteraction({
      options: {
        getBoolean: vi.fn().mockReturnValue(false),
        getString: vi.fn().mockReturnValue(null),
        getInteger: vi.fn().mockReturnValue(null),
        getUser: vi.fn().mockReturnValue(null),
        getRole: vi.fn().mockReturnValue(null),
        getChannel: vi.fn().mockReturnValue(null),
      },
      reply: vi.fn().mockResolvedValue(undefined),
    });

    mockClient = createMockClient();
  });

  describe("execute", () => {
    it("should reply with vote embed and button", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyArg = mockInteraction.reply.mock.calls[0][0];
      expect(replyArg.embeds).toBeDefined();
      expect(replyArg.components).toBeDefined();
    });

    it("should reply ephemerally by default", async () => {
      await execute(mockInteraction);

      const replyArg = mockInteraction.reply.mock.calls[0][0];
      expect(replyArg.ephemeral).toBe(true);
    });

    it("should reply publicly when public option is true", async () => {
      mockInteraction.options.getBoolean.mockReturnValue(true);

      await execute(mockInteraction);

      const replyArg = mockInteraction.reply.mock.calls[0][0];
      expect(replyArg.ephemeral).toBe(false);
    });

    it("should show cooldown status when user cannot vote yet", async () => {
      const { getVoteStatus } = await import("src/webhooks/topgg.js");
      getVoteStatus.mockResolvedValue({
        canVote: false,
        nextVote: new Date(Date.now() + 3600000),
        totalVotes: 10,
      });

      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const { getVoteStatus } = await import("src/webhooks/topgg.js");
      getVoteStatus.mockRejectedValue(new Error("API error"));

      await expect(execute(mockInteraction)).resolves.not.toThrow();
    });
  });
});
