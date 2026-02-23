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
export function parseRoleString(roleString) {
  const roles = [];
  const errors = [];
  const input = unescapeHtml(roleString.trim());

  const parts = input.split(/\s*(?:,|;|\n|\\n)\s*/).filter(Boolean);
  for (const part of parts) {
    let str = part.trim();

    // Skip empty parts
    if (!str) continue;

    const { emoji, remaining } = extractEmoji(str);
    str = remaining;

    // Remove any leading colons with spaces
    str = str.replace(/^:\s*/, "").trim();

    let limit = null;
    let roleName = null;
    let roleId = null;

    // Try to extract limit from the end (format: role:limit or role : limit)
    const limitMatch = str.match(/(?:\s*:\s*|\s+)(\d+)$/);
    if (limitMatch) {
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

    // Handle quoted role names
    if (str.startsWith('"')) {
      const quoteMatch = str.match(/^"([^"]+)"$/);
      if (quoteMatch) {
        roleName = quoteMatch[1];
      } else {
        errors.push(`Invalid quoted role name in part: "${part}"`);
        continue;
      }
    }
    // Handle role mentions with @&
    else if (str.match(/^<@&\d+>$/)) {
      roleName = str;
      roleId = str.match(/^<@&(\d+)>$/)[1];
    }
    // Handle role mentions without <>
    else if (str.match(/^@&\d+$/)) {
      roleName = `<${str}>`;
      roleId = str.match(/^@&(\d+)$/)[1];
    }
    // Handle regular role names
    else {
      // Strip @ symbol if it's not a role mention (not @&123456789)
      if (str.startsWith("@") && !str.match(/^@&\d+$/)) {
        roleName = str.substring(1); // Remove the @ symbol
      } else {
        roleName = str;
      }
    }

    if (!roleName || roleName.trim() === "") {
      errors.push(`Invalid role name in part: "${part}"`);
      continue;
    }

    // Validate limit if present
    if (limit !== null && (isNaN(limit) || limit < 1 || limit > 1000)) {
      errors.push(`Invalid user limit in part: "${part}" (must be 1-1000)`);
      continue;
    }

    // Check for duplicate emojis
    const existingRole = roles.find(r => r.emoji === emoji);
    if (existingRole && emoji !== null) {
      errors.push(
        `Duplicate emoji ${emoji} found for roles: "${
          existingRole.roleName || existingRole.roleId
        }" and "${roleName || roleId}"`,
      );
      continue;
    }

    roles.push({ emoji, roleName, roleId, limit });
  }

  // If there are any errors, return empty roles array
  if (errors.length > 0) {
    return { roles: [], errors };
  }

  return { roles, errors };
}
