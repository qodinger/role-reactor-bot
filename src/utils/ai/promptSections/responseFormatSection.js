import dedent from "dedent";
import { commandDiscoverer } from "../commandDiscoverer.js";

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
 * Generate a command example from actual commands
 * @param {import('discord.js').Client} client - Discord client
 * @returns {Promise<string>} Command example JSON
 */
async function generateCommandExample(client) {
  try {
    const { getExecutableCommands } = await import(
      "../commandExecutor/commandValidator.js"
    );
    const executableCommands = await getExecutableCommands(client);
    const botCommands = commandDiscoverer.getBotCommands(client);

    // Prefer avatar command as example (common use case)
    const avatarCmd = executableCommands.find(c => c.name === "avatar");
    if (avatarCmd) {
      const cmd = botCommands.find(c => c.name === "avatar");
      if (cmd && cmd.options && cmd.options.length > 0) {
        const promptOption = cmd.options.find(o => o.name === "prompt");
        if (promptOption) {
          return `{\n  "message": "",\n  "actions": [{"type": "execute_command", "command": "avatar", "options": {"prompt": "cyberpunk hacker with neon glasses"}}]\n}`;
        }
      }
    }

    // Find a command with a subcommand for a good example
    for (const execCmd of executableCommands) {
      if (execCmd.subcommands && execCmd.subcommands.length > 0) {
        const cmd = botCommands.find(c => c.name === execCmd.name);
        if (cmd) {
          const subcmd = cmd.subcommands.find(
            s => (s.name || s) === execCmd.subcommands[0],
          );
          if (subcmd && subcmd.options && subcmd.options.length > 0) {
            const firstOption = subcmd.options[0];
            const exampleOptions = {};
            exampleOptions[firstOption.name] = `"example_value"`;

            return `{\n  "message": "I'll execute that command for you.",\n  "actions": [{"type": "execute_command", "command": "${execCmd.name}", "subcommand": "${execCmd.subcommands[0]}", "options": ${JSON.stringify(exampleOptions, null, 2).replace(/"/g, '"')}}]\n}`;
          }
        }
      }
    }

    // Fallback to simple command
    if (executableCommands.length > 0) {
      return `{\n  "message": "I'll execute that command for you.",\n  "actions": [{"type": "execute_command", "command": "${executableCommands[0].name}", "options": {}}]\n}`;
    }
  } catch (_error) {
    // Ignore
  }

  // Final fallback
  return `{\n  "message": "I'll challenge someone to Rock Paper Scissors!",\n  "actions": [{"type": "execute_command", "command": "rps", "options": {"user": "@username", "choice": "rock"}}]\n}`;
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
  const commandExample = await generateCommandExampleFn(client);

  let examples = dedent`
    **Additional Examples (use ACTUAL data from Server Information, not placeholders):**

    **Example A - List members (NO actions) - Use plain text:**
    Here are all members:
    - MemberName1 (online)
    - MemberName2 (offline)
    - MemberName3 (idle)
    
    **Example B - Execute avatar/imagine (message EMPTY):**
    User: "generate an avatar of a cyberpunk hacker"
    {
      "message": "",
      "actions": [{"type": "execute_command", "command": "avatar", "options": {"prompt": "cyberpunk hacker"}}]
    }
    **Note:** Message is EMPTY for avatar/imagine commands. Use user's EXACT prompt unless too vague.

  `;

  if (commandExample) {
    examples += dedent`
      **Example 6 - Execute command (dynamic example):**
      ${commandExample}

    `;
  }

  return examples;
}

/**
 * Build response format section of system prompt
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {import('discord.js').Client} client - Discord client
 * @param {Object} permissions - { isAdmin, isMod }
 * @returns {Promise<string>} Response format section
 */
