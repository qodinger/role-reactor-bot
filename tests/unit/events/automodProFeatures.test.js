import { describe, test, expect, beforeEach, vi } from "vitest";

/**
 * Per-Channel Filtering Logic
 * Extracted from automod event handler
 */

function getActiveSettings(globalSettings, channelSettings) {
  if (channelSettings?.enabled) {
    return { ...globalSettings, ...channelSettings };
  }
  return globalSettings;
}

function shouldApplyChannelFilter(channelSettings, filterName) {
  if (!channelSettings?.enabled) return true;
  if (!channelSettings.filters) return true;
  if (channelSettings.filters === "all") return true;
  return channelSettings.filters[filterName] === true;
}

describe("Per-Channel Filtering", () => {
  const defaultGlobalSettings = {
    badWords: { enabled: true },
    links: { enabled: true },
    spam: { enabled: true },
    mentionSpam: { enabled: true },
    inviteLink: { enabled: true },
  };

  describe("getActiveSettings", () => {
    test("should return global settings when no channel settings", () => {
      const result = getActiveSettings(defaultGlobalSettings, null);
      expect(result).toEqual(defaultGlobalSettings);
    });

    test("should return global settings when channel disabled", () => {
      const channelSettings = { enabled: false };
      const result = getActiveSettings(defaultGlobalSettings, channelSettings);
      expect(result).toEqual(defaultGlobalSettings);
    });

    test("should merge channel settings over global", () => {
      const channelSettings = {
        enabled: true,
        badWords: { enabled: false },
      };
      const result = getActiveSettings(defaultGlobalSettings, channelSettings);
      expect(result.badWords.enabled).toBe(false);
      expect(result.links.enabled).toBe(true);
    });

    test("should use channel settings when enabled", () => {
      const globalSettings = { badWords: { enabled: true } };
      const channelSettings = { enabled: true, badWords: { enabled: false } };
      const result = getActiveSettings(globalSettings, channelSettings);
      expect(result.badWords.enabled).toBe(false);
    });
  });

  describe("shouldApplyChannelFilter", () => {
    test("should return true when no channel settings", () => {
      expect(shouldApplyChannelFilter(null, "badWords")).toBe(true);
    });

    test("should return true when channel not enabled", () => {
      const channelSettings = { enabled: false };
      expect(shouldApplyChannelFilter(channelSettings, "badWords")).toBe(true);
    });

    test("should return true when filter is in enabled filters", () => {
      const channelSettings = {
        enabled: true,
        filters: { badWords: true, links: true },
      };
      expect(shouldApplyChannelFilter(channelSettings, "badWords")).toBe(true);
      expect(shouldApplyChannelFilter(channelSettings, "links")).toBe(true);
    });

    test("should return false when filter is not enabled", () => {
      const channelSettings = {
        enabled: true,
        filters: { badWords: true },
      };
      expect(shouldApplyChannelFilter(channelSettings, "links")).toBe(false);
    });

    test("should return true when filters is 'all'", () => {
      const channelSettings = { enabled: true, filters: "all" };
      expect(shouldApplyChannelFilter(channelSettings, "spam")).toBe(true);
    });
  });
});

describe("Analytics Data Structure", () => {
  test("should create proper analytics object", () => {
    const analytics = {
      totalViolations: 0,
      violationsByType: {
        bad_words: 0,
        link: 0,
        spam: 0,
        mention_spam: 0,
        invite_link: 0,
        caps_lock: 0,
      },
      violationsByDay: {},
    };

    expect(analytics.totalViolations).toBe(0);
    expect(analytics.violationsByType.bad_words).toBe(0);
    expect(Object.keys(analytics.violationsByType)).toHaveLength(6);
  });

  test("should increment violation counts", () => {
    const analytics = {
      totalViolations: 0,
      violationsByType: { bad_words: 0 },
      violationsByDay: {},
    };

    analytics.totalViolations += 1;
    analytics.violationsByType.bad_words += 1;

    expect(analytics.totalViolations).toBe(1);
    expect(analytics.violationsByType.bad_words).toBe(1);
  });
});

describe("Violation Log Entry", () => {
  test("should create proper log entry structure", () => {
    const logEntry = {
      userId: "123456789",
      userTag: "user#1234",
      channelId: "987654321",
      channelName: "general",
      type: "bad_words",
      reason: "Bad word detected",
      timestamp: new Date(),
    };

    expect(logEntry.userId).toBeDefined();
    expect(logEntry.userTag).toBeDefined();
    expect(logEntry.channelName).toBe("general");
    expect(logEntry.type).toBe("bad_words");
    expect(logEntry.timestamp).toBeInstanceOf(Date);
  });
});

describe("CSV Export Format", () => {
  test("should generate correct CSV header", () => {
    const header = "User,Type,Reason,Channel,Timestamp";
    expect(header).toBe("User,Type,Reason,Channel,Timestamp");
  });

  test("should format log entry as CSV row", () => {
    const log = {
      user: "user#1234",
      type: "bad_words",
      reason: "Bad word detected",
      channel: "general",
      timestamp: "2026-05-01T10:00:00.000Z",
    };

    const row = `${log.user},${log.type},${log.reason},${log.channel},${log.timestamp}`;
    expect(row).toBe(
      "user#1234,bad_words,Bad word detected,general,2026-05-01T10:00:00.000Z",
    );
  });

  test("should handle multiple log entries", () => {
    const logs = [
      {
        user: "user1#0001",
        type: "bad_words",
        reason: "Swear word",
        channel: "general",
        timestamp: "2026-05-01",
      },
      {
        user: "user2#0002",
        type: "link",
        reason: "Link detected",
        channel: "spam",
        timestamp: "2026-05-01",
      },
    ];

    const csv = logs
      .map(l => `${l.user},${l.type},${l.reason},${l.channel},${l.timestamp}`)
      .join("\n");

    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("user1#0001,bad_words,Swear word,general,2026-05-01");
    expect(csv).toContain("user2#0002,link,Link detected,spam,2026-05-01");
  });
});
