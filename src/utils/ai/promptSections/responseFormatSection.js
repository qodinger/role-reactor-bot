import dedent from "dedent";
import { commandDiscoverer } from "../commandDiscoverer.js";

/**
 * Build dynamic actions list for AI prompt
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {import('discord.js').Client} client - Discord client
 * @returns {Promise<string>} Formatted actions list
 */
async function buildDynamicActionsList(guild, client) {
  let actionsList = "";

  if (guild) {
    actionsList += `**Command Execution:**\n`;
    try {
      const { getExecutableCommands } = await import(
        "../commandExecutor/commandValidator.js"
      );
      const executableCommands = await getExecutableCommands(client);
      if (executableCommands.length > 0) {
        actionsList += `- "execute_command" - Execute any general bot command (command, subcommand, options)\n`;
        actionsList += `  Available commands: ${executableCommands.map(c => `/${c.name}`).join(", ")}\n`;
        actionsList += `  **Note:** You can only execute commands from /src/commands/general (general commands only)\n`;
        actionsList += `  **CRITICAL:** NEVER execute the "ask" command - you are ALREADY in the ask command context! If you need to answer a question, just respond directly with plain text. Do NOT use execute_command with "ask" as it will create infinite loops.\n`;
      }
    } catch (_error) {
      // Ignore
    }
    actionsList += `\n`;

    actionsList += `**Data Fetching Actions:**\n`;
    actionsList += `- "fetch_members" - Fetch all server members (human members and bots). Use this ONLY when member data is not already in the system context AND user asks about specific members, users, bots, or online/offline status.\n`;
    actionsList += `  **When to use:** User asks about members/users/bots/online status AND the member list is NOT already shown in "COMPLETE LIST OF HUMAN MEMBER NAMES" section above.\n`;
    actionsList += `  **When NOT to use:** If member list is already in context, use that data directly - do NOT fetch again.\n`;
    actionsList += `  **Format:** {"type": "fetch_members"}\n`;
    actionsList += `  **After execution:** The system will automatically re-query with updated member data, then you can respond with the fetched information.\n`;
    actionsList += `  **Note:** For servers with >1000 members, fetching may be limited - use cached data if available.\n`;
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
    **Examples (use ACTUAL data from Server Information above, not placeholders):**

    **Example 1 - Simple response (NO actions) - Use plain text:**
    There are 5 members in this server.

    **Example 2 - List members (NO actions) - Use plain text:**
    Here are all members:
    - MemberName1 (online)
    - MemberName2 (offline)
    - MemberName3 (idle)
    
    (You can format lists naturally - use numbered lists, bullet points, or any clear format that makes sense)

    **Example 3 - Execute command (HAS actions) - Use JSON:**
    {
      "message": "Let me get server information for you.",
      "actions": [{"type": "execute_command", "command": "serverinfo", "options": {}}]
    }

    **Example 4 - Execute avatar/imagine with detailed user prompt (use EXACT, message EMPTY):**
    User: "generate an avatar of a cyberpunk hacker with neon glasses and blue hair"
    {
      "message": "",
      "actions": [{"type": "execute_command", "command": "avatar", "options": {"prompt": "cyberpunk hacker with neon glasses and blue hair"}}]
    }
    **Note:** Message is EMPTY because avatar/imagine commands send their own loading embeds.

    **Example 5 - Execute avatar/imagine with basic user prompt (can enhance, message EMPTY):**
    User: "generate an avatar" or "create an image of a city"
    {
      "message": "",
      "actions": [{"type": "execute_command", "command": "avatar", "options": {"prompt": "anime character portrait, detailed, high quality"}}]
    }
    **Note:** Only enhance when the user's prompt is too vague. If they provide specific details, use their EXACT words. Message is always EMPTY for avatar/imagine commands.

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
 * @returns {Promise<string>} Response format section
 */
export async function buildResponseFormatSection(guild, client) {
  const actionsList = await buildDynamicActionsList(guild, client);
  const examples = await buildResponseFormatExamples(
    guild,
    client,
    generateCommandExample,
  );

  return dedent`
    ## Response Format

    **IMPORTANT: Use the correct format based on whether you need to execute actions:**

    ### When you need to execute actions (commands, role changes, etc.):
    **You MUST respond in JSON format:**
    {
      "message": "Your response text here (can be empty if command provides its own response)",
      "actions": [{"type": "execute_command", "command": "...", "options": {...}}]
    }

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
    
    **Additional Rules:**
    - Use double quotes for JSON strings (only when using JSON format)
    - Use actual data from Server Information - never placeholders
    - **CRITICAL:** When using "execute_command", you MUST provide ALL required options - commands will fail if options are missing
    - **CRITICAL:** NEVER execute the "ask" command - you are ALREADY in the ask command context! If you need to answer a question, just respond directly with plain text. Do NOT use execute_command with "ask" as it will create infinite loops.
    - **REMEMBER:** If you're just answering a question without executing anything, use plain text!
    - **EXECUTE ONLY REQUESTED ACTIONS:** Only execute actions that the user explicitly requested. Do NOT add extra actions (like RPS challenges, games, etc.) unless the user specifically asks for them. If the user asks for server info, execute ONLY the serverinfo command - do not add other actions!

    **EXAMPLES:**

    **Example 1: Simple response (NO actions) - Use plain text:**
    Hello! How can I help you today? I'm here to assist with server management, role reactions, and more!

    **Example 2: Response with actions - Use JSON:**
    {
      "message": "I'll show you the server info!",
      "actions": [{"type": "execute_command", "command": "serverinfo", "options": {}}]
    }

    **Example 3: Command execution only (NO message) - Use JSON:**
    {
      "message": "",
      "actions": [{"type": "execute_command", "command": "rps", "options": {"user": "<@123456789>", "choice": "rock"}}]
    }

    **Example 4: INCORRECT - Don't use JSON when you have no actions:**
    {
      "message": "Hello!",
      "actions": []
    }
    ❌ This is WRONG! Empty actions array means NO actions - use plain text!
    ✅ CORRECT: Just say "Hello!" directly (no JSON, no curly braces)

    **Example 5: INCORRECT - Don't use plain text when you have actions:**
    I'll execute the serverinfo command for you.
    ❌ WRONG! You have actions to execute - use JSON format!
    ✅ CORRECT: Use JSON with actions array

    **Example 6: INCORRECT - Don't execute multiple actions when user only asked for one:**
    User: "Give me the details about this server"
    ❌ WRONG:
    {
      "message": "Sure! Let's play Rock Paper Scissors and I'll show you the server details!",
      "actions": [
        {"type": "execute_command", "command": "rps", "options": {"user": "<@123>", "choice": "rock"}},
        {"type": "execute_command", "command": "serverinfo", "options": {}}
      ]
    }
    ✅ CORRECT - Only execute what was requested:
    {
      "message": "I'll show you the server details!",
      "actions": [{"type": "execute_command", "command": "serverinfo", "options": {}}]
    }
    **CRITICAL:** Only execute actions that the user explicitly requested. Do NOT add extra actions like games, challenges, or other commands unless the user specifically asks for them!

    **Available Actions - You can perform ANY action the bot can do!**

    ${actionsList}

    ${examples}
  `;
}
