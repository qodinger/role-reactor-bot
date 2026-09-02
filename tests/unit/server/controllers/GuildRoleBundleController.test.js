import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const mocks = vi.hoisted(() => ({
  mockRoleBundleManager: {
    init: vi.fn().mockResolvedValue(undefined),
    getAllForGuild: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(false),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({
      _id: "bundle1",
      name: "Test",
      roles: [],
      guildId: "guild123",
    }),
    deleteByName: vi.fn().mockResolvedValue({ success: true }),
  },
  mockPremiumManager: {
    isFeatureActive: vi.fn().mockResolvedValue(false),
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

vi.mock("../../../../src/features/rolebundles/RoleBundleManager.js", () => ({
  default: mocks.mockRoleBundleManager,
}));

vi.mock("../../../../src/features/premium/config.js", () => ({
  FREE_TIER: {
    ROLE_BUNDLE_MAX_ACTIVE: 5,
    ROLE_BUNDLE_MAX_ROLES: 5,
  },
  PRO_TIER: {
    ROLE_BUNDLE_MAX_ACTIVE: 20,
    ROLE_BUNDLE_MAX_ROLES: 20,
  },
}));

vi.mock("../../../../src/features/premium/PremiumManager.js", () => ({
  getPremiumManager: () => mocks.mockPremiumManager,
}));

// Import the controller after mocks are set up
const {
  apiGetGuildRoleBundles,
  apiCreateRoleBundle,
  apiDeleteRoleBundle,
} = await import("../../../../src/server/controllers/GuildRoleBundleController.js");

describe("GuildRoleBundleController", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: { guildId: "guild123" },
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

  describe("apiGetGuildRoleBundles", () => {
    it("should return bundles successfully", async () => {
      const bundles = [
        { _id: "1", name: "Bundle 1", roles: [] },
        { _id: "2", name: "Bundle 2", roles: [] },
      ];
      mocks.mockRoleBundleManager.getAllForGuild.mockResolvedValue(bundles);

      await apiGetGuildRoleBundles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        bundles,
        total: 2,
      });
    });

    it("should return empty array when no bundles exist", async () => {
      mocks.mockRoleBundleManager.getAllForGuild.mockResolvedValue([]);

      await apiGetGuildRoleBundles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        bundles: [],
        total: 0,
      });
    });

    it("should return 400 when guildId is missing", async () => {
      req.params = {};

      await apiGetGuildRoleBundles(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 500 on database error", async () => {
      mocks.mockRoleBundleManager.getAllForGuild.mockRejectedValue(
        new Error("DB error")
      );

      await apiGetGuildRoleBundles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("apiCreateRoleBundle", () => {
    beforeEach(() => {
      req.body = {
        name: "Test Bundle",
        roles: [
          { roleId: "role1", roleName: "Role 1" },
          { roleId: "role2", roleName: "Role 2" },
        ],
      };
    });

    it("should create bundle successfully", async () => {
      await apiCreateRoleBundle(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        bundle: expect.any(Object),
        message: "Bundle created successfully",
      });
    });

    it("should return 400 when name is missing", async () => {
      req.body = { roles: [{ roleId: "role1", roleName: "Role 1" }] };

      await apiCreateRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when roles are missing", async () => {
      req.body = { name: "Test Bundle" };

      await apiCreateRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 409 when bundle already exists", async () => {
      mocks.mockRoleBundleManager.exists.mockResolvedValue(true);

      await apiCreateRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("should return 403 when bundle limit reached (free tier)", async () => {
      mocks.mockRoleBundleManager.exists.mockResolvedValue(false);
      mocks.mockRoleBundleManager.count.mockResolvedValue(5);

      await apiCreateRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return 403 when bundle limit reached (pro tier)", async () => {
      mocks.mockRoleBundleManager.exists.mockResolvedValue(false);
      mocks.mockPremiumManager.isFeatureActive.mockResolvedValue(true);
      mocks.mockRoleBundleManager.count.mockResolvedValue(20);

      await apiCreateRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return 403 when too many roles (free tier)", async () => {
      mocks.mockRoleBundleManager.exists.mockResolvedValue(false);
      req.body.roles = Array(6).fill({ roleId: "role", roleName: "Role" });

      await apiCreateRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return 403 when too many roles (pro tier)", async () => {
      mocks.mockRoleBundleManager.exists.mockResolvedValue(false);
      mocks.mockPremiumManager.isFeatureActive.mockResolvedValue(true);
      req.body.roles = Array(21).fill({ roleId: "role", roleName: "Role" });

      await apiCreateRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return 500 on database error", async () => {
      mocks.mockRoleBundleManager.exists.mockResolvedValue(false);
      mocks.mockRoleBundleManager.count.mockResolvedValue(0);
      mocks.mockRoleBundleManager.create.mockRejectedValue(
        new Error("DB error")
      );

      await apiCreateRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("apiDeleteRoleBundle", () => {
    beforeEach(() => {
      req.params = { guildId: "guild123", bundleName: "Test Bundle" };
    });

    it("should delete bundle successfully", async () => {
      mocks.mockRoleBundleManager.exists.mockResolvedValue(true);

      await apiDeleteRoleBundle(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Bundle deleted successfully",
      });
    });

    it("should return 400 when guildId is missing", async () => {
      req.params = { bundleName: "Test Bundle" };

      await apiDeleteRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when bundleName is missing", async () => {
      req.params = { guildId: "guild123" };

      await apiDeleteRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when bundle not found", async () => {
      mocks.mockRoleBundleManager.exists.mockResolvedValue(false);

      await apiDeleteRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 500 on database error", async () => {
      mocks.mockRoleBundleManager.exists.mockResolvedValue(true);
      mocks.mockRoleBundleManager.deleteByName.mockRejectedValue(
        new Error("DB error")
      );

      await apiDeleteRoleBundle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