export async function buildResponseFormatSection(guild, client, permissions = {}) {
  const actionsList = await buildDynamicActionsList(guild, client, permissions);
  const examples = await buildResponseFormatExamples(
    guild,
    client,
    generateCommandExample,
  );

  return dedent`
    ## Response Format

    **IMPORTANT: Use the correct format based on whether you need to execute actions:**

    ### When you need to execute actions (commands, role changes, etc.):
    **You MUST respond in JSON format — the ENTIRE response must be valid JSON with NO text before or after it:**
    {
      "message": "Your response text here (can be empty if command provides its own response)",
      "actions": [{"type": "execute_command", "command": "...", "options": {...}}]
    }
    **CRITICAL: Do NOT write any text before or after the JSON block. Output ONLY the raw JSON object.**

    ### When you DON'T need to execute any actions:
    **Respond in plain text/markdown format (NO JSON):**
    Just write your response directly. You can use Discord markdown formatting:
    - **Bold text** with \`**text**\`
    - *Italic text* with \`*text*\`
    - \`Code\` with backticks
    - Lists, links, etc.

    **CRITICAL DECISION RULES:**
    
    1. **Do I need to execute any actions?** (commands, role changes, data fetching, etc.)
       - ✅ YES → Use JSON format
       - ❌ NO → Use plain text/markdown
    
    2. **Format Selection:**
       - **Actions exist** → JSON: \`{"message": "...", "actions": [...]}\`
       - **No actions** → Plain text: Just write your response directly
    
    3. **NEVER use JSON when actions array would be empty** - if you have no actions, use plain text!

    4. **HONESTY IS REQUIRED:**
       - If you cannot fulfill a request, DO NOT GUESS a command. DO NOT execute related but incorrect commands.
       - Instead, respond in **Plain text** politely explaining that you cannot do that or don't have that information.
    
    **Additional Rules:**
    - Use double quotes for JSON strings (only when using JSON format)
    - **CRITICAL:** JSON does NOT support comments (// or /* */). NEVER add comments inside JSON - they will break parsing!
    - Use actual data from Server Information - never placeholders
    - **CRITICAL:** When using "execute_command", you MUST provide ALL required options - commands will fail if options are missing
    - **CRITICAL:** NEVER execute the "chat" command - you are ALREADY in the chat command context! If you need to answer a question, just respond directly with plain text. Do NOT use execute_command with "chat" as it will create infinite loops.
    - **REMEMBER:** If you're just answering a question without executing anything, use plain text!
    - **EXECUTE ONLY REQUESTED ACTIONS:** Only execute actions that the user explicitly requested. Do NOT add extra actions (like RPS challenges, games, etc.) unless the user specifically asks for them. If the user asks for server info, execute ONLY the serverinfo command - do not add other actions!
    - **NO HALLUCINATIONS:** If a user asks "who deleted my message" or "who banned this user", and you don't have the audit log data in your context, DO NOT execute a random command. Say: "I don't have access to that information."

    **EXAMPLES:**

    **Example 1: Simple response (NO actions) - Use plain text:**
    Hello! How can I help you today? I'm here to assist with server management, role reactions, and more!

    **Example 2: Response with actions - Use JSON:**
    {
      "message": "I'll show you the server info!",
      "actions": [{"type": "execute_command", "command": "serverinfo", "options": {}}]
    }
    **Note:** Only execute commands if the information is NOT already present in your Server Information context.

    **Example 3: Command execution only (NO message) - Use JSON:**
    {
      "message": "",
      "actions": [{"type": "execute_command", "command": "rps", "options": {"user": "<@123456789>", "choice": "rock"}}]
    }
    
    **Example 4: Answering using Server Information (NO actions) - Use plain text:**
    User: "Can you give me the info of any member?"
    AI: "Sure! Looking at the latest members to join, I see **iRiS** (@irisreturn). They joined 8 months ago!"
    ✅ CORRECT: You already had this data in the "Member Information" block, so you just answered in plain text. No need to execute /userinfo.

    **Example 4: INCORRECT - Don't use JSON when you have no actions:**
    {
      "message": "Hello!",
      "actions": []
    }
    ❌ WRONG! Empty actions = use plain text! ✅ CORRECT: Just say "Hello!" directly.

    **CRITICAL:** Only execute actions that the user explicitly requested. Do NOT add extra actions like games, challenges, or other commands unless the user specifically asks for them!

    **Available Actions - You can perform ANY action the bot can do!**

    ${actionsList}

    ${examples}
  `;
}
