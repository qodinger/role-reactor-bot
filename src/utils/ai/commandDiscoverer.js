/**
 * Discovers and formats bot commands for AI system prompts
 */
export class CommandDiscoverer {
  /**
   * Format command option for display
   * @param {Object} option - Discord command option
   * @returns {string} Formatted option description
   */
  formatOption(option) {
    const typeMap = {
      1: "subcommand",
      2: "subcommandGroup",
      3: "string",
      4: "integer",
      5: "boolean",
      6: "user",
      7: "channel",
      8: "role",
      9: "mentionable",
      10: "number",
      11: "attachment",
    };

    const type = typeMap[option.type] || `type_${option.type}`;

    // Start with description if available, otherwise use type
    let desc = option.description || `${type} parameter`;

    // Add required/optional indicator
    if (!option.required) {
      desc += " (optional)";
    }

    // Add choices if available (for string/integer/number options)
    // Show ALL choices so AI understands all available options
    if (Array.isArray(option.choices) && option.choices.length > 0) {
      const choices = option.choices
        .map(c => c.name || String(c.value))
        .join(", ");
      desc += ` [choices: ${choices}]`;
    }

    // Add min/max values for numeric types
    if (option.type === 4 || option.type === 10) {
      // Integer or Number
      const constraints = [];
      if (typeof option.minValue === "number") {
        constraints.push(`min: ${option.minValue}`);
      }
      if (typeof option.maxValue === "number") {
        constraints.push(`max: ${option.maxValue}`);
      }
      if (constraints.length > 0) {
        desc += ` [${constraints.join(", ")}]`;
      }
    }

    // Add max length for string options
    if (option.type === 3 && typeof option.maxLength === "number") {
      desc += ` [max length: ${option.maxLength}]`;
    }

    return desc;
  }

  /**
   * Extract subcommand information
   * @param {Object} subcommand - Discord.js subcommand
   * @returns {Object} Formatted subcommand info
   */
  extractSubcommand(subcommand) {
    const info = {
      name: subcommand.name,
      description: subcommand.description || "No description",
      options: [],
    };

    if (subcommand.options) {
      for (const option of subcommand.options) {
        // Subcommands can only contain regular options (types 3-11), not nested subcommands
        if (option.type >= 3) {
          // Regular option (string, integer, boolean, user, channel, role, mentionable, number, attachment)
          info.options.push({
            name: option.name,
            description: this.formatOption(option),
            required: option.required || false,
          });
        }
      }
    }

    return info;
  }

