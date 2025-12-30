import { ChatInputCommandInteraction } from "discord.js";
import { getLogger } from "../../logger.js";

const logger = getLogger();

/**
 * Create a mock interaction for programmatic command execution
 * @param {Object} params
 * @param {string} params.commandName - Command name
 * @param {string} params.subcommand - Optional subcommand
 * @param {Object} params.options - Command options
 * @param {import('discord.js').User} params.user - User executing the command
 * @param {import('discord.js').Guild} params.guild - Guild where command is executed
 * @param {import('discord.js').Channel} params.channel - Channel where command is executed
 * @param {import('discord.js').Client} params.client - Discord client
 * @param {Object} params.commandConfig - Command configuration (optional)
 * @returns {ChatInputCommandInteraction} Mock interaction
 */
export function createMockInteraction({
  commandName,
  subcommand = null,
  options = {},
  user,
  guild,
  channel,
  client,
  commandConfig = null,
}) {
  // Build options array for Discord.js format
  const optionsArray = [];

  // Helper to resolve user string (ID, mention, or username) to User object (synchronous - cache only)
  const resolveUserSync = userValue => {
    if (!userValue) return null;
    // If already a User object, return it
    if (userValue && typeof userValue === "object" && userValue.id) {
      return userValue;
    }
    // If string, try to resolve from cache
    if (typeof userValue === "string") {
      // Extract user ID from mention format: <@123456789> or <@!123456789>
      const mentionMatch = userValue.match(/<@!?(\d+)>/);
      const userId = mentionMatch ? mentionMatch[1] : userValue;

      // Try to get from cache first
      if (client && client.users.cache.has(userId)) {
        return client.users.cache.get(userId);
      }

      // Try to get from guild member cache
      if (guild) {
        const member = guild.members.cache.get(userId);
        if (member) {
          return member.user;
        }
      }
    }
    return null;
  };

  // Helper to convert value to appropriate type and format
  const convertOptionValue = (name, value) => {
    // Handle arrays - convert to string for commands that expect strings
    if (Array.isArray(value)) {
      // Special handling for role-reactions roles option
      if (name === "roles" && commandName === "role-reactions") {
        // Convert array of role names to emoji:role format
        // If array has single role, use default emoji
        if (value.length === 1) {
          return `✅:${value[0]}`;
        }
        // If multiple roles, use numbered emojis
        const emojis = [
          "1️⃣",
          "2️⃣",
          "3️⃣",
          "4️⃣",
          "5️⃣",
          "6️⃣",
          "7️⃣",
          "8️⃣",
          "9️⃣",
          "🔟",
        ];
        return value
          .map((role, idx) => `${emojis[idx] || "✅"}:${role}`)
          .join(", ");
      }
      // For other arrays, join with commas
      return value.join(", ");
    }
    // Convert other types to string if needed
    if (value === null || value === undefined) {
      return "";
    }
    return String(value);
  };

  if (subcommand) {
    optionsArray.push({
      name: subcommand,
      type: 1, // Subcommand type
      options: Object.entries(options).map(([name, value]) => ({
        name,
        type: 3, // Always string type (Discord.js will handle conversion)
        value: convertOptionValue(name, value),
      })),
    });
  } else {
    // Direct options (no subcommand)
    optionsArray.push(
      ...Object.entries(options).map(([name, value]) => ({
        name,
        type: 3, // Always string type
        value: convertOptionValue(name, value),
      })),
    );
  }

  // Create a minimal mock interaction
  // We'll use the actual ChatInputCommandInteraction but with our data
  // Track the initial message for editReply to work properly
  let initialMessage = null;

  const interaction = {
    id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 2, // ApplicationCommand
    commandName,
    commandType: 1, // ChatInput
    applicationId: client?.user?.id || null,
    user,
    member: guild?.members.cache.get(user.id) || null,
    guild,
    channel,
    client,
    guildId: guild?.id || null,
    channelId: channel?.id || null,
    createdTimestamp: Date.now(),
    replied: false,
    deferred: false,
    _handled: false,
    // Additional properties that commands might check
    isCommand: () => true,
    isContextMenuCommand: () => false,
    isUserContextMenuCommand: () => false,
    isMessageContextMenuCommand: () => false,
    isAutocomplete: () => false,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,
    options: {
      getSubcommand: () => {
        // If command requires subcommands but none provided, throw error (matches Discord.js behavior)
        if (
          !subcommand &&
          commandConfig?.subcommands &&
          commandConfig.subcommands.length > 0
        ) {
          throw new Error("No subcommand provided");
        }
        return subcommand;
      },
      getString: name => {
        const value = options[name];
        // Special handling for role-reactions roles option
        if (
          name === "roles" &&
          commandName === "role-reactions" &&
          Array.isArray(value)
        ) {
          // Convert array of role names to emoji:role format
          const emojis = [
            "✅",
            "🎮",
            "🎨",
            "💻",
            "📚",
            "🎵",
            "🎬",
            "⚽",
            "🏀",
            "🎯",
          ];
          return value
            .map((role, idx) => `${emojis[idx] || "✅"}:${role}`)
            .join(", ");
        }
        // Convert arrays to comma-separated strings (for other cases)
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        // Convert other types to string
        if (value !== undefined && value !== null) {
          return String(value);
        }
        return value;
      },
      getInteger: name => options[name],
      getNumber: name => options[name], // For numeric options
      getBoolean: name => options[name],
      getUser: name => {
        const value = options[name];
        // Resolve user string to User object if needed (from cache only)
        if (value && typeof value === "string") {
          return resolveUserSync(value);
        }
        // If already a User object, return it
        return value;
      },
      getRole: name => options[name],
      getChannel: name => options[name],
      getAttachment: name => options[name], // For file attachments
      getFocused: () => "", // For autocomplete (not used in programmatic execution)
    },
    // Mock reply methods - actually send to channel
    async reply(content) {
      this.replied = true;

      // If we already have a message (from editReply), edit it instead of sending new one
      if (initialMessage && typeof initialMessage.edit === "function") {
        try {
          return await initialMessage.edit(content);
        } catch (error) {
          // If edit fails, send a new one
          logger.debug(
            `[mockInteraction] Failed to edit message in reply(), sending new one:`,
            error.message,
          );
          initialMessage = null;
        }
      }

      // Send new message if no initial message exists
      if (channel && typeof channel.send === "function") {
        const message = await channel.send(content);
        if (!initialMessage) {
          initialMessage = message; // Store for future edits
        }
        return message;
      }
      return { id: `mock_reply_${Date.now()}` };
    },
    async deferReply(_options) {
      this.deferred = true;
      // For deferred replies, we'll send when editReply is called
      return { id: `mock_defer_${Date.now()}` };
    },
    async editReply(content) {
      // If we have an initial message, edit it instead of sending a new one
      if (initialMessage && typeof initialMessage.edit === "function") {
        try {
          return await initialMessage.edit(content);
        } catch (error) {
          // If edit fails (e.g., message deleted), send a new one
          logger.debug(
            `[mockInteraction] Failed to edit message, sending new one:`,
            error.message,
          );
          initialMessage = null; // Reset so next call sends new message
        }
      }

      // Send new message if no initial message exists
      if (channel && typeof channel.send === "function") {
        const message = await channel.send(content);
        if (!initialMessage) {
          initialMessage = message; // Store for future edits
        }
        return message;
      }
      return { id: `mock_edit_${Date.now()}` };
    },
    async followUp(content) {
      // Actually send follow-up message to the channel
      if (channel && typeof channel.send === "function") {
        return await channel.send(content);
      }
      return { id: `mock_followup_${Date.now()}` };
    },
    isRepliable: () => true,
    isChatInputCommand: () => true,
  };

  // Make it look like a real ChatInputCommandInteraction
  Object.setPrototypeOf(interaction, ChatInputCommandInteraction.prototype);

  return interaction;
}
