import dedent from "dedent";
import { getLogger } from "../logger.js";
import { responseValidator } from "./responseValidator.js";
import { commandDiscoverer } from "./commandDiscoverer.js";
import { serverInfoGatherer } from "./serverInfoGatherer.js";
import { commandSuggester } from "./commandSuggester.js";
import {
  SYSTEM_MESSAGE_CACHE_TIMEOUT,
  MAX_SYSTEM_CACHE_SIZE,
  MAX_RESPONSE_LENGTH,
  DEFAULT_RESPONSE_LENGTH,
} from "./constants.js";

const logger = getLogger();

/**
 * Builds system prompts and context for AI chat
 * Handles system message caching and prompt construction
 */
export class SystemPromptBuilder {
  constructor() {
    this.systemMessageCache = new Map();
  }

  /**
   * Limit system message cache size to prevent memory issues
   * @private
   */
  limitSystemCacheSize() {
    if (this.systemMessageCache.size > MAX_SYSTEM_CACHE_SIZE) {
      const firstKey = this.systemMessageCache.keys().next().value;
      if (firstKey) {
        this.systemMessageCache.delete(firstKey);
      }
    }
  }

  /**
   * Build identity section of system prompt
   * @returns {string} Identity section
   */
  buildIdentitySection() {
    return dedent`
      ## Your Identity
      You are Role Reactor, an AI assistant for the Role Reactor Discord bot.
      You help users in Discord servers where this bot is installed, or in direct messages (DMs).

    `;
  }

