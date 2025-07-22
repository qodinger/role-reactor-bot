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
    this.port = process.env.HEALTH_PORT || process.env.PORT || 3001;
  }

  /**
   * Starts the health check server.
   */
  start() {
    this.tryStartServer(this.port);
  }

  /**
   * Attempt to start server on given port, try next port if busy
   * @param {number} port - Port to try
   * @param {number} maxAttempts - Maximum port attempts (default: 10)
   */
  tryStartServer(port, maxAttempts = 10) {
    if (maxAttempts <= 0) {
      this.logger.warn(
        "⚠️ Could not find available port for health server. Health checks disabled.",
      );
      return;
    }

    this.server = http.createServer(requestHandler);

    this.server.listen(port, () => {
      this.logger.success(`🏥 Health server running on port ${port}`);
    });

    this.server.on("error", error => {
      if (error.code === "EADDRINUSE") {
        this.logger.debug(`Port ${port} is busy, trying port ${port + 1}`);
        this.server = null;
        this.tryStartServer(port + 1, maxAttempts - 1);
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
