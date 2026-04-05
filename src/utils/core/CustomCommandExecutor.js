import {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { getLogger } from "../logger.js";
import { getCommandRateLimiter } from "../rateLimit/commandRateLimiter.js";

export class CustomCommandExecutor {
  constructor() {
    this.logger = getLogger();
  }

  async execute(interaction) {
    const { getDatabaseManager } = await import(
      "../storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();
    if (!dbManager?.customCommands) return false;

    const command = await dbManager.customCommands.findByNameOrAlias(
      interaction.guildId,
      interaction.commandName,
    );
    if (!command || !command.enabled) return false;

    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const isPremium = await getPremiumManager().isFeatureActive(
      interaction.guildId,
      "pro_engine",
    );
    if (!isPremium) {
      await interaction.reply({
        content:
          "❌ Custom commands require **Pro Engine** to be active in this server.",
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    if (command.allowedChannels && command.allowedChannels.length > 0) {
      if (!command.allowedChannels.includes(interaction.channelId)) {
        await interaction.reply({
          content: "❌ This command cannot be used in this channel.",
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }
    }

    if (command.requiredRoles && command.requiredRoles.length > 0) {
      const member = await interaction.member;
      if (!member) {
        await interaction.reply({
          content: "❌ This command can only be used in a server.",
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }
      const memberRoleIds = member.roles?.cache?.map(r => r.id) ?? [];
      const hasRequiredRole = command.requiredRoles.some(roleId =>
        memberRoleIds.includes(roleId),
      );
      if (!hasRequiredRole) {
        await interaction.reply({
          content: "❌ You don't have the required role to use this command.",
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }
    }

    if (command.cooldown && command.cooldown > 0) {
      const rateLimiter = getCommandRateLimiter();
      const cooldownKey = `custom:${command.commandId}:${interaction.user.id}`;
      const cooldownResult = rateLimiter.checkLimit(
        cooldownKey,
        "custom_cooldown",
        interaction.guildId,
      );
      if (!cooldownResult.allowed) {
        const retryAfterSeconds = Math.ceil(
          (cooldownResult.retryAfter || command.cooldown * 1000) / 1000,
        );
        await interaction.reply({
          content: `⏱️ Please wait **${retryAfterSeconds}s** before using this command again.`,
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }
      await rateLimiter.recordUsage(
        cooldownKey,
        "custom_cooldown",
        interaction.guildId,
        command.cooldown,
      );
    }

    const ephemeral = command.ephemeral ? [MessageFlags.Ephemeral] : [];

    const getOptionValue = (name, type) => {
      const option = interaction.options?.get(name);
      if (!option) return null;
      switch (type) {
        case "user":
          return option.user?.id || option.value;
        case "role":
          return option.role?.id || option.value;
        case "channel":
          return option.channel?.id || option.value;
        case "mentionable":
          return option.value;
        default:
          return option.value;
      }
    };

    const replaceVariables = async (text, member = null) => {
      const guild = interaction.guild;
      const user = interaction.user;
      const channel = interaction.channel;

      let resolvedMember = member;
      if (!resolvedMember && guild) {
        try {
          resolvedMember = await guild.members.fetch(user.id);
        } catch {}
      }

      const optionsData = {};
      if (command.options && Array.isArray(command.options)) {
        for (const opt of command.options) {
          optionsData[opt.name] = getOptionValue(opt.name, opt.type);
        }
      }

      let result = text
        .replace(/\{user\}/g, `<@${user.id}>`)
        .replace(/\{user\.id\}/g, user.id)
        .replace(/\{user\.name\}/g, user.username)
        .replace(/\{user\.tag\}/g, user.tag)
        .replace(/\{server\}/g, guild?.name ?? "this server")
        .replace(/\{server\.id\}/g, guild?.id ?? "")
        .replace(/\{count\}/g, String(guild?.memberCount ?? ""))
        .replace(/\{channel\}/g, channel ? `<#${channel.id}>` : "")
        .replace(/\{channel\.id\}/g, channel?.id ?? "")
        .replace(/\{channel\.name\}/g, channel?.name ?? "")
        .replace(
          /\{user\.joined_at\}/g,
          resolvedMember?.joinedAt
            ? `<t:${Math.floor(resolvedMember.joinedAt.getTime() / 1000)}:R>`
            : "",
        )
        .replace(
          /\{user\.created_at\}/g,
          user.createdAt
            ? `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`
            : "",
        );

      for (const [optName, optValue] of Object.entries(optionsData)) {
        result = result.replace(
          new RegExp(`\\{options\\.${optName}\\}`, "g"),
          optValue || "",
        );
      }

      return result;
    };

    const buildComponents = () => {
      const components = [];

      if (
        command.components?.buttons &&
        command.components.buttons.length > 0
      ) {
        const buttonRow = new ActionRowBuilder();
        for (const btn of command.components.buttons.slice(0, 5)) {
          const buttonStyle =
            {
              primary: ButtonStyle.Primary,
              secondary: ButtonStyle.Secondary,
              success: ButtonStyle.Success,
              danger: ButtonStyle.Danger,
              link: ButtonStyle.Link,
            }[btn.style] || ButtonStyle.Secondary;

          const button = new ButtonBuilder()
            .setLabel(btn.label)
            .setStyle(buttonStyle);

          if (btn.emoji) button.setEmoji(btn.emoji);
          if (btn.url) button.setURL(btn.url);
          if (!btn.url)
            button.setCustomId(
              `cc_${command.commandId}_${btn.label.toLowerCase().replace(/\s+/g, "_")}`,
            );

          buttonRow.addComponents(button);
        }
        components.push(buttonRow);
      }

      if (
        command.components?.selectMenu &&
        command.components.selectMenu.options?.length > 0
      ) {
        const selectRow = new ActionRowBuilder();
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`cc_select_${command.commandId}`)
          .setPlaceholder(
            command.components.selectMenu.placeholder || "Select an option",
          );

        for (const opt of command.components.selectMenu.options.slice(0, 25)) {
          selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(opt.label)
              .setValue(opt.value)
              .setDescription(opt.description || undefined)
              .setEmoji(opt.emoji || undefined),
          );
        }

        selectMenu.setMinValues(command.components.selectMenu.minValues || 1);
        selectMenu.setMaxValues(command.components.selectMenu.maxValues || 1);
        selectRow.addComponents(selectMenu);
        components.push(selectRow);
      }

      return components;
    };

    const getResponseText = () => {
      if (
        command.randomResponse &&
        command.responses &&
        command.responses.length > 0
      ) {
        return command.responses[
          Math.floor(Math.random() * command.responses.length)
        ];
      }
      return command.response;
    };

    if (command.type === "text") {
      const text = await replaceVariables(getResponseText() || "");
      const components = buildComponents();
      await interaction.reply({
        content: text,
        flags: ephemeral,
        ...(components.length > 0 ? { components } : {}),
      });
    } else if (command.type === "embed") {
      const { EmbedBuilder } = await import("discord.js");
      let color = 0x9b8bf0;
      try {
        color = parseInt(
          (command.embed.color ?? "#9b8bf0").replace("#", ""),
          16,
        );
      } catch {}

      const description = await replaceVariables(command.embed.description);
      const title = await replaceVariables(command.embed.title);
      const footer = command.embed.footer
        ? await replaceVariables(command.embed.footer)
        : null;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);

      if (footer) embed.setFooter({ text: footer });

      const components = buildComponents();
      await interaction.reply({
        embeds: [embed],
        flags: ephemeral,
        ...(components.length > 0 ? { components } : {}),
      });
    } else if (command.type === "role") {
      const { roleId, action } = command.role;
      const guild = interaction.guild;

      if (!guild) {
        await interaction.reply({
          content: "❌ This command can only be used in a server.",
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }

      let member;
      try {
        member = await guild.members.fetch(interaction.user.id);
      } catch {
        await interaction.reply({
          content: "❌ Could not retrieve your member data. Please try again.",
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        await interaction.reply({
          content: `❌ The configured role no longer exists. Please ask an admin to update this command.`,
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }

      const hasRole = member.roles.cache.has(roleId);
      const shouldAdd =
        action === "add" ? true : action === "remove" ? false : !hasRole;

      const botMember = guild.members.me;
      if (botMember && role.position >= botMember.roles.highest.position) {
        await interaction.reply({
          content: `❌ I cannot manage the <@&${roleId}> role because it's higher than or equal to my highest role.`,
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }

      try {
        if (shouldAdd) {
          await member.roles.add(role);
        } else {
          await member.roles.remove(role);
        }
      } catch (roleError) {
        this.logger.error("Failed to modify role:", roleError);
        await interaction.reply({
          content: `❌ I don't have permission to manage the <@&${roleId}> role. Please check my role hierarchy.`,
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }

      const defaultMsg = shouldAdd
        ? `✅ You've been given the <@&${roleId}> role!`
        : `✅ The <@&${roleId}> role has been removed.`;

      const confirmText = getResponseText()
        ? await replaceVariables(getResponseText(), member).then(t =>
            t.replace(/\{role\}/g, `<@&${roleId}>`),
          )
        : defaultMsg;

      await interaction.reply({
        content: confirmText,
        flags: ephemeral.length > 0 ? ephemeral : [MessageFlags.Ephemeral],
      });
    } else if (command.type === "dm") {
      let targetUser = interaction.user;

      if (command.dmTarget) {
        const targetUserId = getOptionValue(command.dmTarget, "user");
        if (targetUserId) {
          try {
            targetUser = await interaction.client.users.fetch(targetUserId);
          } catch {
            this.logger.warn(`Could not find DM target user: ${targetUserId}`);
          }
        }
      }

      const text = await replaceVariables(getResponseText() || "");
      try {
        await targetUser.send(text);
        if (ephemeral.length === 0) {
          await interaction.reply({
            content: "📬 Message sent!",
            flags: [MessageFlags.Ephemeral],
          });
        }
      } catch {
        await interaction.reply({
          content:
            "❌ I couldn't send you a DM. Please make sure you have DMs enabled.",
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }
      if (ephemeral.length > 0) {
        await interaction.reply({
          content: "📬 Message sent!",
          flags: ephemeral,
        });
      }
    }

    if (command.actions && command.actions.length > 0) {
      const guild = interaction.guild;
      const member = guild
        ? await guild.members.fetch(interaction.user.id).catch(() => null)
        : null;

      for (const action of command.actions) {
        if (action.type === "role") {
          if (!guild || !member) continue;

          const role = guild.roles.cache.get(action.roleId);
          if (!role) continue;

          const hasRole = member.roles.cache.has(action.roleId);
          const shouldAdd =
            action.action === "add"
              ? true
              : action.action === "remove"
                ? false
                : !hasRole;

          const botMember = guild.members.me;
          if (botMember && role.position >= botMember.roles.highest.position) {
            this.logger.warn(
              `Multi-action: Cannot modify role ${action.roleId} - role hierarchy issue`,
            );
            continue;
          }

          try {
            if (shouldAdd) {
              await member.roles.add(role);
            } else {
              await member.roles.remove(role);
            }
          } catch (actionError) {
            this.logger.error(
              "Failed to execute multi-action role:",
              actionError,
            );
          }
        } else if (action.type === "text" && action.channelId) {
          const targetChannel = guild?.channels.cache.get(action.channelId);
          if (!targetChannel || !targetChannel.isTextBased()) continue;

          const text = await replaceVariables(action.content, member);
          try {
            await targetChannel.send(text);
          } catch (sendError) {
            this.logger.error(
              "Failed to send multi-action message:",
              sendError,
            );
          }
        } else if (action.type === "dm" && action.targetUserId) {
          const dmUserId = getOptionValue(action.targetUserId, "user");
          if (!dmUserId) continue;

          try {
            const dmUser = await interaction.client.users.fetch(dmUserId);
            const text = await replaceVariables(action.content, member);
            await dmUser.send(text);
          } catch (dmError) {
            this.logger.error("Failed to send multi-action DM:", dmError);
          }
        }
      }
    }

    return true;
  }
}
