import emojiRegex from "emoji-regex";

/**
 * Unescapes HTML entities in a string.
 * @param {string} str The string to unescape.
 * @returns {string} The unescaped string.
 */
function unescapeHtml(str) {
  return str.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/**
 * Extracts an emoji (custom, standard, or common symbol) from the beginning of a string.
 * @param {string} str The string to check.
 * @returns {{emoji: string|null, remaining: string, isSymbol: boolean}} The extracted emoji, remaining string, and whether it's a symbol (not a real emoji).
 */
export function extractEmoji(str) {
  const customEmojiRegex = /^<a?:.+?:\d+>/;
  const standardEmojiRegex = emojiRegex();
  // Include common symbols often used as emojis (Hearts, Stars, Gender signs, etc.)
  // Ranges: U+2600-U+27BF (Misc Symbols, Dingbats), U+2B50 (Star), U+2B55 (Circle)
  const commonSymbolRegex = /^[\u2600-\u27BF\u2B50\u2B55]/;

  let emoji = null;
  let remaining = str;
  let isSymbol = false;

  // Check custom emoji
  const customMatch = str.match(customEmojiRegex);
  if (customMatch) {
    emoji = customMatch[0];
    remaining = str.slice(emoji.length).trim();
    return { emoji, remaining, isSymbol: false };
  }

  // Check standard emoji
  // emoji-regex matches anywhere, so we need to ensure it's at start
  const emojiMatch = str.match(standardEmojiRegex);
  if (emojiMatch && str.startsWith(emojiMatch[0])) {
    emoji = emojiMatch[0];
    remaining = str.slice(emoji.length).trim();
    return { emoji, remaining, isSymbol: false };
  }

  // Check common symbols - these MAY NOT be valid Discord reaction emojis
  const symbolMatch = str.match(commonSymbolRegex);
  if (symbolMatch) {
    emoji = symbolMatch[0];
    remaining = str.slice(emoji.length).trim();
    isSymbol = true; // Mark as symbol, needs validation
    return { emoji, remaining, isSymbol };
  }

  return { emoji: null, remaining: str, isSymbol: false };
}

/**
 * Checks if an emoji is likely a valid Discord reaction emoji.
 * Custom emojis and standard Unicode emojis are valid.
 * Symbols from certain Unicode ranges (like ♡ U+2661) are NOT valid Discord reactions.
 * @param {string} emoji The emoji to validate.
 * @returns {{valid: boolean, reason: string|null}} Validation result.
 */
export function isValidReactionEmoji(emoji) {
  if (!emoji) {
    return { valid: false, reason: "No emoji provided" };
  }

  // Custom Discord emoji format: <:name:id> or <a:name:id>
  if (/^<a?:.+?:\d+>$/.test(emoji)) {
    return { valid: true, reason: null };
  }

  // Check if it's a standard emoji using emoji-regex
  const standardEmojiRegex = emojiRegex();
  const match = emoji.match(standardEmojiRegex);
  if (match && match[0] === emoji) {
    return { valid: true, reason: null };
  }

  // Known invalid symbols that look like emojis but Discord doesn't accept as reactions
  // ♡ (U+2661), ♀ (U+2640), ♂ (U+2642), ⚡︎ (U+26A1), etc.
  const invalidSymbolRanges = [
    /^[\u2600-\u26FF]$/, // Miscellaneous Symbols (includes ♡, ♀, ♂)
    /^[\u2700-\u27BF]$/, // Dingbats
  ];

  for (const range of invalidSymbolRanges) {
    if (range.test(emoji)) {
      return {
        valid: false,
        reason: `\`${emoji}\` is a symbol, not a valid Discord reaction emoji. Use standard emojis like 🩷, ⚡, ♂️ instead.`,
      };
    }
  }

  // Default: assume valid (let Discord API be the final validator)
  return { valid: true, reason: null };
}

/**
 * Parses a string of roles into an array of role objects.
 * @param {string} roleString The string to parse.
 * @returns {{roles: Array<object>, errors: Array<string>}} The parsed roles and any errors.
 */
export function parseRoleString(roleString, maxRoles = 5) {
  const roles = [];
  const errors = [];
  const input = unescapeHtml(roleString.trim());

  // More robust splitting that respects brackets and quotes
  const parts = [];
  let currentPart = "";
  let insideBrackets = false;
  let insideQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === "[") insideBrackets = true;
    else if (char === "]") insideBrackets = false;
    else if (char === '"') insideQuotes = !insideQuotes;

    if (
      (char === "," || char === ";" || char === "\n") &&
      !insideBrackets &&
      !insideQuotes
    ) {
      if (currentPart.trim()) parts.push(currentPart.trim());
      currentPart = "";
    } else {
      currentPart += char;
    }
  }
  if (currentPart.trim()) parts.push(currentPart.trim());

  // Helper to parse a pure role text (after emoji and limits are stripped)
  const parseBaseRole = roleText => {
    let rName = null;
    let rId = null;
    const t = roleText.trim();

    if (t.startsWith('"')) {
      const quoteMatch = t.match(/^"([^"]+)"$/);
      if (quoteMatch) rName = quoteMatch[1];
      else return { error: `Invalid quoted role name: "${roleText}"` };
    } else if (t.match(/^<@&\d+>$/)) {
      rName = t;
      rId = t.match(/^<@&(\d+)>$/)[1];
    } else if (t.match(/^@&\d+$/)) {
      rName = `<${t}>`;
      rId = t.match(/^@&(\d+)$/)[1];
    } else {
      if (t.startsWith("@") && !t.match(/^@&\d+$/)) {
        rName = t.substring(1);
      } else {
        rName = t;
      }
    }

    if (!rName || rName.trim() === "") {
      return { error: `Invalid role name: "${roleText}"` };
    }
    return { name: rName, id: rId };
  };

  for (const part of parts) {
    let str = part.trim();
    if (!str) continue;

    const { emoji, remaining } = extractEmoji(str);
    str = remaining;

    // Remove any leading colons with spaces
    str = str.replace(/^:\s*/, "").trim();

    let limit = null;

    // Try to extract limit from the end (format: role:limit or role : limit)
    // We only extract if it's after the matching brackets if there are brackets.
    const limitMatch = str.match(/(?:\s*:\s*|\s+)(\d+)$/);
    if (limitMatch && !str.endsWith("]")) {
      limit = parseInt(limitMatch[1], 10);
      str = str.slice(0, limitMatch.index).trim();
    } else {
      // Try alternative pattern for role mentions with spaces
      const altLimitMatch = str.match(/^(.+?)\s*:\s*(\d+)$/);
      if (altLimitMatch) {
        limit = parseInt(altLimitMatch[2], 10);
        str = altLimitMatch[1].trim();
      }
    }

    if (limit !== null && (isNaN(limit) || limit < 1 || limit > 1000)) {
      errors.push(`Invalid user limit in part: "${part}" (must be 1-1000)`);
      continue;
    }

    // Check if it's an inline array list `[@Role1, @Role2]`
    if (str.startsWith("[") && str.endsWith("]") && str.includes(",")) {
      const innerContent = str.substring(1, str.length - 1).trim();
      const subRoles = innerContent
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      if (subRoles.length > maxRoles) {
        const upgradeMsg =
          maxRoles === 5 ? " Pro Engine server allows up to 15 roles." : "";
        errors.push(
          `Inline array "${part}" exceeds maximum of ${maxRoles} roles (you provided ${subRoles.length}).${upgradeMsg}`,
        );
        continue;
      }

      for (const subRoleStr of subRoles) {
        const parsed = parseBaseRole(subRoleStr);
        if (parsed.error) {
          errors.push(parsed.error);
        } else {
          roles.push({
            emoji,
            roleName: parsed.name,
            roleId: parsed.id,
            limit,
          });
        }
      }
      continue;
    }

    // If it's `[BundleName]` exactly (starts and ends with bracket, no commas), leave it.
    // parseBaseRole natively handles normal strings. If it's a bracket, it just sets rName to the bracket string.
    const parsed = parseBaseRole(str);
    if (parsed.error) {
      errors.push(parsed.error);
    } else {
      roles.push({
        emoji,
        roleName: parsed.name,
        roleId: parsed.id,
        limit,
      });
    }
  }

  // If there are any errors, return empty roles array
  if (errors.length > 0) {
    return { roles: [], errors };
  }

  return { roles, errors };
}
