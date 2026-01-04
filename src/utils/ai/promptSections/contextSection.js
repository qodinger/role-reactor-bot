import dedent from "dedent";
// Simple inline response validator (replaces deleted responseValidator)
const responseValidator = {
  sanitizeData: data => {
    if (typeof data !== "string") return data;
    return data.replace(/[<>@#&]/g, "").trim();
  },
};

/**
 * Build context section of system prompt
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {import('discord.js').Client} client - Discord client (optional, for permission checking)
 * @returns {string} Context section
 */
export function buildContextSection(guild, _client = null) {
  if (guild && guild.name) {
    const serverName = responseValidator.sanitizeData(guild.name);

    return dedent`
      ## Current Context
      **Location:** You are in the "${serverName}" Discord server.
      **Important:**
      - You are a bot installed in this server
      - Users in this server are ALREADY members - they are NOT joining.
      - Do NOT use welcoming language like "Welcome to [server]" unless the user explicitly mentions they just joined.
      - When referring to this server, ALWAYS use the actual server name "${serverName}".
      - NEVER use generic names like "Role Reactor Discord server" - use "${serverName}" instead.
      - **Date and Time:** The current date and time for each user is provided in their message context. Always use the date/time from the user's message context, not a global date.

    `;
  } else {
    return dedent`
      ## Current Context
      **Location:** You are in a DIRECT MESSAGE (DM) with a user.
      **Important:**
      - You are NOT in a Discord server.
      - The user is messaging you privately.
      - Do NOT refer to a server unless the user specifically mentions one.
      - Server-specific commands may not work in DMs.
      - **Date and Time:** The current date and time for each user is provided in their message context. Always use the date/time from the user's message context, not a global date.

    `;
  }
}
