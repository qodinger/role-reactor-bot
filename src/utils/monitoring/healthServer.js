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

    // Validate port number
    if (port < 1024 || port > 65535) {
      // If port is invalid, try a safe fallback port
      this.logger.debug(`Port ${port} is invalid, trying fallback port 8080`);
      this.tryStartServer(8080, maxAttempts - 1);
      return;
    }

    this.server = http.createServer(requestHandler);

    this.server.listen(port, () => {
      this.logger.success(`🏥 Health server running on port ${port}`);
    });

    this.server.on("error", error => {
      if (error.code === "EADDRINUSE") {
        // Use a smarter port selection strategy
        const nextPort = this.getNextPort(port);
        this.logger.debug(`Port ${port} is busy, trying port ${nextPort}`);
        this.server = null;
        this.tryStartServer(nextPort, maxAttempts - 1);
      } else {
        this.logger.error("Health server error:", error);
      }
    });
  }

  /**
   * Get the next port to try using a smart strategy
   * @param {number} currentPort - Current port that failed
   * @returns {number} Next port to try
   */
  getNextPort(currentPort) {
    // Try common development ports first
    const commonPorts = [
      3001, 3002, 3003, 3004, 3005, 8080, 8081, 8082, 8083, 8084,
    ];

    // Find the next available common port
    for (const port of commonPorts) {
      if (port > currentPort) {
        return port;
      }
    }

    // If we've exhausted common ports, use a safe range
    const safePort = Math.max(8080, currentPort + 1);
    return Math.min(safePort, 65535); // Ensure we don't exceed max port
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

  /**
   * Handle health check requests
   * @param {http.IncomingMessage} req - HTTP request
   * @param {http.ServerResponse} res - HTTP response
   */
  handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
      switch (path) {
        case "/health":
          this.handleHealthCheck(req, res);
          break;
        case "/health/docker":
          this.handleDockerHealthCheck(req, res);
          break;
        case "/health/commands":
          this.handleCommandHealthCheck(req, res);
          break;
        default:
          res.writeHead(404);
          res.end("Not Found");
      }
    } catch (error) {
      this.logger.error("Health server error:", error);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  }

  /**
   * Handle basic health check
   * @param {http.IncomingMessage} req - HTTP request
   * @param {http.ServerResponse} res - HTTP response
   */
  handleHealthCheck(req, res) {
    const healthData = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || "development",
      docker:
        process.env.DOCKER_ENV === "true" ||
        require("fs").existsSync("/.dockerenv") ||
        (require("fs").existsSync("/proc/1/cgroup") &&
          require("fs")
            .readFileSync("/proc/1/cgroup", "utf8")
            .includes("docker")),
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(healthData, null, 2));
  }

  /**
   * Handle Docker-specific health check
   * @param {http.IncomingMessage} req - HTTP request
   * @param {http.ServerResponse} res - HTTP response
   */
  async handleDockerHealthCheck(req, res) {
    try {
      const fs = require("fs");

      const dockerInfo = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        docker: {
          environment: process.env.DOCKER_ENV === "true",
          dockerenv: fs.existsSync("/.dockerenv"),
          cgroup:
            fs.existsSync("/proc/1/cgroup") &&
            fs.readFileSync("/proc/1/cgroup", "utf8").includes("docker"),
          nodeEnv: process.env.NODE_ENV,
          workingDir: process.cwd(),
          dataDir: fs.existsSync("./data") ? "accessible" : "not accessible",
          logsDir: fs.existsSync("./logs") ? "accessible" : "not accessible",
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
        },
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(dockerInfo, null, 2));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          {
            status: "error",
            error: error.message,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }
  }

  /**
   * Handle command health check
   * @param {http.IncomingMessage} req - HTTP request
   * @param {http.ServerResponse} res - HTTP response
   */
  async handleCommandHealthCheck(req, res) {
    try {
      const { getCommandHandler } = await import("../core/commandHandler.js");
      const commandHandler = getCommandHandler();
      const commandDebug = commandHandler.getAllCommandsDebug();

      const commandHealth = {
        status: commandDebug.synchronized ? "healthy" : "warning",
        timestamp: new Date().toISOString(),
        commands: commandDebug,
        recommendations: [],
      };

      if (!commandDebug.synchronized) {
        commandHealth.recommendations.push(
          "Command collections are not synchronized",
          "Check Docker container logs for command loading errors",
          "Consider restarting the container",
        );
      }

      if (commandDebug.handlerCount === 0) {
        commandHealth.status = "error";
        commandHealth.recommendations.push(
          "No commands loaded in handler collection",
          "Critical issue - bot may not function properly",
        );
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(commandHealth, null, 2));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          {
            status: "error",
            error: error.message,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }
  }
}

export default HealthServer;
