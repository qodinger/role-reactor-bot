import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

setupCommonMocks();

vi.mock("src/config/theme.js", () => ({
  THEME: { PRIMARY: 0x5865f2, PRO: 0xffd700 },
}));

vi.mock("src/commands/general/premium/premiumData.js", () => ({
  PREMIUM_FEATURES: [
    {
      name: "AI Image Generation",
      emoji: "🎨",
      free: "5 per day",
      pro: "Unlimited",
    },
    {
      name: "Role Reactions",
      emoji: "🎭",
      free: "3 per server",
      pro: "Unlimited",
    },
  ],
}));

import { execute } from "../../../../src/commands/general/premium/index.js";

describe("Premium Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = createMockInteraction({
      reply: vi.fn().mockResolvedValue(undefined),
    });

    mockClient = createMockClient();
  });

  describe("execute", () => {
    it("should reply with premium features embed", async () => {
      await execute(mockInteraction, mockClient);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    it("should include embeds in the reply", async () => {
      await execute(mockInteraction, mockClient);

      const replyArg = mockInteraction.reply.mock.calls[0][0];
      expect(replyArg.embeds).toBeDefined();
      expect(replyArg.embeds.length).toBeGreaterThan(0);
    });
  });
});
