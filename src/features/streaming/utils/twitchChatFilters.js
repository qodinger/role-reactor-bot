/**
 * Twitch chat filter detection.
 * Each function returns { violated: boolean, type?: string } so the caller
 * knows which filter triggered (useful for logging and applying the right action).
 */

/**
 * Check for excessive caps in a message.
 * @param {string} text - Message text
 * @param {Object} settings - { threshold: 70, minLength: 10 }
 * @returns {{ violated: boolean }}
 */
export function detectCaps(text, { threshold = 70, minLength = 10 } = {}) {
  if (text.length < minLength) return { violated: false };

  const alpha = text.replace(/[^a-zA-Z]/g, "");
  if (alpha.length === 0) return { violated: false };

  const upperCount = alpha.replace(/[^A-Z]/g, "").length;
  const ratio = (upperCount / alpha.length) * 100;

  return { violated: ratio >= threshold };
}

/**
 * Check for URLs in a message.
 * @param {string} text - Message text
 * @returns {{ violated: boolean }}
 */
export function detectLinks(text) {
  const hasLink = /(https?:\/\/[^\s]+)/i.test(text);
  return { violated: hasLink };
}

/**
 * Detect repeated messages or rapid-fire spam using an in-memory window.
 * @param {string} text - Message text
 * @param {string} userId - Chatter user ID
 * @param {Object} settings - { repeatedMessages: 3, rateThreshold: 5 }
 * @param {Map} history - Shared message history Map (keyed by userId)
 * @returns {{ violated: boolean, type?: string }}
 */
export function detectSpam(
  text,
  userId,
  { repeatedMessages = 3, rateThreshold = 5 } = {},
  history = new Map(),
) {
  const now = Date.now();
  const windowMs = 5000;
  const key = userId;

  if (!history.has(key)) {
    history.set(key, []);
  }
  const msgs = history.get(key);

  // Prune old entries
  while (msgs.length > 0 && msgs[0].time < now - windowMs) {
    msgs.shift();
  }

  // Duplicate detection
  const duplicateCount = msgs.filter(m => m.text === text).length + 1;
  if (duplicateCount >= repeatedMessages) {
    msgs.length = 0; // reset after trigger
    return { violated: true, type: "repeated" };
  }

  // Rate detection
  if (msgs.length + 1 >= rateThreshold) {
    msgs.length = 0;
    return { violated: true, type: "rate" };
  }

  msgs.push({ text, time: now });
  return { violated: false };
}

/**
 * Check for bad words (simple substring match, case-insensitive).
 * @param {string} text - Message text
 * @param {string[]} words - Word list to check against
 * @returns {{ violated: boolean }}
 */
export function detectBadWords(text, words = []) {
  if (!words.length) return { violated: false };
  const lower = text.toLowerCase();
  const violated = words.some(w => lower.includes(w.toLowerCase()));
  return { violated };
}

/**
 * Run all enabled filters against a message and return the first violation.
 * @param {string} text - Message text
 * @param {string} userId - Chatter user ID
 * @param {Object} filters - { caps: { enabled, threshold, minLength }, links: { enabled }, spam: { enabled, repeatedMessages, rateThreshold }, badWords: { enabled, words } }
 * @param {Map} spamHistory - Shared spam history Map
 * @returns {{ violated: boolean, type?: string }} type is the filter name if violated
 */
export function runFilters(
  text,
  userId,
  filters = {},
  spamHistory = new Map(),
) {
  if (filters.caps?.enabled) {
    const result = detectCaps(text, filters.caps);
    if (result.violated) return { violated: true, type: "caps" };
  }

  if (filters.links?.enabled) {
    const result = detectLinks(text);
    if (result.violated) return { violated: true, type: "links" };
  }

  if (filters.spam?.enabled) {
    const result = detectSpam(text, userId, filters.spam, spamHistory);
    if (result.violated)
      return {
        violated: true,
        type: result.type === "repeated" ? "spamRepeated" : "spamRate",
      };
  }

  if (filters.badWords?.enabled) {
    const result = detectBadWords(text, filters.badWords.words);
    if (result.violated) return { violated: true, type: "badWords" };
  }

  return { violated: false };
}
