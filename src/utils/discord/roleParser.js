/**
 * Unescapes HTML entities in a string.
 * @param {string} str The string to unescape.
 * @returns {string} The unescaped string.
 */
function unescapeHtml(str) {
  return str.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
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

  const parts = input.split(/\s*(?:,|;|\n)\s*/).filter(Boolean);
  for (const part of parts) {
    let str = part.trim();

    // Skip empty parts
    if (!str) continue;

    const emojiMatch = str.match(
      /^(<a?:.+?:\d+>|[\p{Emoji_Presentation}\p{Emoji}\uFE0F])/u,
    );
    if (!emojiMatch) {
      errors.push(`Invalid or missing emoji in part: "${part}"`);
      continue;
    }
    const emoji = emojiMatch[0];
    str = str.slice(emoji.length).trim();

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
    if (existingRole) {
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
