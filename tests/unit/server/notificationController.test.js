import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Dependencies ──────────────────────────────────────────────────────

vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../../src/server/utils/responseHelpers.js", () => ({
  createSuccessResponse: vi.fn((data) => ({ status: "success", data })),
  createErrorResponse: vi.fn((message, statusCode = 500) => ({
    statusCode,
    response: { status: "error", message },
  })),
}));

// ─── Mock databaseManager (per-test via mockDbManager) ───────────────────────

let mockDbManager;

vi.mock("../../../src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: () => mockDbManager,
}));

// ─── Import controllers AFTER mocks ──────────────────────────────────────────

const {
  apiGetNotifications,
  apiGetUnreadCount,
  apiMarkAsRead,
  apiMarkAllAsRead,
} = await import(
  "../../../src/server/controllers/NotificationController.js"
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockRes() {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return res;
}

function createMockNotifications() {
  return {
    getByUserId: vi.fn().mockResolvedValue([]),
    getUnreadCount: vi.fn().mockResolvedValue(0),
    markAsRead: vi.fn().mockResolvedValue(true),
    markAllAsRead: vi.fn().mockResolvedValue(3),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("NotificationController", () => {
  let mockRes;
  let mockNotifications;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = createMockRes();
    mockNotifications = createMockNotifications();
    mockDbManager = { notifications: mockNotifications };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // apiGetNotifications
  // ─────────────────────────────────────────────────────────────────────────

  describe("apiGetNotifications", () => {
    it("returns 400 when userId is missing", async () => {
      const req = { params: {}, query: {} };
      await apiGetNotifications(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("returns 503 when notifications repo is unavailable", async () => {
      mockDbManager = { notifications: null };
      const req = { params: { userId: "u1" }, query: {} };
      await apiGetNotifications(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(503);
    });

    it("returns notifications with pagination", async () => {
      const sampleNotifications = [
        {
          _id: { toString: () => "n1" },
          type: "vote_reward",
          title: "Vote Reward!",
          message: "+1 Core",
          icon: "vote",
          read: false,
          metadata: {},
          createdAt: new Date("2026-03-18T12:00:00Z"),
        },
        {
          _id: { toString: () => "n2" },
          type: "pro_activated",
          title: "Pro Activated!",
          message: "Pro Engine is now active",
          icon: "pro",
          read: true,
          metadata: { guildId: "g1" },
          createdAt: new Date("2026-03-17T12:00:00Z"),
        },
      ];

      mockNotifications.getByUserId.mockResolvedValue(sampleNotifications);
      mockNotifications.getUnreadCount.mockResolvedValue(1);

      const req = {
        params: { userId: "u1" },
        query: { limit: "10", skip: "0", unread: "false" },
      };

      await apiGetNotifications(req, mockRes);

      // Verify repository call
      expect(mockNotifications.getByUserId).toHaveBeenCalledWith("u1", {
        limit: 10,
        skip: 0,
        unreadOnly: false,
      });

      // Verify response shape
      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.data.notifications).toHaveLength(2);
      expect(responseData.data.notifications[0].id).toBe("n1");
      expect(responseData.data.notifications[0].type).toBe("vote_reward");
      expect(responseData.data.unreadCount).toBe(1);
      expect(responseData.data.pagination).toEqual({
        limit: 10,
        skip: 0,
        hasMore: false,
      });
    });

    it("sets hasMore true when results match limit", async () => {
      // Return exactly 5 notifications (matching limit)
      const notifications = Array.from({ length: 5 }, (_, i) => ({
        _id: { toString: () => `n${i}` },
        type: "vote_reward",
        title: "Vote",
        message: "msg",
        icon: "vote",
        read: false,
        metadata: {},
        createdAt: new Date(),
      }));

      mockNotifications.getByUserId.mockResolvedValue(notifications);
      mockNotifications.getUnreadCount.mockResolvedValue(5);

      const req = {
        params: { userId: "u1" },
        query: { limit: "5" },
      };

      await apiGetNotifications(req, mockRes);

      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.data.pagination.hasMore).toBe(true);
    });

    it("filters unread-only when unread=true", async () => {
      mockNotifications.getByUserId.mockResolvedValue([]);
      mockNotifications.getUnreadCount.mockResolvedValue(0);

      const req = {
        params: { userId: "u1" },
        query: { unread: "true" },
      };

      await apiGetNotifications(req, mockRes);

      expect(mockNotifications.getByUserId).toHaveBeenCalledWith("u1", {
        limit: 20,
        skip: 0,
        unreadOnly: true,
      });
    });

    it("uses default limit and skip values", async () => {
      mockNotifications.getByUserId.mockResolvedValue([]);
      mockNotifications.getUnreadCount.mockResolvedValue(0);

      const req = { params: { userId: "u1" }, query: {} };
      await apiGetNotifications(req, mockRes);

      expect(mockNotifications.getByUserId).toHaveBeenCalledWith("u1", {
        limit: 20,
        skip: 0,
        unreadOnly: false,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // apiGetUnreadCount
  // ─────────────────────────────────────────────────────────────────────────

  describe("apiGetUnreadCount", () => {
    it("returns 400 when userId is missing", async () => {
      const req = { params: {} };
      await apiGetUnreadCount(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("returns 0 when notifications repo is unavailable", async () => {
      mockDbManager = { notifications: null };
      const req = { params: { userId: "u1" } };
      await apiGetUnreadCount(req, mockRes);

      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.data.unreadCount).toBe(0);
    });

    it("returns unread count for a user", async () => {
      mockNotifications.getUnreadCount.mockResolvedValue(5);

      const req = { params: { userId: "u1" } };
      await apiGetUnreadCount(req, mockRes);

      expect(mockNotifications.getUnreadCount).toHaveBeenCalledWith("u1");
      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.data.unreadCount).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // apiMarkAsRead
  // ─────────────────────────────────────────────────────────────────────────

  describe("apiMarkAsRead", () => {
    it("returns 400 when userId or notificationId is missing", async () => {
      const req = { params: { userId: "u1" } };
      await apiMarkAsRead(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("returns 503 when notifications repo is unavailable", async () => {
      mockDbManager = { notifications: null };
      const req = { params: { userId: "u1", notificationId: "n1" } };
      await apiMarkAsRead(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(503);
    });

    it("marks a notification as read successfully", async () => {
      mockNotifications.markAsRead.mockResolvedValue(true);

      const req = { params: { userId: "u1", notificationId: "n1" } };
      await apiMarkAsRead(req, mockRes);

      expect(mockNotifications.markAsRead).toHaveBeenCalledWith("n1", "u1");
      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.data.success).toBe(true);
    });

    it("returns false when notification does not exist", async () => {
      mockNotifications.markAsRead.mockResolvedValue(false);

      const req = { params: { userId: "u1", notificationId: "n999" } };
      await apiMarkAsRead(req, mockRes);

      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.data.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // apiMarkAllAsRead
  // ─────────────────────────────────────────────────────────────────────────

  describe("apiMarkAllAsRead", () => {
    it("returns 400 when userId is missing", async () => {
      const req = { params: {} };
      await apiMarkAllAsRead(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("returns 503 when notifications repo is unavailable", async () => {
      mockDbManager = { notifications: null };
      const req = { params: { userId: "u1" } };
      await apiMarkAllAsRead(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(503);
    });

    it("marks all notifications as read", async () => {
      mockNotifications.markAllAsRead.mockResolvedValue(3);

      const req = { params: { userId: "u1" } };
      await apiMarkAllAsRead(req, mockRes);

      expect(mockNotifications.markAllAsRead).toHaveBeenCalledWith("u1");
      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.data.markedRead).toBe(3);
      expect(responseData.data.message).toMatch(/3 notifications marked/);
    });

    it("uses singular form for 1 notification", async () => {
      mockNotifications.markAllAsRead.mockResolvedValue(1);

      const req = { params: { userId: "u1" } };
      await apiMarkAllAsRead(req, mockRes);

      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.data.message).toMatch(/1 notification marked/);
      expect(responseData.data.message).not.toMatch(/notifications/);
    });

    it("handles 0 notifications gracefully", async () => {
      mockNotifications.markAllAsRead.mockResolvedValue(0);

      const req = { params: { userId: "u1" } };
      await apiMarkAllAsRead(req, mockRes);

      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.data.markedRead).toBe(0);
    });
  });
});
