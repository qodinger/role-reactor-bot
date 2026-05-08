import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

const {
  SessionSecurityManager,
  validatePassword,
  LoginAttemptTracker,
  PasswordResetManager,
} = await import("../../../../src/utils/security/sessionSecurity.js");

describe("SessionSecurityManager", () => {
  let manager;

  beforeEach(() => {
    manager = new SessionSecurityManager();
  });

  afterEach(() => {
    manager.shutdown();
  });

  it("should register a new session", () => {
    manager.registerSession("session-123", "user-123", "discord-123");
    expect(manager.getActiveSessionCount()).toBe(1);
    const info = manager.getSessionInfo("session-123");
    expect(info.discordId).toBe("discord-123");
    expect(info.userId).toBe("user-123");
  });

  it("should update session activity", () => {
    manager.registerSession("session-123", "user-123", "discord-123");
    const before = manager.getSessionInfo("session-123").lastActivity;
    manager.updateSessionActivity("session-123");
    const after = manager.getSessionInfo("session-123").lastActivity;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("should detect role changes", () => {
    manager.registerSession("session-123", "user-123", "discord-123");
    manager.updateSessionRole("session-123", "admin", 1000);
    const result = manager.updateSessionRole("session-123", "user", 2000);
    expect(result.roleChanged).toBe(true);
    expect(result.oldRole).toBe("admin");
    expect(result.newRole).toBe("user");
  });

  it("should invalidate session", () => {
    manager.registerSession("session-123", "user-123", "discord-123");
    expect(manager.getActiveSessionCount()).toBe(1);
    const result = manager.invalidateSession("session-123");
    expect(result).toBe(true);
    expect(manager.getActiveSessionCount()).toBe(0);
  });

  it("should invalidate all user sessions", () => {
    manager.registerSession("session-1", "user-123", "discord-123");
    manager.registerSession("session-2", "user-123", "discord-123");
    manager.registerSession("session-3", "user-456", "discord-456");
    const count = manager.invalidateAllUserSessions("discord-123");
    expect(count).toBe(2);
    expect(manager.getActiveSessionCount()).toBe(1);
  });
});

describe("validatePassword", () => {
  it("should accept valid password", () => {
    const result = validatePassword("Password123");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject short password", () => {
    const result = validatePassword("Pass1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must be at least 8 characters");
  });

  it("should reject password without letters", () => {
    const result = validatePassword("12345678");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain at least one letter",
    );
  });

  it("should reject password without numbers", () => {
    const result = validatePassword("Password");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain at least one number",
    );
  });

  it("should calculate password strength", () => {
    expect(validatePassword("abc").strength).toBe("weak");
    expect(validatePassword("Password123").strength).toBe("medium");
  });
});

describe("LoginAttemptTracker", () => {
  let tracker;

  beforeEach(() => {
    tracker = new LoginAttemptTracker();
  });

  it("should record failed attempts", () => {
    const result = tracker.recordAttempt("user-123");
    expect(result.attempts).toBe(1);
    expect(result.remainingAttempts).toBe(4);
    expect(result.isLockedOut).toBe(false);
  });

  it("should lock out after 5 failed attempts", () => {
    for (let i = 0; i < 5; i++) {
      tracker.recordAttempt("user-123");
    }
    const result = tracker.recordAttempt("user-123");
    expect(result.isLockedOut).toBe(true);
    expect(result.remainingAttempts).toBe(0);
  });

  it("should clear attempts on login", () => {
    tracker.recordAttempt("user-123");
    tracker.recordAttempt("user-123");
    tracker.clearAttempts("user-123");
    const result = tracker.recordAttempt("user-123");
    expect(result.attempts).toBe(1);
  });
});

describe("PasswordResetManager", () => {
  let manager;

  beforeEach(() => {
    manager = new PasswordResetManager();
  });

  it("should generate token and code", () => {
    const result = manager.generateResetToken("test@example.com");
    expect(result.token).toBeDefined();
    expect(result.token.length).toBe(32);
    expect(result.code).toBeDefined();
    expect(result.code.length).toBe(6);
  });

  it("should verify correct code", () => {
    const { token, code } = manager.generateResetToken("test@example.com");
    const result = manager.verifyCode(token, code);
    expect(result.valid).toBe(true);
    expect(result.verified).toBe(true);
  });

  it("should reject incorrect code", () => {
    const { token } = manager.generateResetToken("test@example.com");
    const result = manager.verifyCode(token, "000000");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid verification code");
  });

  it("should reject invalid token", () => {
    const result = manager.verifyCode("invalid-token", "123456");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid or expired reset token");
  });
});
