import { getHealthCheckRunner } from "./healthCheck.js";

async function handleHealthCheck(req, res) {
  const healthCheckRunner = getHealthCheckRunner();
  const healthReport = await healthCheckRunner.run();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(healthReport));
}

function handleRoot(req, res) {
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
}

function handleNotFound(req, res) {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
}

function handleOptions(req, res) {
  res.writeHead(200);
  res.end();
}

/**
 * Handles incoming HTTP requests.
 * @param {import("http").IncomingMessage} req The request object.
 * @param {import("http").ServerResponse} res The response object.
 */
export async function requestHandler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return handleOptions(req, res);
  }

  if (req.url === "/health" && req.method === "GET") {
    return await handleHealthCheck(req, res);
  }

  if (req.url === "/" && req.method === "GET") {
    return handleRoot(req, res);
  }

  return handleNotFound(req, res);
}
