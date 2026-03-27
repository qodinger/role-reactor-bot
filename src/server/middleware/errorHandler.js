import { getLogger } from "../../utils/logger.js";
import { createErrorResponse } from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Error handling middleware
 * @param {Error} error - The error object
 * @param {import('../types.js').ExtendedRequest} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} _next - Express next function (unused)
 */
export function errorHandler(error, req, res, _next) {
  const requestId = req.requestId || "unknown";
  logger.error("❌ API server error:", {
    requestId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  const { statusCode, response } = createErrorResponse(
    "Internal server error",
    500,
    isDevelopment ? error.message : null,
    isDevelopment ? error.stack : null,
  );

  res.status(statusCode).json({
    ...response,
    requestId,
  });
}

/**
 * Scanner detection: track 404 counts per IP to suppress log spam
 * from automated vulnerability scanners.
 */
const scannerTracker = new Map();
const SCANNER_THRESHOLD = 5; // hits within the window to be flagged as scanner
const SCANNER_WINDOW_MS = 60_000; // 60 seconds

/**
 * Checks if an IP is behaving like an automated scanner
 * @param {string} ip - The client IP address
 * @returns {{ isScanner: boolean, hitCount: number, justDetected: boolean }}
 */
function trackScannerIP(ip) {
  const now = Date.now();
  let entry = scannerTracker.get(ip);

  if (!entry) {
    entry = { hits: [], flagged: false };
    scannerTracker.set(ip, entry);
  }

  // Remove old hits outside the window
  entry.hits = entry.hits.filter(t => now - t < SCANNER_WINDOW_MS);
  entry.hits.push(now);

  const justDetected = !entry.flagged && entry.hits.length >= SCANNER_THRESHOLD;
  if (justDetected) {
    entry.flagged = true;
  }

  return {
    isScanner: entry.flagged,
    hitCount: entry.hits.length,
    justDetected,
  };
}

// Cleanup stale scanner tracker entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [ip, entry] of scannerTracker) {
      entry.hits = entry.hits.filter(t => now - t < SCANNER_WINDOW_MS);
      if (entry.hits.length === 0) {
        scannerTracker.delete(ip);
      }
    }
  },
  5 * 60 * 1000,
).unref();

/**
 * 404 Not Found handler
 * @param {import('../types.js').ExtendedRequest} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function notFoundHandler(req, res) {
  const requestId = req.requestId || "unknown";
  const ip = req.ip;
  const { isScanner, hitCount, justDetected } = trackScannerIP(ip);

  if (justDetected) {
    // Alert once when a scanner is first detected
    logger.warn(
      `🛡️ Scanner detected from ${ip} (${hitCount} 404s in 60s), suppressing further 404 logs`,
      {
        ip,
        userAgent: req.get("User-Agent"),
      },
    );
  } else if (isScanner) {
    // Silently log at debug level for known scanners
    logger.debug(`🔍 404 (scanner) ${req.method} ${req.url}`, { ip });
  } else {
    // Normal 404 — log at warn level
    logger.warn("🔍 404 Not Found", {
      requestId,
      url: req.url,
      method: req.method,
      ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    });
  }

  const { statusCode, response } = createErrorResponse(
    "Endpoint not found",
    404,
    `The requested endpoint ${req.method} ${req.url} does not exist`,
  );

  res.status(statusCode).json({
    ...response,
    requestId,
    url: req.url,
    method: req.method,
  });
}
