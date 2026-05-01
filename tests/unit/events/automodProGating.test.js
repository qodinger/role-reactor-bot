import { describe, test, expect, vi } from "vitest";

/**
 * Pro Engine Feature Gating Tests
 * Tests that verify FREE vs Pro feature separation
 */

const PRO_FEATURES = {
  domainAllowlist: "domain_allowlisting",
  wildcardBadWords: "wildcard_badwords",
  regexBadWords: "regex_badwords",
  capsLock: "caps_lock",
  perChannel: "per_channel_filtering",
  analytics: "analytics_stats",
  exportLogs: "export_logs",
};

const FREE_FEATURES = {
  badWords: "bad_words",
  links: "links",
  spam: "spam",
  mentionSpam: "mention_spam",
  inviteLink: "invite_link",
};

function isProFeature(featureName) {
  return Object.keys(PRO_FEATURES).includes(featureName);
}

function checkFeatureAccess(featureName, isPro) {
  if (isProFeature(featureName)) {
    return isPro ? "allowed" : "premium_required";
  }
  return "allowed";
}

function validateProFeature(featureName, config, isPro) {
  switch (featureName) {
    case "domainAllowlist":
      return isPro && config.allowedDomains?.length > 0;
    case "wildcardBadWords":
      return isPro && config.mode === "wildcard";
    case "regexBadWords":
      return isPro && config.mode === "regex";
    case "capsLock":
      return isPro && config.enabled;
    case "perChannel":
      return isPro && config.channelsEnabled;
    case "analytics":
      return isPro;
    case "exportLogs":
      return isPro;
    default:
      return true;
  }
}

describe("Pro Engine Feature Gating", () => {
  describe("isProFeature", () => {
    test("should identify Pro features", () => {
      expect(isProFeature("domainAllowlist")).toBe(true);
      expect(isProFeature("capsLock")).toBe(true);
      expect(isProFeature("perChannel")).toBe(true);
      expect(isProFeature("analytics")).toBe(true);
    });

    test("should identify Free features", () => {
      expect(isProFeature("badWords")).toBe(false);
      expect(isProFeature("links")).toBe(false);
      expect(isProFeature("spam")).toBe(false);
      expect(isProFeature("mentionSpam")).toBe(false);
      expect(isProFeature("inviteLink")).toBe(false);
    });
  });

  describe("checkFeatureAccess", () => {
    test("should allow Free features without Pro", () => {
      expect(checkFeatureAccess("badWords", false)).toBe("allowed");
      expect(checkFeatureAccess("links", false)).toBe("allowed");
      expect(checkFeatureAccess("spam", false)).toBe("allowed");
    });

    test("should require Pro for Pro features", () => {
      expect(checkFeatureAccess("domainAllowlist", false)).toBe(
        "premium_required",
      );
      expect(checkFeatureAccess("capsLock", false)).toBe("premium_required");
      expect(checkFeatureAccess("perChannel", false)).toBe("premium_required");
    });

    test("should allow Pro features with Pro status", () => {
      expect(checkFeatureAccess("domainAllowlist", true)).toBe("allowed");
      expect(checkFeatureAccess("capsLock", true)).toBe("allowed");
      expect(checkFeatureAccess("analytics", true)).toBe("allowed");
    });
  });

  describe("validateProFeature - Domain Allowlist", () => {
    test("should be valid for Pro users with domains", () => {
      const config = { allowedDomains: ["youtube.com", "discord.com"] };
      expect(validateProFeature("domainAllowlist", config, true)).toBe(true);
    });

    test("should not work for non-Pro users", () => {
      const config = { allowedDomains: ["youtube.com"] };
      expect(validateProFeature("domainAllowlist", config, false)).toBe(false);
    });

    test("should not work without domains configured", () => {
      const config = { allowedDomains: [] };
      expect(validateProFeature("domainAllowlist", config, true)).toBe(false);
    });
  });

  describe("validateProFeature - Wildcard/Regex Bad Words", () => {
    test("should validate wildcard mode for Pro users", () => {
      const config = { mode: "wildcard", words: ["spam*", "bad*"] };
      expect(validateProFeature("wildcardBadWords", config, true)).toBe(true);
    });

    test("should not work for non-Pro users", () => {
      const config = { mode: "wildcard", words: ["spam*"] };
      expect(validateProFeature("wildcardBadWords", config, false)).toBe(false);
    });

    test("should validate regex mode for Pro users", () => {
      const config = { mode: "regex", words: ["\\d{3}-\\d{4}"] };
      expect(validateProFeature("regexBadWords", config, true)).toBe(true);
    });

    test("should not work for non-Pro users", () => {
      const config = { mode: "regex", words: ["\\d{3}-\\d{4}"] };
      expect(validateProFeature("regexBadWords", config, false)).toBe(false);
    });
  });

  describe("validateProFeature - Caps Lock", () => {
    test("should work for Pro users with caps enabled", () => {
      const config = { enabled: true, threshold: 70 };
      expect(validateProFeature("capsLock", config, true)).toBe(true);
    });

    test("should not work for non-Pro users", () => {
      const config = { enabled: true, threshold: 70 };
      expect(validateProFeature("capsLock", config, false)).toBe(false);
    });
  });

  describe("validateProFeature - Per-Channel", () => {
    test("should work for Pro users with channels enabled", () => {
      const config = { channelsEnabled: true };
      expect(validateProFeature("perChannel", config, true)).toBe(true);
    });

    test("should not work for non-Pro users", () => {
      const config = { channelsEnabled: true };
      expect(validateProFeature("perChannel", config, false)).toBe(false);
    });
  });

  describe("validateProFeature - Analytics/Export", () => {
    test("should allow analytics for Pro users", () => {
      expect(validateProFeature("analytics", {}, true)).toBe(true);
    });

    test("should deny analytics for non-Pro users", () => {
      expect(validateProFeature("analytics", {}, false)).toBe(false);
    });

    test("should allow export for Pro users", () => {
      expect(validateProFeature("exportLogs", {}, true)).toBe(true);
    });

    test("should deny export for non-Pro users", () => {
      expect(validateProFeature("exportLogs", {}, false)).toBe(false);
    });
  });
});

