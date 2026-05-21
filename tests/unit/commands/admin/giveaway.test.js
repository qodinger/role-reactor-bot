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

vi.mock("src/utils/commandUtils.js", () => ({
  getMentionableCommand: vi.fn().mockReturnValue("`/giveaway`"),
}));

vi.mock("src/features/premium/config.js", () => ({
  FREE_TIER: { maxGiveaways: 3, maxWinners: 5 },
  PRO_TIER: { maxGiveaways: 25, maxWinners: 25 },
  CORE_STATUS: { ACTIVE: "active" },
}));

const mockGiveawayUtils = vi.hoisted(() => ({
  parseDuration: vi.fn().mockReturnValue(3600000),
  validateGiveawayCreation: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  sanitizeText: vi.fn(text => text),
}));

vi.mock("src/utils/giveaway/utils.js", () => mockGiveawayUtils);

vi.mock("src/commands/admin/giveaway/embeds.js", () => ({
  createGiveawayEmbed: vi.fn().mockReturnValue({ data: { title: "🎉 Giveaway!" } }),
  createConfirmationEmbed: vi.fn().mockReturnValue({ data: { title: "Confirmation" } }),
  createGiveawayListEmbed: vi.fn().mockReturnValue({ data: { title: "Giveaway List" } }),
}));

vi.mock("src/commands/admin/giveaway/components.js", () => ({
  createActiveGiveawayActions: vi.fn().mockReturnValue({ components: [] }),
  createListPaginationButtons: vi.fn().mockReturnValue(null),
}));

const mockGiveawayManager = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({
    id: "giveaway123",
    prize: "Test Prize",
    endTime: new Date(Date.now() + 3600000),
  }),
  end: vi.fn().mockResolvedValue({ winners: [] }),
  cancel: vi.fn().mockResolvedValue(true),
  getActiveForGuild: vi.fn().mockResolvedValue([]),
  getAllForGuild: vi.fn().mockResolvedValue([]),
  isPro: vi.fn().mockResolvedValue(false),
}));

vi.mock("src/features/giveaway/GiveawayManager.js", () => ({
  default: mockGiveawayManager,
}));

import {
  handleCreate,
  handleList,
} from "../../../../src/commands/admin/giveaway/handlers.js";

describe("Giveaway Command", () => {
  let mockInteraction;
  let mockClient;
  let mockChannel;

  beforeEach(() => {
    vi.clearAllMocks();

    mockChannel = {
      id: "channel123",
      name: "giveaways",
      type: 0,
      nsfw: false,
      send: vi.fn().mockResolvedValue({ id: "message123" }),
      permissionsFor: vi.fn().mockReturnValue({ has: vi.fn().mockReturnValue(true) }),
    };

    mockClient = createMockClient({
      user: {
        id: "bot123",
        tag: "TestBot#1234",
        username: "TestBot",
        displayAvatarURL: vi.fn().mockReturnValue("https://example.com/bot.png"),
      },
    });

    mockInteraction = createMockInteraction({
      client: mockClient,
      guildId: "guild123",
      guild: {
        id: "guild123",
        name: "Test Guild",
        iconURL: vi.fn().mockReturnValue("https://example.com/icon.png"),
        members: { cache: { get: vi.fn() }, me: { permissions: { has: vi.fn().mockReturnValue(true) } } },
        channels: { cache: { get: vi.fn() } },
      },
      member: {
        permissions: { has: vi.fn().mockReturnValue(true) },
      },
      channel: mockChannel,
      options: {
        getString: vi.fn((name) => {
          const values = {
            prize: "Test Prize",
            duration: "1h",
            description: null,
          };
          return values[name] ?? null;
        }),
        getInteger: vi.fn((name) => {
          const values = { winners: 1 };
          return values[name] ?? null;
        }),
        getBoolean: vi.fn().mockReturnValue(null),
        getUser: vi.fn().mockReturnValue(null),
        getRole: vi.fn().mockReturnValue(null),
        getChannel: vi.fn().mockReturnValue(null),
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
    });
  });

  describe("handleCreate", () => {
    it("should defer reply before processing", async () => {
      await handleCreate(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
    });

    it("should handle missing bot permissions on target channel", async () => {
      mockChannel.permissionsFor.mockReturnValue({
        has: vi.fn().mockReturnValue(false),
      });

      await handleCreate(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockGiveawayManager.create.mockRejectedValue(new Error("DB error"));

      await expect(handleCreate(mockInteraction)).resolves.not.toThrow();
    });
  });

  describe("handleList", () => {
    it("should reply with giveaway list when giveaways exist", async () => {
      mockGiveawayManager.getAllForGuild.mockResolvedValue([
        {
          id: "g1",
          prize: "Prize 1",
          endTime: new Date(),
          winnersCount: 1,
          isActive: true,
          participants: [],
        },
      ]);

      await handleList(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should reply when no giveaways exist", async () => {
      mockGiveawayManager.getAllForGuild.mockResolvedValue([]);
      mockGiveawayManager.getActiveForGuild.mockResolvedValue([]);

      await handleList(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });
});
