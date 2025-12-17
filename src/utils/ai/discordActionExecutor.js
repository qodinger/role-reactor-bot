/* eslint-disable camelcase */
import { PermissionFlagsBits } from "discord.js";
import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Discord Action Executor - Allows AI to perform Discord operations
 * All actions are checked against bot permissions before execution
 */
export class DiscordActionExecutor {
  /**
   * Check if bot has required permission
   * @param {import('discord.js').GuildMember} botMember - Bot's guild member
   * @param {bigint} permission - Permission flag to check
   * @returns {boolean} True if bot has permission
   */
  hasPermission(botMember, permission) {
    if (!botMember) return false;
    return botMember.permissions.has(permission);
  }

  /**
   * Execute a Discord action
   * @param {Object} action - Action object from AI
   * @param {import('discord.js').Guild} guild - Discord guild
   * @param {import('discord.js').Channel} channel - Discord channel
   * @param {import('discord.js').User} user - User who requested the action
   * @param {import('discord.js').Client} client - Discord client
   * @returns {Promise<Object>} Action result
   */
  async executeAction(action, guild, channel, user, client) {
    if (!guild) {
      return {
        success: false,
        error: "Actions can only be performed in servers, not DMs",
      };
    }

    const botMember = guild.members.me;
    if (!botMember) {
      return {
        success: false,
        error: "Bot member not found in server",
      };
    }

    try {
      switch (action.type) {
        case "execute_command":
          return await this.executeCommand(
            action,
            guild,
            channel,
            user,
            client,
          );

        case "send_message":
          return await this.sendMessage(action, channel, botMember);

        case "add_role":
          return await this.addRole(action, guild, botMember);

        case "remove_role":
          return await this.removeRole(action, guild, botMember);

        case "kick_member":
          return await this.kickMember(action, guild, botMember);

        case "ban_member":
          return await this.banMember(action, guild, botMember);

        case "timeout_member":
          return await this.timeoutMember(action, guild, botMember);

        case "warn_member":
          return await this.warnMember(action, guild, channel, user, client);

        case "delete_message":
          return await this.deleteMessage(action, channel, botMember);

        case "pin_message":
          return await this.pinMessage(action, channel, botMember);

        case "unpin_message":
          return await this.unpinMessage(action, channel, botMember);

        case "create_channel":
          return await this.createChannel(action, guild, botMember);

        case "delete_channel":
          return await this.deleteChannel(action, guild, botMember);

        case "modify_channel":
          return await this.modifyChannel(action, guild, botMember);

        default:
          return {
            success: false,
            error: `Unknown action type: ${action.type}`,
          };
      }
    } catch (error) {
      logger.error(`Failed to execute action ${action.type}:`, error);
      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  /**
   * Execute a bot command
   */
  async executeCommand(action, guild, channel, user, client) {
    const { command, subcommand, options = {} } = action;

    if (!command) {
      return { success: false, error: "Command name is required" };
    }

    try {
      // Import command executor
      const { executeCommandProgrammatically } = await import(
        "./commandExecutor.js"
      );

      const result = await executeCommandProgrammatically({
        commandName: command,
        subcommand,
        options,
        user,
        guild,
        channel,
        client,
      });

      return {
        success: true,
        result: result.response || "Command executed successfully",
        command,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to execute command",
      };
    }
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(action, channel, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.SendMessages)) {
      return {
        success: false,
        error: "Bot lacks SendMessages permission",
      };
    }

    const { content, embed } = action.options || {};

    if (!content && !embed) {
      return { success: false, error: "Message content or embed required" };
    }

    try {
      const messageOptions = {};
      if (content) messageOptions.content = content;
      if (embed) messageOptions.embeds = [embed];

      const message = await channel.send(messageOptions);
      return {
        success: true,
        result: `Message sent: ${message.id}`,
        messageId: message.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to send message",
      };
    }
  }

  /**
   * Add role to member
   */
  async addRole(action, guild, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.ManageRoles)) {
      return {
        success: false,
        error: "Bot lacks ManageRoles permission",
      };
    }

    const { user_id, role_id, role_name } = action.options || {};

    if (!user_id && !role_id && !role_name) {
      return {
        success: false,
        error: "user_id and role_id or role_name required",
      };
    }

