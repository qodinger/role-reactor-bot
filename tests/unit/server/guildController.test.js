import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGuildSettingsGetByGuild = vi.fn();
const mockGuildSettingsSet = vi.fn();
const mockWelcomeSettingsSet = vi.fn();
const mockIsFeatureActive = vi.fn();
const mockSyncGuildCommands = vi.fn();

vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../../src/server/utils/apiShared.js", () => ({
  getDiscordClient: vi.fn(() => null),
  logRequest: vi.fn(),
}));

vi.mock("../../../src/server/utils/responseHelpers.js", () => ({
  createSuccessResponse: data => ({ status: "success", data }),
  createErrorResponse: (message, statusCode = 500, details = null) => ({
    statusCode,
    response: { status: "error", message, details },
  }),
}));

vi.mock("../../../src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue({
    guildSettings: {
      getByGuild: mockGuildSettingsGetByGuild,
      set: mockGuildSettingsSet,
    },
    welcomeSettings: {
      set: mockWelcomeSettingsSet,
    },
  }),
}));

vi.mock("../../../src/utils/core/commandHandler.js", () => ({
  getCommandHandler: () => ({
    syncGuildCommands: mockSyncGuildCommands,
    getAllCommands: () => [],
    getCommandInfo: () => null,
  }),
}));

vi.mock("../../../src/utils/core/commandRegistry.js", () => ({
  commandRegistry: {
    initialized: true,
    initialize: vi.fn(),
    getCommandMetadata: vi.fn(),
  },
}));

vi.mock("../../../src/features/premium/PremiumManager.js", () => ({
  getPremiumManager: () => ({
    isFeatureActive: mockIsFeatureActive,
  }),
}));

vi.mock("../../../src/features/premium/config.js", () => ({
  PremiumFeatures: {
    PRO: { id: "pro_engine" },
  },
}));

const { apiUpdateGuildSettings } = await import(
  "../../../src/server/controllers/GuildController.js"
);

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("apiUpdateGuildSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuildSettingsGetByGuild.mockResolvedValue({
      guildId: "guild-1",
      premiumFeatures: {
        pro_engine: {
          active: false,
          nextDeductionDate: null,
        },
      },
      experienceSystem: {
        enabled: false,
      },
      disabledCommands: [],
    });
    mockIsFeatureActive.mockResolvedValue(true);
  });

  it("does not persist protected billing fields from guild settings requests", async () => {
    const req = {
      params: { guildId: "guild-1" },
      body: {
        premiumFeatures: {
          pro_engine: {
            active: true,
            nextDeductionDate: "2099-01-01T00:00:00.000Z",
          },
        },
        experienceSystem: {
          enabled: true,
        },
      },
    };
    const res = createResponse();

    await apiUpdateGuildSettings(req, res);

    expect(mockGuildSettingsSet).toHaveBeenCalledWith(
      "guild-1",
      expect.objectContaining({
        experienceSystem: { enabled: true },
        premiumFeatures: {
          pro_engine: {
            active: false,
            nextDeductionDate: null,
          },
        },
      }),
    );
  });

  it("rejects updates that contain no editable guild setting fields", async () => {
    const req = {
      params: { guildId: "guild-1" },
      body: {
        premiumFeatures: {
          pro_engine: { active: true },
        },
      },
    };
    const res = createResponse();

    await apiUpdateGuildSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockGuildSettingsSet).not.toHaveBeenCalled();
  });
});
