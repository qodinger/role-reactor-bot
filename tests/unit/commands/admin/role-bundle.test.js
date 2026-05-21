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
  getMentionableCommand: vi.fn().mockReturnValue("`/role-bundle`"),
}));

vi.mock("src/features/premium/config.js", () => ({
  PremiumFeatures: { ROLE_BUNDLES: "role_bundles" },
  FREE_TIER: { maxRoleBundles: 3 },
  PRO_TIER: { maxRoleBundles: 25 },
}));

vi.mock("src/features/premium/PremiumManager.js", () => ({
  getPremiumManager: vi.fn().mockReturnValue({
    isFeatureActive: vi.fn().mockResolvedValue(false),
    getFeatureLimit: vi.fn().mockResolvedValue(3),
  }),
}));

const mockRoleBundleManager = {
  validateName: vi.fn().mockReturnValue({ valid: true }),
  exists: vi.fn().mockResolvedValue(false),
  create: vi.fn().mockResolvedValue({
    name: "Test Bundle",
    roles: ["role1", "role2"],
    guildId: "guild123",
  }),
  getAllForGuild: vi.fn().mockResolvedValue([]),
  delete: vi.fn().mockResolvedValue(true),
  get: vi.fn().mockResolvedValue(null),
  count: vi.fn().mockResolvedValue(0),
};

vi.mock("src/features/rolebundles/RoleBundleManager.js", () => ({
  default: mockRoleBundleManager,
}));

import {
  handleCreate,
  handleList,
} from "../../../../src/commands/admin/role-bundle/handlers.js";

describe("Role Bundle Command", () => {
  let mockInteraction;
  let mockClient;
  let mockRole;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRole = { id: "role1", name: "Member", toString: () => "<@&role1>" };

    mockClient = createMockClient();

    mockInteraction = createMockInteraction({
      client: mockClient,
      guildId: "guild123",
      guild: {
        id: "guild123",
        name: "Test Guild",
        iconURL: vi.fn().mockReturnValue("https://example.com/icon.png"),
        roles: {
          cache: new Map([["role1", mockRole]]),
        },
        members: { cache: { get: vi.fn() }, me: { permissions: { has: vi.fn().mockReturnValue(true) } } },
        channels: { cache: { get: vi.fn() } },
      },
      member: {
        permissions: { has: vi.fn().mockReturnValue(true) },
      },
      options: {
        getString: vi.fn((name) => {
          const values = {
            name: "Test Bundle",
            roles: "<@&role1>",
          };
          return values[name] ?? null;
        }),
        getInteger: vi.fn().mockReturnValue(null),
        getBoolean: vi.fn().mockReturnValue(null),
        getUser: vi.fn().mockReturnValue(null),
        getRole: vi.fn().mockReturnValue(mockRole),
        getChannel: vi.fn().mockReturnValue(null),
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
    });
  });

  describe("handleCreate", () => {
    it("should deny when user lacks Manage Guild permission", async () => {
      mockInteraction.member.permissions.has.mockReturnValue(false);

      await handleCreate(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should reply with error when bundle name is invalid", async () => {
      mockRoleBundleManager.validateName.mockReturnValue({
        valid: false,
        error: "Name too long",
      });

      await handleCreate(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should reply with error when bundle already exists", async () => {
      mockRoleBundleManager.exists.mockResolvedValue(true);

      await handleCreate(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockRoleBundleManager.create.mockRejectedValue(new Error("DB error"));

      await expect(handleCreate(mockInteraction)).resolves.not.toThrow();
    });
  });

  describe("handleList", () => {
    it("should reply with bundle list when bundles exist", async () => {
      mockRoleBundleManager.getAllForGuild.mockResolvedValue([
        { name: "VIP Pack", roles: ["role1"], guildId: "guild123" },
      ]);

      await handleList(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should reply when no bundles exist", async () => {
      mockRoleBundleManager.getAllForGuild.mockResolvedValue([]);

      await handleList(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockRoleBundleManager.getAllForGuild.mockRejectedValue(new Error("DB error"));

      await expect(handleList(mockInteraction)).resolves.not.toThrow();
    });
  });
});
