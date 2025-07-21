import http from "http";
import { getLogger } from "../logger.js";
import { requestHandler } from "./requestHandler.js";

/**
 * A simple HTTP server for health checks.
 */
class HealthServer {
  constructor() {
    this.server = null;
    this.logger = getLogger();
    this.port = process.env.PORT || 3000;
  }

  /**
   * Starts the health check server.
   */
  start() {
    this.server = http.createServer(requestHandler);

    this.server.listen(this.port, () => {
      this.logger.success(`🏥 Health server running on port ${this.port}`);
    });

    this.server.on("error", error => {
      if (error.code === "EADDRINUSE") {
        this.logger.warn(
          `⚠️ Port ${this.port} is already in use. Health server disabled.`,
        );
        this.server = null;
      } else {
        this.logger.error("Health server error:", error);
      }
    });
  }

  /**
   * Stops the health check server.
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        this.logger.info("Health server stopped");
      });
    }
  }
}

export default HealthServer;
