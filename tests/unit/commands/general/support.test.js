import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

setupCommonMocks();

vi.mock("src/commands/general/support/embeds.js", () => ({
  createSupportEmbed: vi.fn().mockReturnValue({ data: { title: "Support" } }),
  createErrorEmbed: vi.fn().mockReturnValue({ data: { title: "Error" } }),
}));

vi.mock("src/commands/general/support/components.js", () => ({
  createSupportButtons: vi.fn().mockResolvedValue({
    components: [],
  }),
}));

import { execute } from "../../../../src/commands/general/support/handlers.js";

describe("Support Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = createMockInteraction({
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    });

    mockClient = createMockClient();
  });

  describe("execute", () => {
    it("should defer reply ephemerally and send support embed", async () => {
      await execute(mockInteraction, mockClient);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();

      const replyArg = mockInteraction.editReply.mock.calls[0][0];
      expect(replyArg.embeds).toBeDefined();
    });

    it("should handle errors gracefully", async () => {
      mockInteraction.deferReply.mockRejectedValue(new Error("Network error"));

      await expect(
        execute(mockInteraction, mockClient),
      ).resolves.not.toThrow();
    });
  });
});
