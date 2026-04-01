/**
 * CORS middleware configuration
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function corsMiddleware(req, res, next) {
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",").map(origin => origin.trim())
    : [];

  const origin = req.headers.origin;

  let allowedOrigin = null;
  if (allowedOrigins.length === 0) {
    if (process.env.NODE_ENV === "production") {
      const vercelAppUrl = process.env.VERCEL_URL || process.env.VERCEL_APP_URL;
      if (vercelAppUrl && origin && origin.includes("vercel.app")) {
        allowedOrigin = origin;
      } else {
        return res.status(403).json({
          status: "error",
          message: "CORS: No allowed origins configured",
        });
      }
    } else {
      allowedOrigin = "*";
    }
  } else if (allowedOrigins.includes("*")) {
    allowedOrigin = origin || "*";
  } else if (origin && allowedOrigins.includes(origin)) {
    allowedOrigin = origin;
  } else if (
    origin &&
    allowedOrigins.some(allowed => {
      const pattern = allowed.replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    })
  ) {
    allowedOrigin = origin;
  } else if (origin) {
    return res.status(403).json({
      status: "error",
      message: "CORS: Origin not allowed",
    });
  }

  // Set CORS headers
  res.header("Access-Control-Allow-Origin", allowedOrigin);
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
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
