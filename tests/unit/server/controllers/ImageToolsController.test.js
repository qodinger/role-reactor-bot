import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiProcessImage } from "../../../../src/server/controllers/ImageToolsController.js";

// --- Mocks ---
const mocks = vi.hoisted(() => ({
  mockLogImageToolUsage: vi.fn(),
  mockResizeImage: vi.fn().mockResolvedValue({
    buffer: Buffer.from("processed_image"),
    contentType: "image/png",
    filename: "resized.png"
  }),
  mockProcessImage: vi.fn().mockResolvedValue({
    buffer: Buffer.from("upscaled_image"),
    contentType: "image/png",
    filename: "upscaled.png"
  }),
  mockCheckAndDeductSpecificCredits: vi.fn(),
  mockRefundAICredits: vi.fn(),
  mockCheckAndConsumeFreeTier: vi.fn(),
  mockRefundFreeTier: vi.fn(),
}));

vi.mock("../../../../src/server/utils/responseHelpers.js", () => ({
  createSuccessResponse: vi.fn(data => ({ status: "success", data })),
  createErrorResponse: vi.fn((message, statusCode) => ({
    statusCode,
    response: { status: "error", message },
  })),
  logRequest: vi.fn(),
}));

vi.mock("../../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue({
    logImageToolUsage: mocks.mockLogImageToolUsage,
  }),
}));

vi.mock("../../../../src/utils/image-tools/sharpProcessor.js", () => ({
  resizeImage: mocks.mockResizeImage,
  compressImage: vi.fn(),
  convertImage: vi.fn(),
}));
vi.mock("../../../../src/utils/image-tools/imageTools.js", () => ({
  processImage: mocks.mockProcessImage,
}));

vi.mock("../../../../src/config/imageTools.js", () => ({
  getImageToolConfig: vi.fn((tool) => ({
    freeDaily: tool === "resize", // mock resize as free, upscale as paid
    allowedTypes: ["image/jpeg", "image/png"],
    maxFileSizeMB: 10
  })),
  isAllowedFileType: vi.fn().mockReturnValue(true),
  isAllowedFileSize: vi.fn().mockReturnValue(true),
  getImageToolCost: vi.fn().mockReturnValue(10),
  FREE_DAILY_QUOTA: 10,
}));

vi.mock("../../../../src/utils/ai/aiCreditManager.js", () => ({
  checkAndDeductSpecificCredits: mocks.mockCheckAndDeductSpecificCredits,
  refundAICredits: mocks.mockRefundAICredits,
}));

vi.mock("../../../../src/utils/image-tools/freeQuotaManager.js", () => ({
  checkAndConsumeFreeTier: mocks.mockCheckAndConsumeFreeTier,
  getFreeQuota: vi.fn(),
  refundFreeTier: mocks.mockRefundFreeTier,
}));

// --- Tests ---

describe("ImageToolsController", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      user: { id: "user_123" },
      file: {
        buffer: Buffer.from("raw_image"),
        originalname: "test.jpg",
        size: 1024,
        mimetype: "image/jpeg",
      },
      body: {
        tool: "resize",
        options: JSON.stringify({ width: 100 }),
      },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
  });

  it("should process a free tool and log usage successfully", async () => {
    mocks.mockCheckAndConsumeFreeTier.mockResolvedValue({ allowed: true, remaining: 9 });

    await apiProcessImage(mockReq, mockRes);

    expect(mocks.mockCheckAndConsumeFreeTier).toHaveBeenCalledWith("user_123");
    expect(mocks.mockResizeImage).toHaveBeenCalled();
    expect(mockRes.set).toHaveBeenCalledWith(expect.objectContaining({
      "X-Free-Remaining": "9",
      "X-Credits-Deducted": "0"
    }));
    expect(mockRes.send).toHaveBeenCalled();

    // Verify usage logging
    expect(mocks.mockLogImageToolUsage).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user_123",
      tool: "resize",
      isFree: true,
      creditsDeducted: 0,
      status: "success"
    }));
  });

  it("should deduct credits for a paid tool and log usage", async () => {
    mockReq.body.tool = "upscale";
    mocks.mockCheckAndDeductSpecificCredits.mockResolvedValue({ success: true, creditsDeducted: 10, creditsRemaining: 40 });

    await apiProcessImage(mockReq, mockRes);

    expect(mocks.mockCheckAndDeductSpecificCredits).toHaveBeenCalledWith("user_123", 10);
    expect(mocks.mockProcessImage).toHaveBeenCalled();
    expect(mockRes.set).toHaveBeenCalledWith(expect.objectContaining({
      "X-Credits-Remaining": "40",
      "X-Credits-Deducted": "10"
    }));

    // Verify usage logging
    expect(mocks.mockLogImageToolUsage).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user_123",
      tool: "upscale",
      isFree: false,
      creditsDeducted: 10,
      status: "success"
    }));
  });

  it("should refund free tier and log failure if processing fails", async () => {
    mocks.mockCheckAndConsumeFreeTier.mockResolvedValue({ allowed: true, remaining: 9 });
    // Force processing error
    mocks.mockResizeImage.mockRejectedValueOnce(new Error("Sharp Error"));

    await apiProcessImage(mockReq, mockRes);

    // Verify refund
    expect(mocks.mockRefundFreeTier).toHaveBeenCalledWith("user_123");
    
    // Verify error response
    expect(mockRes.status).toHaveBeenCalledWith(500);

    // Verify usage logging
    expect(mocks.mockLogImageToolUsage).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user_123",
      tool: "resize",
      status: "failed",
      error: "Sharp Error"
    }));
  });

  it("should refund credits and log failure if paid processing fails", async () => {
    mockReq.body.tool = "upscale";
    mocks.mockCheckAndDeductSpecificCredits.mockResolvedValue({ success: true, creditsDeducted: 10, creditsRemaining: 40 });
    // Force processing error
    mocks.mockProcessImage.mockRejectedValueOnce(new Error("API Timeout"));

    await apiProcessImage(mockReq, mockRes);

    // Verify refund
    expect(mocks.mockRefundAICredits).toHaveBeenCalledWith("user_123", 10, "Image tool processing failed");
    
    // Verify error response
    expect(mockRes.status).toHaveBeenCalledWith(500);

    // Verify usage logging
    expect(mocks.mockLogImageToolUsage).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user_123",
      tool: "upscale",
      status: "failed",
      error: "API Timeout"
    }));
  });
});