  /**
   * Build context section of system prompt
   * @param {import('discord.js').Guild} guild - Discord guild
   * @returns {string} Context section
   */
  buildContextSection(guild) {
    if (guild && guild.name) {
      const serverName = responseValidator.sanitizeData(guild.name);
      return dedent`
        ## Current Context
        **Location:** You are in the "${serverName}" Discord server.
        **Important:**
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

  /**
   * Build response format section of system prompt
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {Function} generateCommandExample - Function to generate command example
   * @returns {Promise<string>} Response format section
   */
  async buildResponseFormatSection(guild, client, generateCommandExample) {
    const actionsList = await this.buildDynamicActionsList(guild, client);
    const examples = await this.buildResponseFormatExamples(
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
      - **REMEMBER:** If you're just answering a question without executing anything, use plain text!

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

      **Available Actions - You can perform ANY action the bot can do!**

      ${actionsList}

      ${examples}
    `;
  }

  /**
   * Build dynamic actions list for AI prompt
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {Function} getBotCommands - Function to get bot commands
   * @param {Function} discoverDataFetchingCommands - Function to discover data fetching commands
   * @param {Function} discoverDiscordActions - Function to discover Discord actions
   * @returns {Promise<string>} Formatted actions list
   * @private
   */
  async buildDynamicActionsList(guild, client) {
    let actionsList = "";

    if (guild) {
      actionsList += `**Command Execution:**\n`;
      try {
        const { getExecutableCommands } = await import("./commandExecutor.js");
        const executableCommands = await getExecutableCommands(client);
        if (executableCommands.length > 0) {
          actionsList += `- "execute_command" - Execute any general bot command (command, subcommand, options)\n`;
          actionsList += `  Available commands: ${executableCommands.map(c => `/${c.name}`).join(", ")}\n`;
          actionsList += `  **Note:** You can only execute commands from /src/commands/general (general commands only)\n`;
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
   * Build response format examples dynamically
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {Function} generateCommandExample - Function to generate command example
   * @param {Function} generateActionExample - Function to generate action example
   * @returns {Promise<string>} Examples section
   */
  async buildResponseFormatExamples(guild, client, generateCommandExample) {
    const commandExample = await generateCommandExample(client);

    let examples = dedent`
      **Examples (use ACTUAL data from Server Information above, not placeholders):**

      **Example 1 - Simple response (NO actions) - Use plain text:**
      There are 5 members in this server.

      **Example 2 - List members (NO actions) - Use plain text:**
      Here are all members:
      1. MemberName1
      2. MemberName2
      3. MemberName3

      **Example 3 - Execute command (HAS actions) - Use JSON:**
      {
        "message": "Let me get server information for you.",
        "actions": [{"type": "execute_command", "command": "serverinfo", "options": {}}]
      }

    `;

    if (commandExample) {
      examples += dedent`
        **Example 4 - Execute command:**
        ${commandExample}

      `;
    }

    return examples;
  }

  /**
   * Generate a command example from actual commands
   * @param {import('discord.js').Client} client - Discord client
   * @returns {Promise<string>} Command example JSON
   */
  async generateCommandExample(client) {
    try {
      const { getExecutableCommands } = await import("./commandExecutor.js");
      const executableCommands = await getExecutableCommands(client);
      const botCommands = commandDiscoverer.getBotCommands(client);

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
   * Generate a Discord action example
   * @returns {Promise<string>} Action example JSON
   */
  async generateActionExample() {
    const discordActions = await this.discoverDiscordActions();
    if (discordActions.length > 0) {
      // Use add_role as a common example
      const addRoleAction = discordActions.find(a => a.name === "add_role");
      if (addRoleAction) {
        return `{\n  "message": "I'll add that role for you.",\n  "actions": [{"type": "add_role", "options": {"user_id": "123456789", "role_name": "Member"}}]\n}`;
      }
      // Fallback to first available action
      return `{\n  "message": "I'll perform that action.",\n  "actions": [{"type": "${discordActions[0].name}", "options": {}}]\n}`;
    }
    return null;
  }

  /**
   * Build concise system context (optimized for minimal tokens)
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {string} userMessage - User's message (for on-demand command injection)
   * @param {string} locale - User's locale for date/time formatting
   * @param {import('discord.js').User} requester - User who asked the question (optional)
   * @returns {Promise<string>} System message with context
   */
  async buildSystemContext(
    guild,
    client,
    userMessage = "",
    locale = "en-US",
    requester = null,
    options = {},
  ) {
    const { forceIncludeMemberList = false } = options;
    const cacheKey = guild ? `guild_${guild.id}` : `dm_global`;
    const cached = this.systemMessageCache.get(cacheKey);

    // Check cache (5 minutes timeout for command updates)
    // Skip cache if forcing member list inclusion (after fetch_members action)
    if (
      cached &&
      Date.now() - cached.timestamp < SYSTEM_MESSAGE_CACHE_TIMEOUT &&
      !forceIncludeMemberList
    ) {
      return cached.content;
    }

    // Determine if we need detailed info based on user message
    // Force include if fetch_members was just executed
    const needsMemberList =
      forceIncludeMemberList ||
      (userMessage &&
        (userMessage.toLowerCase().includes("member") ||
          userMessage.toLowerCase().includes("who") ||
          userMessage.toLowerCase().includes("list") ||
          userMessage.toLowerCase().includes("people") ||
          userMessage.toLowerCase().includes("users") ||
          userMessage.toLowerCase().includes("offline") ||
          userMessage.toLowerCase().includes("online") ||
          userMessage.toLowerCase().includes("idle") ||
          userMessage.toLowerCase().includes("dnd") ||
          userMessage.toLowerCase().includes("do not disturb")));
    const needsCommandList =
      userMessage &&
      (userMessage.toLowerCase().includes("command") ||
        userMessage.toLowerCase().includes("help") ||
        userMessage.toLowerCase().includes("what can") ||
        userMessage.toLowerCase().includes("how do"));

    // Build system prompt sections
    const responseFormat = await this.buildResponseFormatSection(
      guild,
      client,
      this.generateCommandExample.bind(this),
    );
    const identity = this.buildIdentitySection();
    const contextSection = this.buildContextSection(guild);
    const botInfo = await serverInfoGatherer.getBotInfo(client);
    const serverInfo = guild
      ? await serverInfoGatherer.getServerInfo(guild, client, {
          includeMemberList: needsMemberList,
        })
      : dedent`
        ## DM Context
        - You are in a direct message conversation (not in a server)
        - Server-specific commands may not work here
        - You can still help with general bot questions and information

      `;

    // Add user-specific date/time if locale provided
    const now = new Date();
    const userDateTime = now.toLocaleString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      timeZoneName: "short",
    });

    let context = dedent`
      # Role Reactor AI Assistant

      [Current Date and Time for User: ${userDateTime}]

      ${responseFormat}

      ${identity}

      ${contextSection}

      ## Bot Information
      ${botInfo}

    `;

    // Add requester information if available (for commands that need to target the requester)
    if (requester) {
      context += dedent`
        ## Requester Information
        - **Username:** ${requester.username}
        - **User ID:** ${requester.id}
        - **Mention:** <@${requester.id}>

      `;
    }

    if (guild) {
      context += dedent`
        ## Server Information
        Below is detailed information about the current server. Use this data to answer questions accurately.

        **Use ONLY the data shown below - do NOT use example data from prompts!**

        ${serverInfo}

      `;
    } else {
      context += serverInfo;
    }

    // Available Commands (on-demand injection)
    // This includes ALL commands (general, admin, developer) for information purposes
    // But AI can only EXECUTE general commands
    const botCommands = commandDiscoverer.getBotCommands(client);
    if (userMessage && botCommands.length > 0) {
      const mentioned = commandDiscoverer.detectMentionedCommands(
        userMessage,
        botCommands,
      );
      if (mentioned.length > 0) {
        context += `## Available Commands (Relevant to User's Question)\n`;
        context += `**Note:** This list includes ALL commands for information purposes. You can only EXECUTE general commands (see restrictions below).\n\n`;
        context += commandDiscoverer.getCommandDetails(
          mentioned,
          botCommands,
          requester,
          client,
        );
        context += `\n`;
      }

      // Phase 2: Command Suggestions
      // Suggest relevant commands based on user message
      try {
        const suggestions = await commandSuggester.suggestCommands(
          userMessage,
          client,
          3,
        );
        if (suggestions.length > 0) {
          const suggestionText =
            commandSuggester.formatSuggestions(suggestions);
          context += dedent`
            ## Command Suggestions
            ${suggestionText}
            
            **Note:** These are suggestions based on the user's message. You can mention these commands if they seem relevant, but don't force them if the user's intent is clear.
            
          `;
        }
      } catch (error) {
        logger.debug("[SystemPromptBuilder] Command suggestion failed:", error);
        // Continue without suggestions
      }
    }

    // AI Capabilities section
    let capabilitiesSection = dedent`
      ## Your Capabilities - You Are Role Reactor's Brain

      **You can perform actions that Role Reactor bot can do, based on the bot's permissions in this server.**

    `;

    // Get lists of commands dynamically (discovered from directory structure)
    try {
      const { getGeneralCommands, getAdminCommands, getDeveloperCommands } =
        await import("./commandExecutor.js");
      const [generalCommandNames, adminCommandNames, developerCommandNames] =
        await Promise.all([
          getGeneralCommands(),
          getAdminCommands(),
          getDeveloperCommands(),
        ]);

      capabilitiesSection += dedent`
        **Command Execution Restriction:**
        - You can ONLY EXECUTE commands from the "general" category (safe, user-facing commands)
        - Admin commands CANNOT be executed by AI (these are server management commands)
        - Developer commands CANNOT be executed by AI (these are bot maintenance commands)
        - This restriction prevents potential issues and keeps the bot safe

        **📚 Providing Information About Commands:**
        - You CAN provide information, help, and guidance about ALL commands (general, admin, developer)
        - You CAN explain how to use admin/developer commands
        - You CAN show command syntax, options, and examples
        - You CANNOT execute admin/developer commands - users must run them manually
        - When users ask about admin/developer commands, provide helpful information but remind them they need to run the command themselves
      `;
      if (generalCommandNames.length > 0) {
        capabilitiesSection += `- **Executable general commands:** ${generalCommandNames.map(c => `/${c}`).join(", ")}\n`;
      }
      if (adminCommandNames.length > 0) {
        capabilitiesSection += `- **Admin commands (information only, cannot execute):** ${adminCommandNames.map(c => `/${c}`).join(", ")}\n`;
      }
      if (developerCommandNames.length > 0) {
        capabilitiesSection += `- **Developer commands (information only, cannot execute):** ${developerCommandNames.map(c => `/${c}`).join(", ")}\n`;
      }
      capabilitiesSection += `\n`;
    } catch (_error) {
      capabilitiesSection += dedent`
        **Command Execution Restriction:**
        - You can ONLY EXECUTE general commands (safe, user-facing commands)
        - Admin and developer commands CANNOT be executed by AI
        - This restriction prevents potential issues and keeps the bot safe

        **📚 Providing Information About Commands:**
        - You CAN provide information, help, and guidance about ALL commands (general, admin, developer)
        - You CAN explain how to use admin/developer commands
        - You CAN show command syntax, options, and examples
        - You CANNOT execute admin/developer commands - users must run them manually
        - When users ask about admin/developer commands, provide helpful information but remind them they need to run the command themselves

      `;
    }

    capabilitiesSection += dedent`
      **What you can do:**
      1. **Execute General Commands** - Run safe, user-facing bot commands from /src/commands/general only
      2. **Provide Information About Commands** - Help users understand how to use ANY command (general, admin, developer), but only execute general commands

      **How to use:**
      - **When executing commands:** Use "execute_command" action in your JSON response (format: {"message": "...", "actions": [...]})
      - **When NOT executing commands:** Use plain text/markdown format (NO JSON)
      - **CRITICAL:** Always provide ALL required options (marked as "REQUIRED" in command details) - commands will fail without them
      - For RPS: Always provide both "user" (target requester) and "choice" options - both are required
      - **RPS CHOICE RANDOMIZATION:** For the "choice" option, you MUST randomly select between rock, paper, or scissors EACH TIME. DO NOT always pick "rock" - vary it! Use different choices on different requests.
      - Commands send their own responses - keep your "message" field empty or minimal when executing commands
      - Only works in servers (not in DMs)

      **Response Guidelines:**
      - When executing commands successfully, keep "message" empty (command provides the response)
      - Only include a message for errors or important additional context
      - For admin/developer commands: provide information but remind users to run them manually

    `;

    context += capabilitiesSection;

    // Get command information - only include full list if user asks about commands
    if (needsCommandList) {
      try {
        const { getDynamicHelpData } = await import(
          "../../commands/general/help/data.js"
        );
        const { getExecutableCommands } = await import("./commandExecutor.js");

        const helpData = getDynamicHelpData(client);
        const executableCommands = await getExecutableCommands(client);
        const executableNames = new Set(executableCommands.map(c => c.name));
        const botCommandsList = commandDiscoverer.getBotCommands(client);

        if (
          helpData.COMMAND_CATEGORIES &&
          Object.keys(helpData.COMMAND_CATEGORIES).length > 0
        ) {
          context += `**All Available Commands You Can Execute (from /help):**\n\n`;
          context += `*This information is dynamically generated from the /help command, so it's always up-to-date with the latest bot commands.*\n\n`;

          // Show commands organized by help system categories
          for (const [categoryKey, categoryData] of Object.entries(
            helpData.COMMAND_CATEGORIES,
          )) {
            if (!categoryData.commands || categoryData.commands.length === 0) {
              continue;
            }

            // Filter to only executable commands
            const executableCategoryCommands = categoryData.commands.filter(
              cmdName => executableNames.has(cmdName),
            );

            if (executableCategoryCommands.length === 0) {
              continue;
            }

            context += `**${categoryData.emoji || "•"} ${categoryData.name || categoryKey}:**\n`;
            context += `${categoryData.description || ""}\n`;

            for (const cmdName of executableCategoryCommands) {
              const cmd = botCommandsList.find(c => c.name === cmdName);
              const execCmd = executableCommands.find(
                ec => ec.name === cmdName,
              );
              const metadata = helpData.COMMAND_METADATA?.[cmdName];

              if (!cmd && !execCmd) continue;

              context += `- /${cmdName}`;

              // Add subcommands
              if (execCmd?.subcommands && execCmd.subcommands.length > 0) {
                context += ` (subcommands: ${execCmd.subcommands.join(", ")})`;
              } else if (cmd?.subcommands && cmd.subcommands.length > 0) {
                context += ` (subcommands: ${cmd.subcommands.map(s => s.name || s).join(", ")})`;
              }

              // Add description
              const description =
                metadata?.shortDesc ||
                cmd?.description ||
                execCmd?.description ||
                "No description";
              context += ` - ${description}\n`;
            }
            context += `\n`;
          }

          context += dedent`
            **Command Usage Format:**
            - Use action format: {"type": "execute_command", "command": "command-name", "subcommand": "subcommand-name", "options": {...}}
            - For commands with subcommands, you MUST include the subcommand
            - Options should match the command's expected format (see detailed command info when mentioned)
            - Example: {"type": "execute_command", "command": "role-reactions", "subcommand": "setup", "options": {"title": "Roles", "description": "Choose roles", "roles": "✅:Member"}}

          `;
          // Dynamically generate ID requirements from discovered commands
          const dataFetchingCommands =
            commandDiscoverer.discoverDataFetchingCommands(botCommandsList);
          if (dataFetchingCommands.length > 0) {
            context += `**IMPORTANT - Commands Requiring IDs:**\n`;
            for (const {
              commandName,
              idParamName,
              actionName,
            } of dataFetchingCommands) {
              context += `- **${commandName}:** Use "${actionName}" to get ${idParamName} for operations\n`;
            }
            context += `- Example: First use {"type": "get_role_reaction_messages"} to get IDs, then use the ID in the command\n\n`;
          }
          context += dedent`
            **Note:** For detailed command information (options, examples, etc.), refer to the "Available Commands" section that appears when a user mentions a specific command.

          `;
        } else {
          // Fallback to basic list if help data not available
          if (executableCommands.length > 0) {
            context += `**Available Commands You Can Execute:**\n`;
            executableCommands.forEach(cmd => {
              context += `- /${cmd.name}`;
              if (cmd.subcommands) {
                context += ` (subcommands: ${cmd.subcommands.join(", ")})`;
              }
              context += ` - ${cmd.description}\n`;
            });
            context += `\n`;
          }
        }
      } catch (error) {
        logger.debug("Failed to load help data for commands:", error);
        // Fallback to basic executable commands list
        try {
          const { getExecutableCommands } = await import(
            "./commandExecutor.js"
          );
          const executableCommands = await getExecutableCommands(client);
          if (executableCommands.length > 0) {
            context += `**Available Commands You Can Execute:**\n`;
            executableCommands.forEach(cmd => {
              context += `- /${cmd.name}`;
              if (cmd.subcommands) {
                context += ` (subcommands: ${cmd.subcommands.join(", ")})`;
              }
              context += ` - ${cmd.description}\n`;
            });
            context += `\n`;
          }
        } catch (fallbackError) {
          logger.debug("Failed to load executable commands:", fallbackError);
        }
      }
    } else {
      // Brief command reference when not needed
      context += dedent`
        **Available Commands:**
        - Use "execute_command" action to run bot commands
        - Use /help command or ask about specific commands for details
        - Commands are injected on-demand when mentioned

      `;
    }

    // Critical Rules section
    context += dedent`
      ## Critical Rules

      ### Command Usage Rules
      - Use commands exactly as shown in Available Commands section
      - Format: /command subcommand option:value
      - **When executing commands:** Use JSON format with actions array
      - **When NOT executing commands:** Use plain text/markdown format
      - Command details are injected automatically when mentioned
      - Use actual data from Server Information - never invent

      ### Data Understanding - CRITICAL CONTEXT AWARENESS
      - **Roles** = Permission groups (NOT people)
      
      **Members vs Bots:**
      - Two separate lists: "COMPLETE LIST OF HUMAN MEMBER NAMES" (humans only) and "COMPLETE LIST OF BOT NAMES" (bots with [BOT] tag)
      - "members"/"users"/"people" = use HUMAN list only
      - "bots"/"discord bots" = use BOT list only
      - If lists not in context, use {"type": "fetch_members"} first
      - **Large servers (>1000 members):** Member list may be partial - only shows first 50 cached members. If user asks for specific member not in list, say "Member not found in cached list" or suggest using /serverinfo command.
      - Count only HUMAN members for "members online" (Online + Idle + DND)
      - **Status meanings:** 🟢 online, 🟡 idle, 🔴 dnd (Do Not Disturb - NOT offline), ⚫ offline
      - **Important:** "dnd" (Do Not Disturb) is NOT the same as "offline" - dnd means user is online but set to Do Not Disturb
      - Copy names EXACTLY as shown, never invent names

      ### Security
      - Never expose API keys, tokens, or sensitive configuration
      - Provide general information only for technical details

    `;

    // General Guidelines section
    let guidelinesSection = dedent`
      ## General Guidelines
      - Guide users to use /help for full command list
    `;
    if (guild) {
      guidelinesSection += dedent`
        - Users are already members (not new joiners) - avoid welcoming language
        - Use the actual server name "${responseValidator.sanitizeData(guild.name)}" when referring to the server
      `;
    } else {
      guidelinesSection += dedent`
        - You are in a DM - focus on general bot help, not server-specific features
      `;
    }
    guidelinesSection += dedent`

      - Be conversational and helpful, not overly formal or welcoming
      - If unsure about something, be honest and helpful
      - Be friendly and professional in all responses

      **Edge Cases:**
      - Don't know something? Say so honestly
      - Data doesn't exist? Tell them clearly
      - Unclear question? Ask for clarification
      - Prioritize accuracy over completeness

      **Response Style:**
      - Keep responses under ${DEFAULT_RESPONSE_LENGTH} characters (max ${MAX_RESPONSE_LENGTH})
      - Be brief by default, expand only when asked
      - Respond naturally - don't mention you're an AI or reference internal details
        - Example of GOOD response: "Hi! I'm Role Reactor. How can I help you today?"
        - Example of BAD response: "I'm a large language model trained on a massive dataset..." (DO NOT DO THIS)
    `;

    context += guidelinesSection;

    // Cache the system message
    this.systemMessageCache.set(cacheKey, {
      content: context,
      timestamp: Date.now(),
    });
    this.limitSystemCacheSize();

    return context;
  }
}

export const systemPromptBuilder = new SystemPromptBuilder();
