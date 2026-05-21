import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

setupCommonMocks();

vi.mock("src/config/theme.js", () => ({
  THEME: { PRIMARY: 0x5865f2 },
}));

const mockCollection = {
  countDocuments: vi.fn().mockResolvedValue(42),
  find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
};

vi.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue({
    commandUsage: mockCollection,
    automod: mockCollection,
    welcomeSettings: mockCollection,
    temporaryRoles: mockCollection,
    giveaways: mockCollection,
  }),
}));

import { execute } from "../../../../src/commands/general/stats/index.js";

describe("Stats Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCollection.countDocuments.mockResolvedValue(42);
    mockCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    });

    const mockGuild = {
      memberCount: 100,
    };

    mockClient = createMockClient({
      guilds: { cache: new Map([["guild1", mockGuild]]) },
      user: {
        displayAvatarURL: vi.fn().mockReturnValue("https://example.com/bot.png"),
      },
    });

    mockInteraction = createMockInteraction({
      client: mockClient,
      reply: vi.fn().mockResolvedValue(undefined),
    });
  });

  describe("execute", () => {
    it("should reply with stats embed", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyArg = mockInteraction.reply.mock.calls[0][0];
      expect(replyArg.embeds).toBeDefined();
    });

    it("should reply ephemerally", async () => {
      await execute(mockInteraction);

      const replyArg = mockInteraction.reply.mock.calls[0][0];
      expect(replyArg.ephemeral).toBe(true);
    });

    it("should handle database errors gracefully", async () => {
      mockCollection.countDocuments.mockRejectedValue(new Error("DB error"));

      await expect(execute(mockInteraction)).resolves.not.toThrow();
      expect(mockInteraction.reply).toHaveBeenCalled();
    });
  });
});
