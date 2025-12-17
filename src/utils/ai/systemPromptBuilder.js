import dedent from "dedent";
import { getLogger } from "../logger.js";
import { responseValidator } from "./responseValidator.js";
import { commandDiscoverer } from "./commandDiscoverer.js";
import { serverInfoGatherer } from "./serverInfoGatherer.js";
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
   * @param {Function} getBotCommands - Function to get bot commands
   * @param {Function} discoverDataFetchingCommands - Function to discover data fetching commands
   * @param {Function} discoverDiscordActions - Function to discover Discord actions
   * @param {Function} generateCommandExample - Function to generate command example
   * @param {Function} generateActionExample - Function to generate action example
   * @returns {Promise<string>} Response format section
   */
  async buildResponseFormatSection(
    guild,
    client,
    getBotCommands,
    discoverDataFetchingCommands,
    discoverDiscordActions,
    generateCommandExample,
    generateActionExample,
  ) {
    const actionsList = await this.buildDynamicActionsList(
      guild,
      client,
      getBotCommands,
      discoverDataFetchingCommands,
      discoverDiscordActions,
    );
    const examples = await this.buildResponseFormatExamples(
      guild,
      client,
      generateCommandExample,
      generateActionExample,
    );

    return dedent`
      ## Response Format - CRITICAL REQUIREMENT

      **🚨 YOU MUST ALWAYS RESPOND IN VALID JSON FORMAT - NO EXCEPTIONS! 🚨**

      **Your response MUST be a valid JSON object with this EXACT structure:**
      {
        "message": "Your response text here",
        "actions": []
      }

      **CRITICAL RULES - FOLLOW THESE EXACTLY:**
      1. **ALWAYS** start your response with { and end with }
      2. **NEVER** send plain text - it will cause errors
      3. **NEVER** use markdown code blocks (no \`\`\`json)
      4. **ALWAYS** include both "message" and "actions" fields
      5. **ALWAYS** use double quotes for strings
      6. Use ACTUAL data from Server Information above - never use placeholders
      7. The "message" field is what the user will see
      8. The "actions" array is for requesting data or executing commands (empty array [] if not needed)

      **⚠️ REMEMBER: If you respond with plain text instead of JSON, the bot will fail!**

      **EXAMPLE OF CORRECT FORMAT:**
      {
        "message": "Hello! How can I help you?",
        "actions": []
      }

      **EXAMPLE OF INCORRECT FORMAT (DO NOT DO THIS):**
      Hello! How can I help you?

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
  async buildDynamicActionsList(
    guild,
    client,
    getBotCommands,
    discoverDataFetchingCommands,
    discoverDiscordActions,
  ) {
    let actionsList = `**Data Fetching Actions:**\n`;
    actionsList += `- "fetch_members" - Get all members\n`;
    actionsList += `- "fetch_channels" - Get all channels\n`;
    actionsList += `- "fetch_roles" - Get all roles\n`;
    actionsList += `- "get_member_info" - Get member details (options: "user_id" or "username")\n`;
    actionsList += `- "get_role_info" - Get role details (options: "role_name" or "role_id")\n`;
    actionsList += `- "get_channel_info" - Get channel details (options: "channel_name" or "channel_id")\n`;
    actionsList += `- "search_members_by_role" - Find members with role (options: "role_name" or "role_id")\n`;

    // Dynamically discover and add data fetching actions for commands that need IDs
    const botCommands = getBotCommands(client);
    const dataFetchingCommands = discoverDataFetchingCommands(botCommands);
    for (const { actionName, description } of dataFetchingCommands) {
      actionsList += `- "${actionName}" - ${description}\n`;
    }

    actionsList += `\n`;

    if (guild) {
      actionsList += `**Command Execution:**\n`;
      try {
        const { getExecutableCommands } = await import("./commandExecutor.js");
        const executableCommands = await getExecutableCommands(client);
        if (executableCommands.length > 0) {
          actionsList += `- "execute_command" - Execute any bot command (command, subcommand, options)\n`;
          actionsList += `  Available commands: ${executableCommands.map(c => `/${c.name}`).join(", ")}\n`;
        }
      } catch (_error) {
        // Ignore
      }
      actionsList += `\n`;

      actionsList += `**Discord Operations (based on bot permissions):**\n`;
      // Dynamically discover Discord actions from discordActionExecutor
      const discordOperations = await discoverDiscordActions();
      for (const action of discordOperations) {
        actionsList += `- "${action.name}" - ${action.description}\n`;
      }
      actionsList += `\n`;

      actionsList += `**Important:** All actions check bot permissions automatically. If bot lacks permission, action will fail with an error message.\n\n`;
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
  async buildResponseFormatExamples(
    guild,
    client,
    generateCommandExample,
    generateActionExample,
  ) {
    const commandExample = await generateCommandExample(client);
    const actionExample = await generateActionExample();

    let examples = dedent`
      **Examples (use ACTUAL data from Server Information above, not placeholders):**

      **Example 1 - Simple response:**
      {
        "message": "There are 5 members in this server.",
        "actions": []
      }

      **Example 2 - List members (use names from member list above):**
      {
        "message": "Here are all members:\\n1. MemberName1\\n2. MemberName2\\n3. MemberName3",
        "actions": []
      }

      **Example 3 - Request data:**
      {
        "message": "Let me fetch the member list.",
        "actions": [{"type": "fetch_members"}]
      }

      **Example 4 - Get member info:**
      {
        "message": "Let me get information about that user.",
        "actions": [{"type": "get_member_info", "options": {"username": "actual_username"}}]
      }

    `;

    if (commandExample) {
      examples += dedent`
        **Example 5 - Execute command:**
        ${commandExample}

      `;
    }

    if (actionExample) {
      examples += dedent`
        **Example 6 - Discord action:**
        ${actionExample}

      `;
    }

    examples += dedent`
      **Example 7 - Multiple actions:**
      {
        "message": "I'll add the role and send a welcome message.",
        "actions": [
          {"type": "add_role", "options": {"user_id": "123456789", "role_name": "Member"}},
          {"type": "send_message", "options": {"content": "Welcome to the server!"}}
        ]
      }

    `;

    return examples;
  }

  /**
   * Discover Discord actions from the executor
   * Uses a static list that matches the executor's switch statement
   * @returns {Promise<Array<{name: string, description: string}>>} Array of action descriptions
   */
  async discoverDiscordActions() {
    // Action descriptions - matches discordActionExecutor.js switch statement
    // When new actions are added to the executor, add them here
    const actionDescriptions = {
      send_message: 'Send a message (options: "content" or "embed")',
      add_role:
        'Add role to member (options: "user_id", "role_id" or "role_name")',
      remove_role:
        'Remove role from member (options: "user_id", "role_id" or "role_name")',
      kick_member: 'Kick a member (options: "user_id", optional: "reason")',
      ban_member:
        'Ban a member (options: "user_id", optional: "reason", "delete_days")',
      timeout_member:
        'Timeout a member (options: "user_id", "duration_seconds", optional: "reason")',
      warn_member: 'Warn a member (options: "user_id", optional: "reason")',
      delete_message: 'Delete a message (options: "message_id")',
      pin_message: 'Pin a message (options: "message_id")',
      unpin_message: 'Unpin a message (options: "message_id")',
      create_channel:
        'Create a channel (options: "name", optional: "type", "category_id", "topic")',
      delete_channel: 'Delete a channel (options: "channel_id")',
      modify_channel:
        'Modify a channel (options: "channel_id", optional: "name", "topic", "nsfw", "slowmode")',
    };

    // Return all actions as an array
    return Object.keys(actionDescriptions).map(name => ({
      name,
      description: actionDescriptions[name],
    }));
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
    return `{\n  "message": "I'll play Rock Paper Scissors!",\n  "actions": [{"type": "execute_command", "command": "rps", "subcommand": "play", "options": {"choice": "rock"}}]\n}`;
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
   * @returns {Promise<string>} System message with context
   */
  async buildSystemContext(guild, client, userMessage = "", locale = "en-US") {
    const cacheKey = guild ? `guild_${guild.id}` : `dm_global`;
    const cached = this.systemMessageCache.get(cacheKey);

    // Check cache (5 minutes timeout for command updates)
    if (
      cached &&
      Date.now() - cached.timestamp < SYSTEM_MESSAGE_CACHE_TIMEOUT
    ) {
      return cached.content;
    }

    // Determine if we need detailed info based on user message
    const needsMemberList =
      userMessage &&
      (userMessage.toLowerCase().includes("member") ||
        userMessage.toLowerCase().includes("who") ||
        userMessage.toLowerCase().includes("list") ||
        userMessage.toLowerCase().includes("people") ||
        userMessage.toLowerCase().includes("users"));
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
      commandDiscoverer.getBotCommands.bind(commandDiscoverer),
      commandDiscoverer.discoverDataFetchingCommands.bind(commandDiscoverer),
      this.discoverDiscordActions.bind(this),
      this.generateCommandExample.bind(this),
      this.generateActionExample.bind(this),
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

    if (guild) {
      context += dedent`
        ## Server Information
        Below is detailed information about the current server. Use this data to answer questions accurately.

        **⚠️ CRITICAL: Use ONLY the data shown below - do NOT use example data from prompts!**

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
        context += commandDiscoverer.getCommandDetails(mentioned, botCommands);
        context += `\n`;
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
        **⚠️ CRITICAL RESTRICTION - Command Execution:**
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
        **⚠️ CRITICAL RESTRICTION - Command Execution:**
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
      3. **Manage Roles** - Add/remove roles from members (via Discord actions, not commands)
      4. **Moderate** - Kick, ban, timeout, warn members (via Discord actions, not commands)
      5. **Manage Channels** - Create, delete, modify channels (via Discord actions, not commands)
      6. **Manage Messages** - Send, delete, pin, unpin messages (via Discord actions, not commands)
      7. **Fetch Data** - Get server, member, role, channel information

      **How to use:**
      - Include actions in the "actions" array of your JSON response
      - Actions are executed automatically after you respond
      - If an action fails (e.g., missing permission), you'll get an error message
      - You can include multiple actions in one response

      **Important:**
      - All actions check bot permissions automatically
      - Only works in servers (not in DMs)
      - Use actions to help users accomplish their goals
      - If user asks you to do something, use the appropriate action!
      - **For admin/developer commands:** Provide helpful information and guidance, but remind users they need to run the command manually (you cannot execute them)

      **CRITICAL - When Executing Commands:**
      - When you execute a command using "execute_command" action, the command sends its own response directly to the channel
      - DO NOT generate redundant text responses explaining what the command does
      - DO NOT say things like "Let's play...", "Here's...", "I'll execute...", etc. when the command already shows the result
      - Keep your "message" field EMPTY or very minimal when executing commands successfully
      - Only include a message if there's an error or important additional context that the command didn't provide
      - The command's response (embed, buttons, etc.) is already visible to the user - don't repeat it

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
      1. **ONLY use commands/subcommands/options exactly as shown in the Available Commands section above.**
      2. **Do NOT invent command syntax, flags, or parameters that don't exist.**
      3. **All commands use Discord slash command format:** /command subcommand option:value
      4. **If a command has subcommands, you MUST use the subcommand.**
         - Example: Use action {"type": "execute_command", "command": "rps", "subcommand": "play", "options": {"choice": "rock"}}
         - NOT: {"type": "execute_command", "command": "rps", "options": {"choice": "rock"}} (missing subcommand)
      5. **Commands work the same way in ALL servers - they are universal.**
      6. **Use the JSON actions array format** - this is the only supported format

      ### Data Understanding Rules
      **ROLES vs MEMBER NAMES:**
      - **Roles** = Permission groups (Admin, Moderator, etc.) - NOT people
      - **Member names** = Actual usernames from the member lists above
      - When asked for member names, use ONLY the names from the lists above - do NOT make up names

      **MEMBER FILTERING:**
      - **"members" or "human members"** = Use the "COMPLETE LIST OF HUMAN MEMBER NAMES" section (real people only)
      - **"bots" or "bot members"** = Use the "COMPLETE LIST OF BOT NAMES" section (bots only)
      - **"all members" or "everyone"** = List BOTH humans AND bots from both sections
      - If user doesn't specify, default to human members only

      **MEMBER COUNT:**
      - When asked "how many members" (without specifying), use the **Human Members** count (NOT total including bots)
      - When asked "how many bots", use the bot count from the bot list
      - When asked "how many total members", use the total count (humans + bots)

      **ONLINE STATUS - CRITICAL RULES:**
      - When asked "how many are online" or "who is online", use **HUMAN MEMBER** online counts ONLY
      - The "Status Breakdown" shows counts for HUMAN MEMBERS ONLY (Online, Idle, DND, Offline)
      - **DO NOT include bots** when counting "members online" - bots are NOT members
      - If asked "how many members are online", add: Online + Idle + DND (all human members)
      - If asked "how many are online" (specifically online status), use just the "Online" count
      - Example: If Status Breakdown shows "Online: 5 | Idle: 2 | DND: 1", then "members online" = 8 (5+2+1), and "online" = 5
      - **NEVER count bots** in online member counts unless user specifically asks about bots

      **🚨 DATA ACCURACY REQUIREMENTS - CRITICAL:**
      - **NEVER invent, guess, or make up ANY data** - this is a CRITICAL error
      - **ALL examples in this prompt** (like "[ACTUAL_MEMBER_NAME_1]", "[ACTUAL_USERNAME]", "[ACTUAL_ROLE_NAME]", etc.) are PLACEHOLDERS - they are NOT real data, just showing the FORMAT
      - **You MUST use ONLY actual data** from the Server Information section above
      - **NEVER use generic names** like "John", "Alice", "Bob", "Admin", "Moderator", "general", "welcome" unless they ACTUALLY exist in the server
      - **ALWAYS verify data exists** before mentioning it - check the Server Information section
      - **For member names:** Use ONLY names from "COMPLETE LIST OF HUMAN MEMBER NAMES" section - copy them EXACTLY character by character
      - **For roles:** Use ONLY actual role names from the "Server Roles" section (not example names like "Admin")
      - **For channels:** Use ONLY actual channel names from the "Server Channels" section (not example names like "general")
      - **If unsure about data**, say "I don't have that information" or "That doesn't appear to exist in this server" - DO NOT guess
      - **If data is missing or empty**, say so honestly (e.g., "There are no human members in this server") - do NOT invent data
      - **Double-check your response** before sending - ensure every name, role, and channel you mention actually exists in the server data above
      - **Example of CORRECT response**: "I don't see a role named 'Admin' in this server. The available roles are: [list actual roles from Server Information]"
      - **Example of WRONG response**: "The Admin role has 5 members" (when Admin doesn't exist) - DO NOT DO THIS
      - **Example of WRONG response**: "Here are some members: [made-up-name], and other members..." - DO NOT DO THIS

      ### Security Rules
      1. **Never expose:** API keys, tokens, environment variables, or sensitive configuration
      2. **If asked about technical details:** Provide general information only
      3. **You have access to:** Current server data (members, channels, roles)
      4. **You cannot access:** Sensitive bot configuration or private data

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

      **🔍 HANDLING EDGE CASES AND UNKNOWN QUERIES:**
      - **If user asks about something you don't know**: Say "I don't have that information" or "I'm not sure about that" - be honest
      - **If user asks about data that doesn't exist**: Tell them clearly it doesn't exist (e.g., "There's no role named 'X' in this server")
      - **If user asks ambiguous questions**: Ask for clarification or provide what you can determine from available data
      - **If user asks about bot capabilities**: Refer to the /help command or list available commands from the system context
      - **If user asks technical questions about the bot**: Provide general information, but don't expose internal implementation details
      - **If user asks about server settings you can't see**: Say "I don't have access to that information" - don't guess
      - **If data is incomplete or missing**: Acknowledge it honestly (e.g., "The member list shows 0 members" or "I don't have channel information")
      - **If user's question is unclear**: Ask for clarification or provide the most likely interpretation with available data
      - **Always prioritize accuracy over completeness** - it's better to say "I don't know" than to provide incorrect information

      **Response Length & Style:**
      - **Default:** Keep responses under ${DEFAULT_RESPONSE_LENGTH} characters (concise and to the point)
      - **Maximum:** Never exceed ${MAX_RESPONSE_LENGTH} characters (Discord embed limit is 4096, but we use ${MAX_RESPONSE_LENGTH} for safety)
      - **Be brief by default:** Answer questions directly without unnecessary elaboration
      - **Expand only when asked:** Only provide detailed explanations if the user explicitly requests them (e.g., "tell me more", "explain in detail", "give me more information")
      - **Examples:**
        - User: "Hello" → Brief: "Hi! How can I help?" (NOT a long introduction)
        - User: "Tell me about yourself" → Brief: "I'm Role Reactor, an AI assistant for this bot. I can help with questions about the bot or server." (NOT a long explanation about training, capabilities, etc.)
        - User: "Explain how role reactions work in detail" → Can be longer (user explicitly asked for detail)
      - **CRITICAL - Do NOT reveal internal details:**
        - Respond naturally as a helpful assistant - do NOT mention you're an AI, language model, or LLM
        - Do NOT explain your capabilities, training data, or how you work
        - Do NOT reference internal instructions, guidelines, system prompts, or parameters
        - Do NOT say things like "I'm trained on...", "I follow rules...", "I'm a large language model...", "I don't have personal experiences...", etc.
        - Simply help users with their questions in a natural, friendly way
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
