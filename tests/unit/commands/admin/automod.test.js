import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

setupCommonMocks();

vi.mock("src/config/theme.js", () => ({
  THEME: { PRIMARY: 0x5865f2, ERROR: 0xed4245, SUCCESS: 0x57f287 },
}));

vi.mock("src/utils/discord/responseMessages.js", () => ({
  successEmbed: vi.fn(opts => ({ ...opts })),
  errorEmbed: vi.fn(opts => ({ ...opts })),
}));

vi.mock("src/utils/commandUtils.js", () => ({
  getMentionableCommand: vi.fn().mockReturnValue("`/automod`"),
}));

const mockAutomodCollection = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue({
    automod: mockAutomodCollection,
  }),
}));

vi.mock("src/features/premium/PremiumManager.js", () => ({
  getPremiumManager: vi.fn().mockReturnValue({
    isFeatureActive: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock("src/commands/admin/automod/embeds.js", () => ({
  createAutomodSettingsEmbed: vi.fn().mockReturnValue({
    data: { title: "AutoMod Settings" },
  }),
}));

vi.mock("src/commands/admin/automod/components.js", () => ({
  createAutomodSettingsComponents: vi.fn().mockReturnValue([]),
}));

import {
  handleEnable,
  handleDisable,
  handleSettings,
} from "../../../../src/commands/admin/automod/handlers.js";

const defaultSettings = {
  badWords: { enabled: false, words: [] },
  links: { enabled: false },
  spam: { enabled: false },
  mentionSpam: { enabled: false },
  inviteLink: { enabled: false },
};

describe("Automod Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAutomodCollection.set.mockResolvedValue(undefined);

    mockInteraction = createMockInteraction({
      guildId: "guild123",
      guild: {
        id: "guild123",
        name: "Test Guild",
        iconURL: vi.fn().mockReturnValue("https://example.com/icon.png"),
        members: { cache: { get: vi.fn() }, me: { permissions: { has: vi.fn().mockReturnValue(true) } } },
        channels: { cache: { get: vi.fn() } },
      },
      options: {
        getBoolean: vi.fn().mockReturnValue(true),
        getString: vi.fn().mockReturnValue(null),
        getInteger: vi.fn().mockReturnValue(null),
        getUser: vi.fn().mockReturnValue(null),
        getRole: vi.fn().mockReturnValue(null),
        getChannel: vi.fn().mockReturnValue(null),
      },
      reply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    });

    mockClient = createMockClient();
  });

  describe("handleEnable", () => {
    it("should reply with success after enabling all filters", async () => {
      await handleEnable(mockInteraction, defaultSettings);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    it("should not throw when called with valid settings", async () => {
      await expect(
        handleEnable(mockInteraction, defaultSettings),
      ).resolves.not.toThrow();
    });
  });

  describe("handleDisable", () => {
    it("should reply with success after disabling all filters", async () => {
      const enabledSettings = {
        badWords: { enabled: true, words: [] },
        links: { enabled: true },
        spam: { enabled: true },
        mentionSpam: { enabled: true },
        inviteLink: { enabled: true },
      };

      await handleDisable(mockInteraction, enabledSettings);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    it("should not throw when called with valid settings", async () => {
      await expect(
        handleDisable(mockInteraction, defaultSettings),
      ).resolves.not.toThrow();
    });
  });

  describe("handleSettings", () => {
    it("should reply with settings embed and components", async () => {
      await handleSettings(mockInteraction, defaultSettings);

      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyArg = mockInteraction.reply.mock.calls[0][0];
      expect(replyArg.embeds).toBeDefined();
      expect(replyArg.components).toBeDefined();
    });
  });
});