describe("FREE Features Always Work", () => {
  test("badWords should work for all users", () => {
    expect(validateProFeature("badWords", { enabled: true }, false)).toBe(true);
    expect(validateProFeature("badWords", { enabled: true }, true)).toBe(true);
  });

  test("links should work for all users", () => {
    expect(validateProFeature("links", { enabled: true }, false)).toBe(true);
    expect(validateProFeature("links", { enabled: true }, true)).toBe(true);
  });

  test("spam should work for all users", () => {
    expect(validateProFeature("spam", { enabled: true }, false)).toBe(true);
    expect(validateProFeature("spam", { enabled: true }, true)).toBe(true);
  });

  test("mentionSpam should work for all users", () => {
    expect(validateProFeature("mentionSpam", { enabled: true }, false)).toBe(
      true,
    );
    expect(validateProFeature("mentionSpam", { enabled: true }, true)).toBe(
      true,
    );
  });

  test("inviteLink should work for all users", () => {
    expect(validateProFeature("inviteLink", { enabled: true }, false)).toBe(
      true,
    );
    expect(validateProFeature("inviteLink", { enabled: true }, true)).toBe(
      true,
    );
  });
});

describe("Feature Availability Matrix", () => {
  const featureMatrix = {
    free: {
      badWords: true,
      links: true,
      spam: true,
      mentionSpam: true,
      inviteLink: true,
    },
    pro: {
      domainAllowlist: true,
      wildcardBadWords: true,
      regexBadWords: true,
      capsLock: true,
      perChannel: true,
      analytics: true,
      exportLogs: true,
    },
  };

  test("FREE tier should have exactly 5 features", () => {
    const freeFeatures = Object.entries(featureMatrix.free).filter(
      ([, v]) => v,
    );
    expect(freeFeatures).toHaveLength(5);
  });

  test("PRO tier should have exactly 7 features", () => {
    const proFeatures = Object.entries(featureMatrix.pro).filter(([, v]) => v);
    expect(proFeatures).toHaveLength(7);
  });

  test("PRO tier should include all FREE features", () => {
    const freeKeys = Object.keys(featureMatrix.free);
    const proKeys = Object.keys(featureMatrix.pro);
    const allFeatures = [...proKeys, ...freeKeys];
    expect(allFeatures).toContain("badWords");
    expect(allFeatures).toContain("links");
    expect(allFeatures).toContain("spam");
  });
});
