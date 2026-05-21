/**
 * CORS middleware configuration
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function corsMiddleware(req, res, next) {
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",").map(origin => origin.trim())
    : ["*"];

  const origin = req.headers.origin;

  let allowedOrigin = null;
  let isExplicitMatch = false;

  if (allowedOrigins.includes("*")) {
    allowedOrigin = origin || "*";
  } else if (origin && allowedOrigins.includes(origin)) {
    allowedOrigin = origin;
    isExplicitMatch = true;
  } else if (
    origin &&
    allowedOrigins.some(allowed => {
      // Escape dots before replacing wildcard to prevent subdomain bypass
      const pattern = allowed.replace(/\./g, "\\.").replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    })
  ) {
    allowedOrigin = origin;
    isExplicitMatch = true;
  } else if (origin) {
    return res.status(403).json({
      status: "error",
      message: "CORS: Origin not allowed",
    });
  }

  if (allowedOrigin) {
    res.header("Access-Control-Allow-Origin", allowedOrigin);
  }
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  // Only send credentials header when origin is explicitly matched, not wildcard
  if (isExplicitMatch) {
    res.header("Access-Control-Allow-Credentials", "true");
  }

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
}
