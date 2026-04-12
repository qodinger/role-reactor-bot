import { getSessionSecurityManager } from "../../utils/security/sessionSecurity.js";

export function sessionSecurityMiddleware(req, res, next) {
  const sessionSecurity = getSessionSecurityManager();

  if (!req.session?.id) {
    return next();
  }

  sessionSecurity.updateSessionActivity(req.session.id);

  next();
}

export function requireSessionValid(req, res, next) {
  const sessionSecurity = getSessionSecurityManager();

  if (!req.session?.id) {
    return res.status(401).json({
      success: false,
      error: "No active session",
      code: "NO_SESSION",
    });
  }

  const validity = sessionSecurity.checkSessionValidity(req.session.id);

  if (!validity.valid) {
    if (validity.reason === "SESSION_EXPIRED") {
      return res.status(401).json({
        success: false,
        error: "Session expired due to inactivity",
        code: "SESSION_EXPIRED",
      });
    }

    return res.status(401).json({
      success: false,
      error: "Invalid session",
      code: "INVALID_SESSION",
    });
  }

  next();
}

export function requireRoleValid(req, res, next) {
  if (!req.session?.id || !req.session?.discordUser) {
    return next();
  }

  next();
}

export default {
  sessionSecurityMiddleware,
  requireSessionValid,
  requireRoleValid,
};
