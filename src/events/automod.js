import { Events } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { getDatabaseManager } from "../utils/storage/databaseManager.js";
import { getPremiumManager } from "../features/premium/PremiumManager.js";
import { hasAdminPermissions } from "../utils/discord/permissions.js";

const logger = getLogger();

export const name = Events.MessageCreate;

const messageHistory = new Map();

export async function execute(message, client) {
  if (!message || !client) return;

  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    const dbManager = await getDatabaseManager();
    if (!dbManager?.automod) return;

    const settings = await dbManager.automod.getByGuild(guildId);
    if (!settings) return;

    const hasAnyFilterEnabled =
      settings.badWords?.enabled ||
      settings.links?.enabled ||
      settings.spam?.enabled ||
      settings.mentionSpam?.enabled ||
      settings.inviteLink?.enabled;

    if (!hasAnyFilterEnabled) return;

    logger.debug(
      `[Automod] ${message.guild.name}: filters active - badwords:${settings.badWords?.enabled} links:${settings.links?.enabled} spam:${settings.spam?.enabled}`,
    );

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(guildId, "pro_engine");
    const allowedDomains = isPro ? settings.links?.allowedDomains || [] : [];

    const violations = [];

    if (settings.badWords?.enabled && settings.badWords.words?.length > 0) {
      const hasBadWord = settings.badWords.words.some(word =>
        message.content.toLowerCase().includes(word.toLowerCase()),
      );
      if (hasBadWord) {
        violations.push({
          type: "bad_words",
          action: settings.badWords.action,
          duration: settings.badWords.timeoutDuration,
          ignoreAdmins: settings.badWords.ignoreAdmins,
        });
      }
    }

    if (settings.links?.enabled && settings.links.blockUrls) {
      const urlRegex = /(https?:\/\/[^\s]+)/i;
      const hasLink = urlRegex.test(message.content);

      logger.debug(
        `[Automod] Checking links in ${message.guild.name} by ${message.author.tag}: hasLink=${hasLink}, message.content.length=${message.content?.length}, content: |${message.content}|`,
      );

      if (hasLink) {
        const shouldBlock =
          allowedDomains.length === 0
            ? true
            : !containsAllowedDomain(message.content, allowedDomains);

        logger.debug(
          `[Automod] Link detected in ${message.guild.name} by ${message.author.tag}: shouldBlock=${shouldBlock}, allowedDomains=${allowedDomains.length}`,
        );

        if (shouldBlock) {
          violations.push({
            type: "link",
            action: settings.links.action,
            ignoreAdmins: settings.links.ignoreAdmins,
          });
        }
      }
    }

    if (settings.spam?.enabled) {
      const key = `${guildId}:${userId}`;
      if (!messageHistory.has(key)) {
        messageHistory.set(key, []);
      }
      const userMessages = messageHistory.get(key);
      userMessages.push({
        content: message.content,
        time: Date.now(),
      });

      while (
        userMessages.length > 0 &&
        userMessages[0].time < Date.now() - 5000
      ) {
        userMessages.shift();
      }

      if (userMessages.length === 0) {
        messageHistory.delete(key);
      }

      const duplicateCount = userMessages.filter(
        m => m.content === message.content,
      ).length;

      if (duplicateCount >= settings.spam.repeatedMessages) {
        violations.push({
          type: "spam",
          action: settings.spam.action,
          duration: settings.spam.timeoutDuration,
          ignoreAdmins: settings.spam.ignoreAdmins,
        });
      }
    }

    if (settings.mentionSpam?.enabled) {
      const mentions =
        message.mentions.users.size + message.mentions.roles.size;
      if (mentions >= settings.mentionSpam.mentionCount) {
        violations.push({
          type: "mention_spam",
          action: settings.mentionSpam.action,
          duration: settings.mentionSpam.timeoutDuration,
          ignoreAdmins: settings.mentionSpam.ignoreAdmins,
        });
      }
    }

    if (settings.inviteLink?.enabled) {
      const inviteRegex = /(discord\.(gg|com\/invite)\/[\w-]+)/gi;
      const hasInvite = inviteRegex.test(message.content);

      if (hasInvite) {
        violations.push({
          type: "invite_link",
          action: settings.inviteLink.action,
          duration: settings.inviteLink.timeoutDuration,
          ignoreAdmins: settings.inviteLink.ignoreAdmins,
        });
      }
    }

    for (const violation of violations) {
      await handleViolation(message, violation);
    }
  } catch (error) {
    logger.error(`[Automod] Error:`, error);
  }
}

