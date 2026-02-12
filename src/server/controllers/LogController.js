import { getLogger } from "../../utils/logger.js";
import fs from "fs";
import path from "path";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";

const logger = getLogger();

export async function apiGetLogs(req, res) {
  try {
    const logFilePath = process.env.LOG_FILE || "./logs/bot-dev.log";
    const absolutePath = path.resolve(process.cwd(), logFilePath);

    if (!fs.existsSync(absolutePath)) {
      return res
        .status(404)
        .json(createErrorResponse("Log file not found", 404));
    }

    // Read the last 200 lines roughly (simple implementation)
    // For a more robust version, we'd use a stream or a library like 'read-last-lines'
    // but since this is a dev environment, we can read the whole file if it's small or slice it
    const stats = fs.statSync(absolutePath);
    const fileSize = stats.size;
    const limit = parseInt(req.query.limit) || 1000;

    // Read up to 5MB to ensure we capture enough history
    const readSize = Math.min(fileSize, 5 * 1024 * 1024);

    const buffer = Buffer.alloc(readSize);
    const fd = fs.openSync(absolutePath, "r");
    fs.readSync(fd, buffer, 0, readSize, fileSize - readSize);
    fs.closeSync(fd);

    const logContent = buffer.toString("utf8");
    const lines = logContent.split("\n").filter(line => line.trim());

    // Return the requested number of lines
    const lastLines = lines.slice(-limit);

    return res.json(
      createSuccessResponse({
        logs: lastLines,
        path: logFilePath,
        totalLines: lines.length,
      }),
    );
  } catch (error) {
    logger.error("Failed to read logs", error);
    return res
      .status(500)
      .json(createErrorResponse("Internal Server Error", 500));
  }
}
