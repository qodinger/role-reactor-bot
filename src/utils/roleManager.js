import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File path for storing role mappings
const ROLE_MAPPINGS_FILE = path.join(__dirname, "../config/role-mappings.json");

// Ensure config directory exists
const ensureConfigDir = async () => {
  const configDir = path.dirname(ROLE_MAPPINGS_FILE);
  try {
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }
};

// Load role mappings from file
const loadRoleMappings = async () => {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(ROLE_MAPPINGS_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    // File doesn't exist or is invalid, return empty object
    return {};
  }
};

// Save role mappings to file
const saveRoleMappings = async mappings => {
  await ensureConfigDir();
  await fs.writeFile(ROLE_MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
};

// Get role mapping for a specific message
const getRoleMapping = async messageId => {
  const mappings = await loadRoleMappings();
  return mappings[messageId] || null;
};

// Set role mapping for a specific message
const setRoleMapping = async (messageId, roleMapping) => {
  const mappings = await loadRoleMappings();
  mappings[messageId] = roleMapping;
  await saveRoleMappings(mappings);
};

// Remove role mapping for a specific message
const removeRoleMapping = async messageId => {
  const mappings = await loadRoleMappings();
  delete mappings[messageId];
  await saveRoleMappings(mappings);
};

// Get all role mappings
const getAllRoleMappings = async () => {
  return await loadRoleMappings();
};

// Validate emoji format
const isValidEmoji = emoji => {
  // Check if it's a custom emoji (format: <:name:id>)
  const customEmojiRegex = /^<a?:.+?:\d+>$/;
  if (customEmojiRegex.test(emoji)) return true;

  // Check if it's a Unicode emoji (using regex for emoji ranges)
  // This regex matches most common Unicode emojis
  const unicodeEmojiRegex = /\p{Emoji}/u;
  return unicodeEmojiRegex.test(emoji);
};

// Parse emoji to get the name/id
const parseEmoji = emoji => {
  if (emoji.length === 1) {
    return emoji; // Unicode emoji
  }

  // Custom emoji: extract the name
  const match = emoji.match(/^<a?:(.+?):\d+>$/);
  return match ? match[1] : emoji;
};

// Parse role string (flat, no categories)
const parseRoleString = rolesString => {
  const roles = [];
  const errors = [];

  // Split by comma or newline
  const lines = rolesString
    .split(/,|\n/)
    .map(line => line.trim())
    .filter(line => line);

  for (const line of lines) {
    const [emoji, roleName] = line.split(":").map(s => s.trim());
    if (!emoji || !roleName) {
      errors.push(`❌ Invalid format: "${line}" (use format: emoji:role)`);
      continue;
    }
    if (!isValidEmoji(emoji)) {
      errors.push(`❌ Invalid emoji: "${emoji}"`);
      continue;
    }
    roles.push({ emoji, roleName });
  }
  return { roles, errors };
};

export {
  getRoleMapping,
  setRoleMapping,
  removeRoleMapping,
  getAllRoleMappings,
  isValidEmoji,
  parseEmoji,
  parseRoleString,
};
