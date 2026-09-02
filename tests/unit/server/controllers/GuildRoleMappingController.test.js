import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const mocks = vi.hoisted(() => ({
  mockStorageManager: {
    getRoleMappings: vi.fn().mockResolvedValue({}),
  },
  mockRoleMappingManager: {
    removeRoleMapping: vi.fn().mockResolvedValue(undefined),
  },
  mockGuildHelper: {
    enrichRoleMapping: vi.fn().mockResolvedValue({
      messageId: "msg123",
      channelId: "ch123",
      channelName: "general",
      embedTitle: "Test",
      embedDescription: "Description",
      embedColor: 0x5865f2,
      roles: {},
    }),
  },
}));

vi.mock("../../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../../../src/server/utils/responseHelpers.js", () => ({
  createSuccessResponse: vi.fn((data) => ({ success: true, ...data })),
  createErrorResponse: vi.fn((message, statusCode) => ({
    statusCode,
    response: { status: "error", message, timestamp: new Date().toISOString() },
  })),
}));

vi.mock("../../../../src/server/utils/apiShared.js", () => ({
  logRequest: vi.fn(),
  getDiscordClient: vi.fn().mockReturnValue(null),
}));

vi.mock("../../../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue(mocks.mockStorageManager),
}));

vi.mock("../../../../src/utils/discord/roleMappingManager.js", () => ({
  removeRoleMapping: mocks.mockRoleMappingManager.removeRoleMapping,
}));

vi.mock("../../../../src/server/helpers/GuildHelper.js", () => ({
  GuildHelper: mocks.mockGuildHelper,
}));

// Import the controller after mocks are set up
const {
  apiGetGuildRoleMappings,
  apiDeleteGuildRoleMapping,
} = await import("../../../../src/server/controllers/GuildRoleMappingController.js");

describe("GuildRoleMappingController", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: { guildId: "guild123", messageId: "msg123" },
      query: {},
      body: {},
      user: { id: "user123", username: "testuser" },
      get: vi.fn().mockReturnValue("test-agent"),
      ip: "127.0.0.1",
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe("apiGetGuildRoleMappings", () => {
    it("should return role mappings successfully", async () => {
      const mappings = {
        msg123: { guildId: "guild123", channelId: "ch123" },
        msg456: { guildId: "guild123", channelId: "ch456" },
      };
      mocks.mockStorageManager.getRoleMappings.mockResolvedValue(mappings);

      await apiGetGuildRoleMappings(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          roleMappings: expect.any(Array),
          total: expect.any(Number),
        })
      );
    });

    it("should return empty array when no mappings exist", async () => {
      mocks.mockStorageManager.getRoleMappings.mockResolvedValue({});

      await apiGetGuildRoleMappings(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          roleMappings: [],
          total: 0,
        })
      );
    });

    it("should return 400 when guildId is missing", async () => {
      req.params = {};

      await apiGetGuildRoleMappings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 500 on database error", async () => {
      mocks.mockStorageManager.getRoleMappings.mockRejectedValue(
        new Error("DB error")
      );

      await apiGetGuildRoleMappings(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("apiDeleteGuildRoleMapping", () => {
    beforeEach(() => {
      mocks.mockStorageManager.getRoleMappings.mockResolvedValue({
        msg123: { guildId: "guild123", channelId: "ch123" },
      });
    });

    it("should delete role mapping successfully", async () => {
      await apiDeleteGuildRoleMapping(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Role mapping deleted successfully",
        })
      );
    });

    it("should return 400 when guildId is missing", async () => {
      req.params = { messageId: "msg123" };

      await apiDeleteGuildRoleMapping(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when messageId is missing", async () => {
      req.params = { guildId: "guild123" };

      await apiDeleteGuildRoleMapping(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when mapping not found", async () => {
      mocks.mockStorageManager.getRoleMappings.mockResolvedValue({});

      await apiDeleteGuildRoleMapping(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 500 on database error", async () => {
      mocks.mockStorageManager.getRoleMappings.mockRejectedValue(
        new Error("DB error")
      );

      await apiDeleteGuildRoleMapping(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
