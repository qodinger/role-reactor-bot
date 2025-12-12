/**
 * CORS middleware configuration
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function corsMiddleware(req, res, next) {
  // Get allowed origins from environment or use default
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",").map(origin => origin.trim())
    : ["*"]; // Default to allow all for backward compatibility

  // Get the origin from the request
  const origin = req.headers.origin;

  // Check if origin is allowed
  let allowedOrigin = "*";
  if (allowedOrigins.includes("*")) {
    // Allow all origins (less secure, but backward compatible)
    allowedOrigin = "*";
  } else if (origin && allowedOrigins.includes(origin)) {
    // Allow specific origin
    allowedOrigin = origin;
  } else if (
    origin &&
    allowedOrigins.some(allowed => {
      // Support wildcard patterns like "https://*.example.com"
      const pattern = allowed.replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    })
  ) {
    allowedOrigin = origin;
  } else if (origin) {
    // Origin not allowed - reject request
    return res.status(403).json({
      status: "error",
      message: "CORS: Origin not allowed",
    });
  }

  // Set CORS headers
  res.header("Access-Control-Allow-Origin", allowedOrigin);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
}
