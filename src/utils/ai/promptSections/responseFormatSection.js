import dedent from "dedent";

/**
 * Build dynamic actions list for AI prompt
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {import('discord.js').Client} client - Discord client
 * @param {Object} permissions - { isAdmin, isMod }
 * @returns {Promise<string>} Formatted actions list
 */
async function buildDynamicActionsList(guild, client, permissions = {}) {
  const { isAdmin = false, isMod = false } = permissions;
  const canRunServerActions = isAdmin || isMod;
  let actionsList = "";

  // Permission tier label
  if (isAdmin) {
    actionsList += `**[Mode: Admin — all actions available]**\n\n`;
  } else if (isMod) {
    actionsList += `**[Mode: Moderator — server data and general commands available]**\n\n`;
  } else {
    actionsList += `**[Mode: Member — read-only lookups, web search, and general commands only]**\n\n`;
  }

  // Always-available actions (work in DMs and servers)
  actionsList += `**User Interaction:**\n`;
  actionsList += `- "show_component" - Show Discord buttons or select menu for user to choose from\n`;
  actionsList += `  options: { question: "...", options: [{label: "...", value: "...", description: "..."}], component_type: "buttons"|"select" }\n`;
  actionsList += `  ≤5 options → buttons; >5 → select menu.\n\n`;

  actionsList += `**Web Search:**\n`;
  actionsList += `- "web_search" - Search the web for real-time or current information\n`;
  actionsList += `  options: { query: "search terms", count: 5 }\n\n`;

  // Read-only member lookups (all users in a server)
  if (guild) {
    actionsList += `**Data Lookup (read-only):**\n`;
    actionsList += `- "get_member_info" — options: { user_id } or { username }\n`;
    actionsList += `- "get_role_info" — options: { role_id } or { role_name }\n`;
    actionsList += `- "get_channel_info" — options: { channel_id } or { channel_name }\n`;
    actionsList += `- "search_members_by_role" — options: { role_id } or { role_name }\n\n`;
  }

  // Server data refresh — mods and admins only
  if (guild && canRunServerActions) {
    actionsList += `**Server Data Refresh (mods/admins only):**\n`;
    actionsList += `- "fetch_channels" — refresh channel list\n`;
    actionsList += `- "fetch_roles" — refresh role list\n`;
    actionsList += `- "fetch_all" — refresh all server data\n\n`;
  }

  // Command execution
  if (guild) {
    actionsList += `**Command Execution:**\n`;
    try {
      const { getExecutableCommands } = await import(
        "../commandExecutor/commandValidator.js"
      );
      const executableCommands = await getExecutableCommands(client);
      if (executableCommands.length > 0) {
        actionsList += `- "execute_command" — command, subcommand (optional), options (optional)\n`;
        actionsList += `  Available commands: ${executableCommands.map(c => `/${c.name}`).join(", ")}\n`;
        actionsList += `  **CRITICAL:** NEVER execute "chat" — you are already inside that command. Just respond in plain text.\n`;
      }
    } catch (_error) {
      // Ignore
    }
    actionsList += `\n`;
  }
  return actionsList;
}

/**
 * Generate usage guidance based on actual commands (replaces JSON examples now
 * that actions are performed via native tool calls).
 * @param {import('discord.js').Client} client - Discord client
 * @returns {Promise<string>} Command example text
 */
async function generateCommandExample(client) {
  try {
    const { getExecutableCommands } = await import(
      "../commandExecutor/commandValidator.js"
    );
    const executableCommands = await getExecutableCommands(client);
    if (executableCommands.length > 0) {
      return `You can call the \`execute_command\` tool with any of: ${executableCommands.map(c => `/${c.name}`).join(", ")}. Provide the command name, optional subcommand, and an options object with ALL required options.`;
    }
  } catch (_error) {
    // Ignore
  }
  return `Use the \`execute_command\` tool to run bot commands, always providing all required options.`;
}

/**
 * Build response format examples dynamically
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {import('discord.js').Client} client - Discord client
 * @param {Function} generateCommandExampleFn - Function to generate command example
 * @returns {Promise<string>} Examples section
 */
async function buildResponseFormatExamples(
  guild,
  client,
  generateCommandExampleFn,
) {
  const commandGuidance = await generateCommandExampleFn(client);

  return dedent`
    **Additional Examples (use ACTUAL data from Server Information, not placeholders):**

    **Example A - List members (NO tool call) - Answer in plain text:**
    Here are all members:
    - MemberName1 (online)
    - MemberName2 (offline)
    - MemberName3 (idle)

    **Example B - "end the poll about movies":**
    1. Call \`get_polls\` to find the poll → 2. call \`execute_command\` with command "poll", subcommand "end", and the real poll_id from the result. Do NOT invent IDs.

    ${commandGuidance}
  `;
}

/**
 * Build response format section of system prompt
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {import('discord.js').Client} client - Discord client
 * @param {Object} permissions - { isAdmin, isMod }
 * @returns {Promise<string>} Response format section
 */
export async function buildResponseFormatSection(
  guild,
  client,
  permissions = {},
) {
  const actionsList = await buildDynamicActionsList(guild, client, permissions);
  const examples = await buildResponseFormatExamples(
    guild,
    client,
    generateCommandExample,
  );

  return dedent`
    ## Response Format

    You have access to **tools** (functions). Tools are how you act; plain text is how you speak.

    ### To perform actions (run commands, look up data, show buttons, search the web):
    - **Call the appropriate tool.** The tool schema defines the exact parameters — follow it.
    - You may call several tools in one step when they are independent.
    - After tool results come back, either call another tool or write your final reply.

    ### When you DON'T need any action:
    - Respond in **plain text/markdown** directly (Discord markdown: **bold**, *italic*, \`code\`, lists, links).
    - **NEVER** wrap a plain answer in JSON, and never mention tools or tool names in your reply.

    **CRITICAL DECISION RULES:**

    1. **Do I need to execute or look up anything?**
       - ✅ YES → call the tool(s)
       - ❌ NO → plain text

    2. **HONESTY IS REQUIRED:**
       - If you cannot fulfill a request, DO NOT GUESS a command or fabricate data.
       - Instead, respond in plain text politely explaining that you cannot do that or don't have that information.

    3. **Two-step ID flow:** For operations that need an ID (ending a poll, cancelling a schedule, editing a role-reaction message, removing a warning), FIRST call the matching \`get_*\` tool, THEN use a real ID from its result in \`execute_command\`. Never invent IDs.

    4. **NEVER call execute_command with "chat"** — you ARE the chat. Just reply in plain text.

    **Additional Rules:**
    - Use actual data from Server Information - never placeholders
    - **CRITICAL:** When using "execute_command", you MUST provide ALL required options - commands will fail if options are missing
    - For commands with choices, use the exact choice values shown in the command details
    - **REMEMBER:** Answering a question without executing anything = plain text, no tool call
    - **EXECUTE ONLY REQUESTED ACTIONS:** Only call tools the user explicitly requested. Do NOT add extra actions (like RPS challenges, games, etc.) unless the user specifically asks for them. If the user asks for server info, only get server info - do not add other actions!
    - **NO HALLUCINATIONS:** If a user asks "who deleted my message" or "who banned this user", and you don't have the audit log data in your context, do not call a random tool. Say: "I don't have access to that information."
    - **Commands send their own responses:** when executing a command, don't also write a chatty reply message — the command posts its own result.

    **Available Actions - You can perform ANY action the bot can do!**

    ${actionsList}

    ${examples}
  `;
}
