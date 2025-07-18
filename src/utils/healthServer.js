import http from "http";
import { getLogger } from "./logger.js";

/**
 * Simple HTTP server for health checks
 */
class HealthServer {
  constructor() {
    this.server = null;
    this.logger = getLogger();
    this.port = process.env.PORT || 3000;
  }

  /**
   * Start the health check server
   */
  start() {
    this.server = http.createServer((req, res) => {
      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check endpoint
      if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || "1.0.0",
          }),
        );
        return;
      }

      // Root endpoint
      if (req.url === "/" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <head><title>Role Reactor Bot</title></head>
            <body>
              <h1>🤖 Role Reactor Bot</h1>
              <p>Status: <strong>Running</strong></p>
              <p>Uptime: ${Math.floor(process.uptime())} seconds</p>
              <p><a href="/health">Health Check</a></p>
            </body>
          </html>
        `);
        return;
      }

      // 404 for other routes
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    this.server.listen(this.port, () => {
      this.logger.success(`🏥 Health server running on port ${this.port}`);
    });

    this.server.on("error", error => {
      this.logger.error("Health server error:", error);
    });
  }

  /**
   * Stop the health check server
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