function containsAllowedDomain(message, allowedDomains) {
  try {
    const urlRegex = /https?:\/\/([^\s/]+)/g;
    const match = message.match(urlRegex);

    if (!match) return false;

    for (const url of match) {
      const domain = url
        .replace(/https?:\/\//, "")
        .split("/")[0]
        .toLowerCase();

      for (const allowed of allowedDomains) {
        if (domain === allowed || domain.endsWith("." + allowed)) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

async function handleViolation(message, violation) {
  const { member, author, guild } = message;

  const isAdmin = hasAdminPermissions(member);

  if (violation.ignoreAdmins && isAdmin) {
    await message.delete().catch(() => {});
    try {
      await author.send({
        content: `⚠️ Your message was deleted in ${guild.name} but admins are ignored.`,
      });
    } catch {}
    await logAutomodAction(
      message,
      "Admin ignored - message deleted",
      violation.type,
    );
    return;
  }

  try {
    switch (violation.type) {
      case "bad_words":
        await message.delete().catch(() => {});

        if (violation.action === "timeout") {
          if (member) {
            await member.timeout(
              violation.duration * 60 * 1000,
              "Automod: Bad word detected",
            );
          }
        }

        try {
          await author.send({
            content: `⚠️ Your message was deleted in ${guild.name} for containing inappropriate content.`,
          });
        } catch {}

        await logAutomodAction(message, "Bad word detected", violation.type);
        break;

      case "link":
        await message.delete().catch(() => {});

        if (violation.action === "timeout") {
          if (member) {
            await member.timeout(
              violation.duration * 60 * 1000,
              "Automod: Link detected",
            );
          }
        }

        try {
          await author.send({
            content: `⚠️ Your message was deleted in ${message.guild.name} for containing a link.`,
          });
        } catch {}

        await logAutomodAction(message, "Link detected", violation.type);
        break;

      case "spam":
        await message.delete().catch(() => {});

        if (violation.action === "timeout" && member) {
          await member.timeout(
            violation.duration * 60 * 1000,
            "Automod: Spam detected",
          );
        }

        try {
          await author.send({
            content: `⚠️ Your message was deleted in ${message.guild.name} for spam.`,
          });
        } catch {}

        await logAutomodAction(message, "Spam detected", violation.type);
        break;

      case "mention_spam":
        await message.delete().catch(() => {});

        if (violation.action === "timeout" && member) {
          await member.timeout(
            violation.duration * 60 * 1000,
            "Automod: Mention spam detected",
          );
        }

        try {
          await author.send({
            content: `⚠️ Your message was deleted in ${message.guild.name} for excessive mentions.`,
          });
        } catch {}

        await logAutomodAction(
          message,
          "Mention spam detected",
          violation.type,
        );
        break;

      case "invite_link":
        await message.delete().catch(() => {});

        if (violation.action === "timeout" && member) {
          await member.timeout(
            violation.duration * 60 * 1000,
            "Automod: Invite link detected",
          );
        }

        try {
          await author.send({
            content: `⚠️ Your message was deleted in ${message.guild.name} for posting an invite link.`,
          });
        } catch {}

        await logAutomodAction(message, "Invite link detected", violation.type);
        break;
    }
  } catch (error) {
    logger.error(`[Automod] Error handling violation:`, error);
  }
}

async function logAutomodAction(message, reason, type) {
  try {
    logger.info(
      `[Automod] ${message.guild.name}: ${message.author.tag} - ${reason} (${type})`,
    );
  } catch (error) {
    logger.error(`[Automod] Error logging action:`, error);
  }
}