  /**
   * Get bot commands with full structure (subcommands, options) - completely dynamic
   * @param {import('discord.js').Client} client - Discord client
   * @returns {Array} Array of command objects with full structure
   */
  getBotCommands(client) {
    if (!client?.commands) {
      return [];
    }

    const commands = [];
    for (const [name, command] of client.commands.entries()) {
      // Validate command structure
      if (!command || !command.data) {
        continue;
      }

      // Get command data - use toJSON() for reliable structure, fallback to direct access
      let cmdData;
      try {
        // Try toJSON() first (most reliable for SlashCommandBuilder)
        cmdData =
          typeof command.data.toJSON === "function"
            ? command.data.toJSON()
            : command.data;
      } catch (_error) {
        // Fallback to direct property access
        cmdData = command.data;
      }

      // Ensure we have required properties
      const cmdName = cmdData.name || name;
      if (!cmdName) {
        continue; // Skip invalid commands
      }

      const cmdInfo = {
        name: cmdName,
        description: cmdData.description || "No description available",
        subcommands: [],
        options: [],
        defaultMemberPermissions:
          cmdData.default_member_permissions || cmdData.defaultMemberPermissions
            ? "Requires permissions"
            : "Available to all users",
      };

      // Extract subcommands and options
      const options = cmdData.options || [];
      if (Array.isArray(options) && options.length > 0) {
        for (const option of options) {
          // Validate option has required properties
          if (!option || typeof option.type !== "number") {
            continue;
          }

          if (option.type === 1) {
            // Subcommand (type 1)
            if (option.name && option.description !== undefined) {
              cmdInfo.subcommands.push(this.extractSubcommand(option));
            }
          } else if (option.type === 2) {
            // Subcommand group (type 2)
            if (option.name) {
              const group = {
                name: option.name,
                description: option.description || "No description",
                subcommands: [],
              };
              const groupOptions = option.options || [];
              if (Array.isArray(groupOptions)) {
                for (const subcmd of groupOptions) {
                  if (subcmd && subcmd.type === 1 && subcmd.name) {
                    group.subcommands.push(this.extractSubcommand(subcmd));
                  }
                }
              }
              if (group.subcommands.length > 0) {
                cmdInfo.subcommands.push(group);
              }
            }
          } else if (option.type >= 3 && option.type <= 11) {
            // Regular option (types 3-11: string, integer, boolean, user, channel, role, mentionable, number, attachment)
            if (option.name) {
              cmdInfo.options.push({
                name: option.name,
                description: this.formatOption(option),
                required: option.required || false,
              });
            }
          }
          // Ignore unknown types (future Discord API additions)
        }
      }

      commands.push(cmdInfo);
    }

    return commands.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Detect which commands are mentioned in user message
   * @param {string} userMessage - User's message
   * @param {Array} allCommands - All available commands
   * @returns {Array} Array of relevant command names
   */
  detectMentionedCommands(userMessage, allCommands) {
    const messageLower = userMessage.toLowerCase();
    const mentioned = [];

    for (const cmd of allCommands) {
      // Check if command name is mentioned
      if (messageLower.includes(cmd.name.toLowerCase())) {
        mentioned.push(cmd.name);
        continue;
      }

      // Check common aliases/terms
      const aliases = {
        rps: ["rock paper scissors", "rock-paper-scissors", "rps game"],
        poll: ["poll", "vote", "voting", "survey"],
        avatar: ["avatar", "profile picture", "pfp"],
        ping: ["ping", "latency", "response time"],
        help: ["help", "commands", "what can you do"],
        serverinfo: ["server info", "server information", "guild info"],
        userinfo: ["user info", "user information", "who is"],
        level: ["level", "xp", "experience", "rank"],
        leaderboard: ["leaderboard", "top", "ranking"],
        wyr: ["would you rather", "wyr"],
        "8ball": ["8ball", "magic 8", "fortune"],
      };

      if (aliases[cmd.name]) {
        for (const alias of aliases[cmd.name]) {
          if (messageLower.includes(alias)) {
            mentioned.push(cmd.name);
            break;
          }
        }
      }
    }

    return [...new Set(mentioned)]; // Remove duplicates
  }

  /**
   * Dynamically discover commands that need data fetching (commands with ID-requiring subcommands)
   * @param {Array} allCommands - All available commands
   * @returns {Array} Array of {commandName, idParamName, actionName, description}
   */
  discoverDataFetchingCommands(allCommands) {
    const idPatterns = [
      {
        pattern: /message[-_]?id/i,
        actionPrefix: "get_role_reaction_messages",
      },
      { pattern: /schedule[-_]?id/i, actionPrefix: "get_scheduled_roles" },
      { pattern: /poll[-_]?id/i, actionPrefix: "get_polls" },
      { pattern: /case[-_]?id/i, actionPrefix: "get_moderation_history" },
    ];

    const commandsNeedingData = [];
    const seenActions = new Set();

    for (const cmd of allCommands) {
      // Check all subcommands for ID-requiring options
      for (const subcmd of cmd.subcommands || []) {
        const subcmdName = subcmd.name || subcmd;
        const subcmdOptions = subcmd.options || [];

        // Check if this subcommand requires an ID parameter
        for (const option of subcmdOptions) {
          const optionName = option.name || "";
          const optionDesc = option.description || "";

          // Look for ID patterns in option name or description
          for (const { pattern, actionPrefix } of idPatterns) {
            if (pattern.test(optionName) || pattern.test(optionDesc)) {
              // Check if this is an update/delete/view/cancel/end operation
              const isIdRequiringOperation = [
                "update",
                "delete",
                "view",
                "cancel",
                "end",
                "remove",
              ].includes(subcmdName.toLowerCase());

              if (isIdRequiringOperation && !seenActions.has(actionPrefix)) {
                seenActions.add(actionPrefix);
                commandsNeedingData.push({
                  commandName: cmd.name,
                  idParamName: optionName,
                  actionName: actionPrefix,
                  description: this.getDataFetchingDescription(
                    cmd.name,
                    actionPrefix,
                  ),
                });
                break; // Found ID requirement for this command
              }
            }
          }
        }
      }
    }

    return commandsNeedingData;
  }

  /**
   * Get description for data fetching action
   * @param {string} commandName - Command name
   * @param {string} actionName - Action name
   * @returns {string} Description
   */
  getDataFetchingDescription(commandName, actionName) {
    const descriptions = {
      get_role_reaction_messages:
        "Get all existing role reaction messages (returns message IDs needed for updates)",
      get_scheduled_roles:
        "Get all scheduled roles (returns schedule IDs needed for view/cancel/delete)",
      get_polls:
        "Get all polls in server (returns poll IDs needed for end/delete)",
      get_moderation_history:
        "Get moderation history (returns case IDs needed for remove-warn)",
    };

    return (
      descriptions[actionName] ||
      `Get data for ${commandName} command (returns IDs needed for operations)`
    );
  }

  /**
   * Get detailed info for specific commands (on-demand injection)
   * @param {Array} commandNames - Command names to get details for
   * @param {Array} allCommands - All available commands
   * @param {import('discord.js').User} requester - User who asked the question (optional)
   * @param {import('discord.js').Client} client - Discord client (optional, for bot info)
   * @returns {string} Formatted command details
   */
  getCommandDetails(
    commandNames,
    allCommands,
    _requester = null,
    _client = null,
  ) {
    if (commandNames.length === 0) return "";

    const commands = allCommands.filter(cmd => commandNames.includes(cmd.name));

    if (commands.length === 0) return "";

    let details = "\n**Relevant Commands (Complete Details):**\n";
    details +=
      "**IMPORTANT:** The information below shows ALL options, subcommands, choices, and constraints for each command. Use this to understand exactly how each command works.\n\n";

    const formatCommand = cmd => {
      let formatted = `/${cmd.name}: ${cmd.description}`;

      if (cmd.subcommands && cmd.subcommands.length > 0) {
        formatted += "\n  Subcommands:";
        for (const subcmd of cmd.subcommands) {
          if (subcmd.subcommands && subcmd.subcommands.length > 0) {
            // Subcommand group
            formatted += `\n    ${subcmd.name} (group):`;
            for (const nestedSubcmd of subcmd.subcommands) {
              formatted += `\n      - /${cmd.name} ${subcmd.name} ${nestedSubcmd.name}: ${nestedSubcmd.description}`;
              if (nestedSubcmd.options && nestedSubcmd.options.length > 0) {
                // Show ALL options with full details
                const optionDetails = nestedSubcmd.options
                  .map(o => {
                    const formattedOpt = this.formatOption(o);
                    let optStr = o.name;
                    // Mark required options clearly
                    if (o.required !== false) {
                      optStr = `**${optStr}** (REQUIRED)`;
                    } else {
                      optStr = `${optStr} (optional)`;
                    }
                    // Add full description with all details
                    optStr += ` - ${formattedOpt}`;
                    return optStr;
                  })
                  .join("\n        ");
                formatted += `\n        Options:\n        ${optionDetails}`;
              }
            }
          } else {
            // Regular subcommand
            formatted += `\n    - /${cmd.name} ${subcmd.name}: ${subcmd.description}`;
            if (subcmd.options && subcmd.options.length > 0) {
              // Show ALL options with full details
              const optionDetails = subcmd.options
                .map(o => {
                  const formattedOpt = this.formatOption(o);
                  let optStr = o.name;
                  // Mark required options clearly
                  if (o.required !== false) {
                    optStr = `**${optStr}** (REQUIRED)`;
                  } else {
                    optStr = `${optStr} (optional)`;
                  }
                  // Add full description with all details (choices, constraints, etc.)
                  optStr += ` - ${formattedOpt}`;
                  return optStr;
                })
                .join("\n      ");
              formatted += `\n      Options:\n      ${optionDetails}`;
            }
            // Add example usage for common commands
            if (subcmd.name === "play" && cmd.name === "rps") {
              formatted += `\n      Example: /${cmd.name} ${subcmd.name} choice:rock`;
            } else if (subcmd.name === "challenge" && cmd.name === "rps") {
              formatted += `\n      Example: /${cmd.name} ${subcmd.name} user:@someone choice:paper`;
            } else if (subcmd.name === "list" && cmd.name === "poll") {
              formatted += `\n      Example: /${cmd.name} ${subcmd.name} page:1 show-ended:false`;
            } else if (subcmd.name === "create" && cmd.name === "poll") {
              formatted += `\n      Example: /${cmd.name} ${subcmd.name} (opens interactive form)`;
            }
          }
        }
      } else if (cmd.options && cmd.options.length > 0) {
        // Show ALL options with full details - AI needs to see everything
        const optionDetails = cmd.options
          .map(o => {
            // Use formatOption to get full description with required/optional, choices, constraints
            const formattedOpt = this.formatOption(o);
            let optStr = o.name;
            // Mark required options clearly
            if (o.required !== false) {
              optStr = `**${optStr}** (REQUIRED)`;
            } else {
              optStr = `${optStr} (optional)`;
            }
            // Add full description with all details (no truncation)
            optStr += ` - ${formattedOpt}`;
            return optStr;
          })
          .join("\n  ");
        formatted += `\n  Options:\n  ${optionDetails}`;
        // Add examples for commands with direct options
        if (cmd.name === "ask") {
          formatted += `\n  Example: /${cmd.name} question:Explain quantum computing in technical terms`;
        } else if (cmd.name === "avatar") {
          formatted += `\n  Example: /${cmd.name} prompt:"cyberpunk hacker" art_style:modern`;
        } else if (cmd.name === "leaderboard") {
          formatted += `\n  Example: /${cmd.name} limit:10 type:xp`;
        } else if (cmd.name === "8ball") {
          formatted += `\n  Example: /${cmd.name} question:"Will it rain today?"`;
        } else if (cmd.name === "rps") {
          // Special guidance for RPS command
          // When user wants to play, the BOT should challenge the requester
          // The bot executes the command, targeting the requester as the challenged user
          // This creates a challenge with buttons for the requester to respond
          if (_requester) {
            // Show ALL three choices in examples to demonstrate variety
            formatted += `\n  Examples (MUST vary - show all three choices):`;
            formatted += `\n    /${cmd.name} user:<@${_requester.id}> choice:rock`;
            formatted += `\n    /${cmd.name} user:<@${_requester.id}> choice:paper`;
            formatted += `\n    /${cmd.name} user:<@${_requester.id}> choice:scissors`;
            formatted += `\n  **REQUIRED:** You MUST provide both "user" and "choice" options.`;
            formatted += `\n  - When user wants to play, the BOT challenges the requester (<@${_requester.id}> or @${_requester.username})`;
            formatted += `\n  - The "user" option should target the requester (the person who asked)`;
            formatted += `\n  - **CRITICAL FOR CHOICE:** You MUST randomly select between rock, paper, or scissors EACH TIME`;
            formatted += `\n  - **DO NOT** always pick "rock" - you MUST vary it randomly each request`;
            formatted += `\n  - Pick a DIFFERENT choice each time: sometimes rock, sometimes paper, sometimes scissors`;
            formatted += `\n  - This creates a challenge with buttons - the requester will choose their move`;
          } else {
            // Show ALL three choices in examples to demonstrate variety
            formatted += `\n  Examples (MUST vary - show all three choices):`;
            formatted += `\n    /${cmd.name} user:@username choice:rock`;
            formatted += `\n    /${cmd.name} user:@username choice:paper`;
            formatted += `\n    /${cmd.name} user:@username choice:scissors`;
            formatted += `\n  **REQUIRED:** You MUST provide both "user" and "choice" options.`;
            formatted += `\n  - When user wants to play, the BOT challenges the requester (from Requester Information)`;
            formatted += `\n  - **CRITICAL FOR CHOICE:** You MUST randomly select between rock, paper, or scissors EACH TIME`;
            formatted += `\n  - **DO NOT** always pick "rock" - you MUST vary it randomly each request`;
            formatted += `\n  - Pick a DIFFERENT choice each time: sometimes rock, sometimes paper, sometimes scissors`;
            formatted += `\n  - This creates a challenge with buttons - the challenged user will choose their move`;
          }
        }
      }

      return formatted;
    };

    for (const cmd of commands) {
      details += `${formatCommand(cmd)}\n`;
    }

    return details;
  }
}

export const commandDiscoverer = new CommandDiscoverer();