    try {
      const member = await guild.members.fetch(user_id);
      let role = null;

      if (role_id) {
        role = guild.roles.cache.get(role_id);
      } else if (role_name) {
        role = guild.roles.cache.find(
          r => r.name.toLowerCase() === role_name.toLowerCase(),
        );
      }

      if (!role) {
        return { success: false, error: "Role not found" };
      }

      // Check if bot can manage this role
      if (role.position >= botMember.roles.highest.position) {
        return {
          success: false,
          error: "Bot cannot manage roles higher than its own",
        };
      }

      await member.roles.add(role);
      return {
        success: true,
        result: `Added role ${role.name} to ${member.user.tag}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to add role",
      };
    }
  }

  /**
   * Remove role from member
   */
  async removeRole(action, guild, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.ManageRoles)) {
      return {
        success: false,
        error: "Bot lacks ManageRoles permission",
      };
    }

    const { user_id, role_id, role_name } = action.options || {};

    if (!user_id && !role_id && !role_name) {
      return {
        success: false,
        error: "user_id and role_id or role_name required",
      };
    }

    try {
      const member = await guild.members.fetch(user_id);
      let role = null;

      if (role_id) {
        role = guild.roles.cache.get(role_id);
      } else if (role_name) {
        role = guild.roles.cache.find(
          r => r.name.toLowerCase() === role_name.toLowerCase(),
        );
      }

      if (!role) {
        return { success: false, error: "Role not found" };
      }

      // Check if bot can manage this role
      if (role.position >= botMember.roles.highest.position) {
        return {
          success: false,
          error: "Bot cannot manage roles higher than its own",
        };
      }

      await member.roles.remove(role);
      return {
        success: true,
        result: `Removed role ${role.name} from ${member.user.tag}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to remove role",
      };
    }
  }

  /**
   * Kick a member
   */
  async kickMember(action, guild, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.KickMembers)) {
      return {
        success: false,
        error: "Bot lacks KickMembers permission",
      };
    }

    const { user_id, reason } = action.options || {};

    if (!user_id) {
      return { success: false, error: "user_id required" };
    }

    try {
      const member = await guild.members.fetch(user_id);

      // Check if target is kickable
      if (!member.kickable) {
        return {
          success: false,
          error: "Cannot kick this member (higher role or owner)",
        };
      }

      await member.kick(reason || "Kicked by AI");
      return {
        success: true,
        result: `Kicked ${member.user.tag}${reason ? `: ${reason}` : ""}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to kick member",
      };
    }
  }

  /**
   * Ban a member
   */
  async banMember(action, guild, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.BanMembers)) {
      return {
        success: false,
        error: "Bot lacks BanMembers permission",
      };
    }

    const { user_id, reason, delete_days } = action.options || {};

    if (!user_id) {
      return { success: false, error: "user_id required" };
    }

    try {
      const member = await guild.members.fetch(user_id).catch(() => null);

      // Check if target is bannable (if member exists)
      if (member && !member.bannable) {
        return {
          success: false,
          error: "Cannot ban this member (higher role or owner)",
        };
      }

      await guild.members.ban(user_id, {
        reason: reason || "Banned by AI",
        deleteMessageDays: delete_days || 0,
      });

      return {
        success: true,
        result: `Banned user ${user_id}${reason ? `: ${reason}` : ""}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to ban member",
      };
    }
  }

  /**
   * Timeout a member
   */
  async timeoutMember(action, guild, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.ModerateMembers)) {
      return {
        success: false,
        error: "Bot lacks ModerateMembers permission",
      };
    }

    const { user_id, duration_seconds, reason } = action.options || {};

    if (!user_id || !duration_seconds) {
      return {
        success: false,
        error: "user_id and duration_seconds required",
      };
    }

    try {
      const member = await guild.members.fetch(user_id);

      // Check if target is moderatable
      if (!member.moderatable) {
        return {
          success: false,
          error: "Cannot timeout this member (higher role or owner)",
        };
      }

      const timeoutUntil = new Date(Date.now() + duration_seconds * 1000);
      await member.timeout(timeoutUntil, reason || "Timed out by AI");

      return {
        success: true,
        result: `Timed out ${member.user.tag} for ${duration_seconds} seconds${reason ? `: ${reason}` : ""}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to timeout member",
      };
    }
  }

  /**
   * Warn a member (uses moderation command)
   */
  async warnMember(action, guild, channel, user, client) {
    const { user_id, reason } = action.options || {};

    if (!user_id) {
      return { success: false, error: "user_id required" };
    }

    // Use moderation command
    return await this.executeCommand(
      {
        command: "moderation",
        subcommand: "warn",
        options: {
          user: user_id,
          reason: reason || "Warned by AI",
        },
      },
      guild,
      channel,
      user,
      client,
    );
  }

  /**
   * Delete a message
   */
  async deleteMessage(action, channel, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.ManageMessages)) {
      return {
        success: false,
        error: "Bot lacks ManageMessages permission",
      };
    }

    const { message_id } = action.options || {};

    if (!message_id) {
      return { success: false, error: "message_id required" };
    }

    try {
      const message = await channel.messages.fetch(message_id);
      await message.delete();
      return {
        success: true,
        result: `Deleted message ${message_id}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to delete message",
      };
    }
  }

  /**
   * Pin a message
   */
  async pinMessage(action, channel, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.ManageMessages)) {
      return {
        success: false,
        error: "Bot lacks ManageMessages permission",
      };
    }

    const { message_id } = action.options || {};

    if (!message_id) {
      return { success: false, error: "message_id required" };
    }

    try {
      const message = await channel.messages.fetch(message_id);
      await message.pin();
      return {
        success: true,
        result: `Pinned message ${message_id}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to pin message",
      };
    }
  }

  /**
   * Unpin a message
   */
  async unpinMessage(action, channel, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.ManageMessages)) {
      return {
        success: false,
        error: "Bot lacks ManageMessages permission",
      };
    }

    const { message_id } = action.options || {};

    if (!message_id) {
      return { success: false, error: "message_id required" };
    }

    try {
      const message = await channel.messages.fetch(message_id);
      await message.unpin();
      return {
        success: true,
        result: `Unpinned message ${message_id}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to unpin message",
      };
    }
  }

  /**
   * Create a channel
   */
  async createChannel(action, guild, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.ManageChannels)) {
      return {
        success: false,
        error: "Bot lacks ManageChannels permission",
      };
    }

    const { name, type, category_id, topic } = action.options || {};

    if (!name) {
      return { success: false, error: "Channel name required" };
    }

    try {
      const options = {};
      if (type) options.type = type; // 0 = text, 2 = voice, etc.
      if (category_id) options.parent = category_id;
      if (topic) options.topic = topic;

      const channel = await guild.channels.create({ name, ...options });
      return {
        success: true,
        result: `Created channel ${channel.name}`,
        channelId: channel.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to create channel",
      };
    }
  }

  /**
   * Delete a channel
   */
  async deleteChannel(action, guild, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.ManageChannels)) {
      return {
        success: false,
        error: "Bot lacks ManageChannels permission",
      };
    }

    const { channel_id } = action.options || {};

    if (!channel_id) {
      return { success: false, error: "channel_id required" };
    }

    try {
      const channel = guild.channels.cache.get(channel_id);
      if (!channel) {
        return { success: false, error: "Channel not found" };
      }

      await channel.delete();
      return {
        success: true,
        result: `Deleted channel ${channel.name}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to delete channel",
      };
    }
  }

  /**
   * Modify a channel
   */
  async modifyChannel(action, guild, botMember) {
    if (!this.hasPermission(botMember, PermissionFlagsBits.ManageChannels)) {
      return {
        success: false,
        error: "Bot lacks ManageChannels permission",
      };
    }

    const { channel_id, name, topic, nsfw, slowmode } = action.options || {};

    if (!channel_id) {
      return { success: false, error: "channel_id required" };
    }

    try {
      const channel = guild.channels.cache.get(channel_id);
      if (!channel) {
        return { success: false, error: "Channel not found" };
      }

      const updateData = {};
      if (name) updateData.name = name;
      if (topic !== undefined) updateData.topic = topic;
      if (nsfw !== undefined) updateData.nsfw = nsfw;
      if (slowmode !== undefined) updateData.rateLimitPerUser = slowmode;

      await channel.edit(updateData);
      return {
        success: true,
        result: `Modified channel ${channel.name}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to modify channel",
      };
    }
  }
}

// Export singleton instance
export const discordActionExecutor = new DiscordActionExecutor();
