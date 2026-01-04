import dedent from "dedent";
import { getLogger } from "../logger.js";
// Simple inline response validator (replaces deleted responseValidator)
const responseValidator = {
  sanitizeData: data => {
    if (typeof data !== "string") return data;
    return data.replace(/[<>@#&]/g, "").trim();
  },
  validateResponseData: (_response, _guild) => {
    return { valid: true, warnings: [] };
  },
};
import { commandDiscoverer } from "./commandDiscoverer.js";
import { serverInfoGatherer } from "./serverInfoGatherer.js";
import { commandSuggester } from "./commandSuggester.js";
import { buildIdentitySection } from "./promptSections/identitySection.js";
import { buildContextSection } from "./promptSections/contextSection.js";
import { buildResponseFormatSection } from "./promptSections/responseFormatSection.js";
import {
  SYSTEM_MESSAGE_CACHE_TIMEOUT,
  MAX_SYSTEM_CACHE_SIZE,
  MAX_RESPONSE_LENGTH,
  DEFAULT_RESPONSE_LENGTH,
} from "./constants.js";

const logger = getLogger();

// Load chat prompts directly
import { CHAT_PROMPTS } from "../../config/prompts/chat/index.js";

async function getChatPrompts() {
  return CHAT_PROMPTS || {};
}

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
    return buildIdentitySection();
  }

  /**
   * Build context section of system prompt
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client (optional, for permission checking)
   * @returns {string} Context section
   */
  buildContextSection(guild, client = null) {
    return buildContextSection(guild, client);
  }

  /**
   * Build response format section of system prompt
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Client} client - Discord client
   * @param {Function} generateCommandExample - Function to generate command example (deprecated, kept for compatibility)
   * @returns {Promise<string>} Response format section
   */
  async buildResponseFormatSection(
    guild,
    client,
    _generateCommandExample = null,
  ) {
    return buildResponseFormatSection(guild, client);
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
    let baseContext = null;
    if (
      cached &&
      Date.now() - cached.timestamp < SYSTEM_MESSAGE_CACHE_TIMEOUT &&
      !forceIncludeMemberList
    ) {
      baseContext = cached.content;
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

    // Get server info (needed for both cached and fresh contexts)
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

    // Use cached base context if available, otherwise build it
    let context = baseContext;
    if (!context) {
      // Build system prompt sections
      const responseFormat = await this.buildResponseFormatSection(
        guild,
        client,
      );
      const identity = this.buildIdentitySection();
      const contextSection = this.buildContextSection(guild);
      const botInfo = await serverInfoGatherer.getBotInfo(client);

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

      context = dedent`
        # Role Reactor Bot

        [Current Date and Time for User: ${userDateTime}]

        ${responseFormat}

        ${identity}

        ${contextSection}

        ## Bot Information
        ${botInfo}

      `;
    } else {
      // Update date/time in cached context
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
      context = context.replace(
        /\[Current Date and Time for User: .*?\]/,
        `[Current Date and Time for User: ${userDateTime}]`,
      );
    }

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
    // Always include ALL commands so AI has complete understanding
    const botCommands = commandDiscoverer.getBotCommands(client);
    if (userMessage && botCommands.length > 0) {
      const mentioned = commandDiscoverer.detectMentionedCommands(
        userMessage,
        botCommands,
      );
      if (mentioned.length > 0) {
        context += `## Available Commands (Relevant to User's Question)\n`;
        context += `**Note:** This list includes ALL commands for information purposes. You can only EXECUTE general commands (see restrictions below).\n`;
        context += `**IMPORTANT:** All options, subcommands, and details are shown below. Use this information to understand exactly how each command works.\n\n`;
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

    // Bot Capabilities section
    let capabilitiesSection = dedent`
      ## Your Capabilities

      **As Role Reactor bot, you can perform these actions:**

    `;

    // Load chat prompts once for reuse
    const chatPrompts = await getChatPrompts();

    // Get lists of commands dynamically (discovered from directory structure)
    try {
      const { getGeneralCommands, getAdminCommands, getDeveloperCommands } =
        await import("./commandExecutor/commandDiscovery.js");
      const [generalCommandNames, adminCommandNames, developerCommandNames] =
        await Promise.all([
          getGeneralCommands(),
          getAdminCommands(),
          getDeveloperCommands(),
        ]);
      capabilitiesSection +=
        chatPrompts.commandExecutionRestriction ||
        dedent`
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
      // Use main command execution restriction if command discovery fails
      if (chatPrompts.commandExecutionRestriction) {
        capabilitiesSection += chatPrompts.commandExecutionRestriction;
      }
    }

    if (chatPrompts.capabilitiesBase) {
      capabilitiesSection += chatPrompts.capabilitiesBase;
    }

    context += capabilitiesSection;

    // Get command information - only include full list if user asks about commands
    if (needsCommandList) {
      try {
        const { getDynamicHelpData } = await import(
          "../../commands/general/help/data.js"
        );
        const { getExecutableCommands } = await import(
          "./commandExecutor/commandValidator.js"
        );

        const helpData = await getDynamicHelpData(client);
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
            **IMPORTANT - Command Details:**
            - When a user mentions a specific command, you will see a detailed "Available Commands" section with ALL options, subcommands, and examples
            - That section shows COMPLETE information including:
              * All required and optional options
              * All available choices for each option
              * All constraints (min/max values, length limits)
              * All subcommands and their options
              * Usage examples
            - Use that detailed information to understand exactly how each command works
            - Always provide ALL required options when executing commands
            - For commands with choices, use the exact choice values shown in the command details

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
    if (chatPrompts.criticalRules) {
      context += chatPrompts.criticalRules;
    }

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
    const generalGuidelinesBase = chatPrompts.generalGuidelinesBase || "";
    guidelinesSection += dedent`

      ${generalGuidelinesBase}
      - Keep responses under ${DEFAULT_RESPONSE_LENGTH} characters (max ${MAX_RESPONSE_LENGTH})
    `;

    context += guidelinesSection;

    // Cache the system message
    if (!baseContext) {
      // Only cache if we built it fresh (not from cache)
      this.systemMessageCache.set(cacheKey, {
        content: context,
        timestamp: Date.now(),
      });
      this.limitSystemCacheSize();
    }

    return context;
  }
}

export const systemPromptBuilder = new SystemPromptBuilder();
