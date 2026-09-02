import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const mocks = vi.hoisted(() => ({
  mockStorageManager: {
    dbManager: {
      tickets: {
        findByGuild: vi.fn().mockResolvedValue([]),
        getStats: vi.fn().mockResolvedValue({}),
        getStaffStats: vi.fn().mockResolvedValue({}),
      },
      ticketPanels: {
        findByGuild: vi.fn().mockResolvedValue([]),
        findByPanelId: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(true),
        update: vi.fn().mockResolvedValue(true),
      },
      ticketSettings: {
        getByGuild: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(true),
      },
    },
  },
  mockTicketPanel: {
    initialize: vi.fn().mockResolvedValue(undefined),
    createPanel: vi.fn().mockResolvedValue({
      success: true,
      panel: { panelId: "panel123", guildId: "guild123" },
    }),
    sendPanelMessage: vi.fn().mockResolvedValue({ success: true }),
    getPanel: vi.fn().mockResolvedValue({
      panelId: "panel123",
      guildId: "guild123",
      messageId: "msg123",
      channelId: "ch123",
    }),
    deletePanel: vi.fn().mockResolvedValue(true),
    updatePanel: vi.fn().mockResolvedValue({ success: true }),
    refreshPanelMessage: vi.fn().mockResolvedValue({ success: true }),
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
  getDiscordClient: vi.fn().mockReturnValue({
    guilds: {
      fetch: vi.fn().mockResolvedValue({
        channels: {
          fetch: vi.fn().mockResolvedValue({
            isTextBased: vi.fn().mockReturnValue(true),
            send: vi.fn().mockResolvedValue({ id: "msg123" }),
          }),
        },
      }),
    },
  }),
}));

vi.mock("../../../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue(mocks.mockStorageManager),
}));

vi.mock("../../../../src/features/ticketing/TicketPanel.js", () => ({
  getTicketPanel: () => mocks.mockTicketPanel,
}));

vi.mock("../../../../src/features/premium/PremiumManager.js", () => ({
  getPremiumManager: () => ({
    isFeatureActive: vi.fn().mockResolvedValue(false),
  }),
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

vi.mock("../../../../src/features/ticketing/config.js", () => ({
  FREE_TIER: { MAX_CATEGORIES: 3 },
  PRO_ENGINE: { MAX_CATEGORIES: 10 },
}));

// Import the controller after mocks are set up
const {
  apiListTickets,
  apiCreatePanel,
  apiDeletePanel,
  apiUpdatePanel,
  apiRefreshPanel,
} = await import("../../../../src/server/controllers/TicketController.js");

describe("TicketController", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: { guildId: "guild123", panelId: "panel123" },
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

  describe("apiListTickets", () => {
    it("should return tickets successfully", async () => {
      const tickets = [
        { _id: "t1", ticketId: "T-001", status: "open" },
        { _id: "t2", ticketId: "T-002", status: "closed" },
      ];
      mocks.mockStorageManager.dbManager.tickets.findByGuild.mockResolvedValue(
        tickets
      );

      await apiListTickets(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          tickets,
          count: 2,
        })
      );
    });

    it("should return 400 when guildId is missing", async () => {
      req.params = {};

      await apiListTickets(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 500 on database error", async () => {
      mocks.mockStorageManager.dbManager.tickets.findByGuild.mockRejectedValue(
        new Error("DB error")
      );

      await apiListTickets(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("apiCreatePanel", () => {
    beforeEach(() => {
      // Reset TicketPanel implementations (clearAllMocks doesn't reset them)
      mocks.mockTicketPanel.createPanel.mockResolvedValue({
        success: true,
        panel: { panelId: "panel123", guildId: "guild123" },
      });
      mocks.mockTicketPanel.sendPanelMessage.mockResolvedValue({
        success: true,
      });
      mocks.mockTicketPanel.getPanel.mockResolvedValue({
        panelId: "panel123",
        guildId: "guild123",
        messageId: "msg123",
        channelId: "ch123",
      });
      req.body = {
        channelId: "ch123",
        title: "Support Panel",
        description: "Click to create a ticket",
        categories: [
          { label: "General", emoji: "🎫", description: "General support" },
        ],
      };
    });

    it("should create panel successfully", async () => {
      await apiCreatePanel(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          panel: expect.any(Object),
          message: "Panel created successfully",
        })
      );
    });

    it("should return 400 when panel creation fails", async () => {
      mocks.mockTicketPanel.createPanel.mockResolvedValue({
        success: false,
        error: { data: { description: "Invalid channel" } },
      });

      await apiCreatePanel(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 500 when message send fails", async () => {
      mocks.mockTicketPanel.sendPanelMessage.mockResolvedValue({
        success: false,
        error: { data: { description: "Cannot send message" } },
      });

      await apiCreatePanel(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("should return 500 on database error", async () => {
      mocks.mockTicketPanel.createPanel.mockRejectedValue(
        new Error("DB error")
      );

      await apiCreatePanel(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("apiDeletePanel", () => {
    beforeEach(() => {
      mocks.mockStorageManager.dbManager.ticketPanels.findByPanelId.mockResolvedValue(
        {
          panelId: "panel123",
          guildId: "guild123",
          messageId: "msg123",
          channelId: "ch123",
        }
      );
    });

    it("should delete panel successfully", async () => {
      await apiDeletePanel(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          deleted: true,
          message: "Panel deleted successfully",
        })
      );
    });

    it("should return 404 when panel not found", async () => {
      mocks.mockStorageManager.dbManager.ticketPanels.findByPanelId.mockResolvedValue(
        null
      );

      await apiDeletePanel(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 500 on database error", async () => {
      mocks.mockStorageManager.dbManager.ticketPanels.delete.mockRejectedValue(
        new Error("DB error")
      );

      await apiDeletePanel(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("apiUpdatePanel", () => {
    beforeEach(() => {
      req.body = {
        title: "Updated Title",
        description: "Updated Description",
      };
      mocks.mockTicketPanel.getPanel.mockResolvedValue({
        panelId: "panel123",
        guildId: "guild123",
        messageId: "msg123",
        channelId: "ch123",
      });
    });

    it("should update panel successfully", async () => {
      await apiUpdatePanel(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          panel: expect.any(Object),
          message: "Panel updated successfully",
        })
      );
    });

    it("should return 400 when no fields provided", async () => {
      req.body = {};

      await apiUpdatePanel(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when panel not found", async () => {
      mocks.mockTicketPanel.getPanel.mockResolvedValue(null);

      await apiUpdatePanel(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 500 on database error", async () => {
      mocks.mockTicketPanel.updatePanel.mockRejectedValue(
        new Error("DB error")
      );

      await apiUpdatePanel(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("apiRefreshPanel", () => {
    beforeEach(() => {
      mocks.mockTicketPanel.getPanel.mockResolvedValue({
        panelId: "panel123",
        guildId: "guild123",
        messageId: "msg123",
        channelId: "ch123",
      });
    });

    it("should refresh panel successfully", async () => {
      await apiRefreshPanel(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          refreshed: true,
          message: "Panel message refreshed successfully",
        })
      );
    });

    it("should return 404 when panel not found", async () => {
      mocks.mockTicketPanel.getPanel.mockResolvedValue(null);

      await apiRefreshPanel(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 400 when refresh fails", async () => {
      mocks.mockTicketPanel.refreshPanelMessage.mockResolvedValue({
        success: false,
        error: "Message not found",
      });

      await apiRefreshPanel(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 500 on database error", async () => {
      mocks.mockTicketPanel.getPanel.mockRejectedValue(
        new Error("DB error")
      );

      await apiRefreshPanel(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
