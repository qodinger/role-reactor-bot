import { Events } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { getDatabaseManager } from "../utils/storage/databaseManager.js";
import { getPremiumManager } from "../features/premium/PremiumManager.js";
import { hasAdminPermissions } from "../utils/discord/permissions.js";
import { detectBadWords } from "../utils/automod/badWordDetector.js";

const logger = getLogger();

export const name = Events.MessageCreate;

const messageHistory = new Map();

// Prune stale spam-tracking entries so the map doesn't grow unbounded
const HISTORY_TTL = 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of messageHistory) {
    const last = entry.messages[entry.messages.length - 1];
    if (!last || now - last.time > HISTORY_TTL) {
      messageHistory.delete(key);
    }
  }
}, HISTORY_TTL).unref();

export async function execute(message, client) {
  if (!message || !client) return;

  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const channelId = message.channel.id;

    const dbManager = await getDatabaseManager();
    if (!dbManager?.automod) return;

    const settings = await dbManager.automod.getByGuild(guildId);
    if (!settings) return;

    if (settings.ignoredRoles?.length > 0) {
      const memberRoles = message.member?.roles?.cache?.map(r => r.id) || [];
      const hasIgnoredRole = memberRoles.some(roleId =>
        settings.ignoredRoles.includes(roleId),
      );
      if (hasIgnoredRole) return;
    }

    if (settings.ignoredChannels?.length > 0) {
      if (settings.ignoredChannels.includes(channelId)) return;
    }

    let activeSettings = { ...settings };
    const channelSettings = await dbManager.automod.getChannelSettings(
      guildId,
      channelId,
    );
    if (channelSettings?.enabled) {
      activeSettings = { ...settings, ...channelSettings };
      logger.debug(
        `[Automod] Using channel-specific settings for #${message.channel.name}`,
      );
    }

    const hasAnyFilterEnabled =
      activeSettings.badWords?.enabled ||
      activeSettings.links?.enabled ||
      activeSettings.spam?.enabled ||
      activeSettings.mentionSpam?.enabled ||
      activeSettings.inviteLink?.enabled ||
      activeSettings.capsLock?.enabled;

    if (!hasAnyFilterEnabled) return;

    logger.debug(
      `[Automod] ${message.guild.name}: filters active - badwords:${activeSettings.badWords?.enabled} links:${activeSettings.links?.enabled} spam:${activeSettings.spam?.enabled} mentions:${activeSettings.mentionSpam?.enabled} invites:${activeSettings.inviteLink?.enabled} caps:${activeSettings.capsLock?.enabled}`,
    );

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(guildId, "pro_engine");
    const allowedDomains = isPro
      ? activeSettings.links?.allowedDomains || []
      : [];

    const violations = [];

    if (activeSettings.badWords?.enabled) {
      const mode = settings.badWords.mode || "simple";
      logger.debug(`[Automod] Checking badwords: mode=${mode}`);

      const hasBadWord = detectBadWords(message.content, {
        mode,
        words: settings.badWords.words,
        wildcardWords: settings.badWords.wildcardWords,
        regexPatterns: settings.badWords.regexPatterns,
        advancedWords: settings.badWords.advancedWords,
      });

      logger.debug(`[Automod] Checking badwords: hasBadWord=${hasBadWord}`);

      if (hasBadWord) {
        violations.push({
          type: "bad_words",
          action: activeSettings.badWords.action,
          duration: activeSettings.badWords.timeoutDuration,
          ignoreAdmins: activeSettings.badWords.ignoreAdmins,
        });
      }
    }

    if (activeSettings.links?.enabled && activeSettings.links.blockUrls) {
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
            action: activeSettings.links.action,
            duration: activeSettings.links.timeoutDuration,
            ignoreAdmins: activeSettings.links.ignoreAdmins,
          });
        }
      }
    }

    if (activeSettings.spam?.enabled) {
      const key = `${guildId}:${userId}`;
      if (!messageHistory.has(key)) {
        messageHistory.set(key, {
          messages: [],
          recentCount: 0,
        });
      }
      const userData = messageHistory.get(key);
      const now = Date.now();

      userData.messages.push({
        content: message.content,
        time: now,
      });

      userData.recentCount++;

      logger.debug(
        `[Automod] Checking spam: queued messages=${userData.messages.length}, recentCount=${userData.recentCount}`,
      );

      while (
        userData.messages.length > 0 &&
        userData.messages[0].time < now - 5000
      ) {
        userData.messages.shift();
      }

      if (userData.messages.length === 0) {
        userData.recentCount = 0;
      }

      const duplicateCount = userData.messages.filter(
        m => m.content === message.content,
      ).length;

      if (duplicateCount >= activeSettings.spam.repeatedMessages) {
        violations.push({
          type: "spam",
          action: activeSettings.spam.action,
          duration: activeSettings.spam.timeoutDuration,
          ignoreAdmins: activeSettings.spam.ignoreAdmins,
        });
        logger.debug(
          `[Automod] Spam triggered: duplicateCount=${duplicateCount}`,
        );
      }

      if (userData.recentCount >= (activeSettings.spam.rateThreshold || 5)) {
        violations.push({
          type: "spam",
          action: activeSettings.spam.action,
          duration: activeSettings.spam.timeoutDuration,
          ignoreAdmins: activeSettings.spam.ignoreAdmins,
        });
        logger.debug(
          `[Automod] Rate limit triggered: recentCount=${userData.recentCount}, threshold=${activeSettings.spam.rateThreshold || 5}`,
        );
        userData.recentCount = 0;
      }
    }

    if (activeSettings.mentionSpam?.enabled) {
      const mentions =
        message.mentions.users.size + message.mentions.roles.size;
      logger.debug(
        `[Automod] Checking mentions: count=${mentions}, threshold=${activeSettings.mentionSpam.mentionCount}`,
      );
      if (mentions >= activeSettings.mentionSpam.mentionCount) {
        violations.push({
          type: "mention_spam",
          action: activeSettings.mentionSpam.action,
          duration: activeSettings.mentionSpam.timeoutDuration,
          ignoreAdmins: activeSettings.mentionSpam.ignoreAdmins,
        });
      }
    }

    if (activeSettings.inviteLink?.enabled) {
      const inviteRegex = /(discord\.(gg|com\/invite)\/[\w-]+)/gi;
      const hasInvite = inviteRegex.test(message.content);
      logger.debug(`[Automod] Checking invites: hasInvite=${hasInvite}`);

      if (hasInvite) {
        violations.push({
          type: "invite_link",
          action: activeSettings.inviteLink.action,
          duration: activeSettings.inviteLink.timeoutDuration,
          ignoreAdmins: activeSettings.inviteLink.ignoreAdmins,
        });
      }
    }

    if (activeSettings.capsLock?.enabled) {
      const content = message.content;
      const threshold = activeSettings.capsLock.threshold || 70;
      const minLength = activeSettings.capsLock.minLength || 10;

      if (content.length >= minLength) {
        const letters = content.replace(/[^a-zA-Z]/g, "");
        const caps = content.replace(/[^A-Z]/g, "");

        if (letters.length > 0) {
          const capsPercentage = (caps.length / letters.length) * 100;
          logger.debug(
            `[Automod] Checking caps: capsPercentage=${capsPercentage.toFixed(1)}%, threshold=${threshold}`,
          );

          if (capsPercentage >= threshold) {
            violations.push({
              type: "caps_lock",
              action: activeSettings.capsLock.action,
              duration: activeSettings.capsLock.timeoutDuration,
              ignoreAdmins: activeSettings.capsLock.ignoreAdmins,
            });
          }
        }
      }
    }

    for (const violation of violations) {
      await handleViolation(message, violation, dbManager, guildId);
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

async function handleViolation(message, violation, dbManager, guildId) {
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
      dbManager,
      guildId,
    );
    return;
  }

  try {
    await message.delete().catch(() => {});

    const violationReason = getViolationReason(violation.type);

    const actions = Array.isArray(violation.action)
      ? violation.action
      : [violation.action];

    for (const action of actions) {
      switch (action) {
        case "timeout":
          if (member) {
            await member.timeout(
              (violation.duration || 5) * 60 * 1000,
              `Automod: ${violationReason}`,
            );
          }
          break;

        case "kick":
          if (member) {
            await member.kick(`Automod: ${violationReason}`);
          }
          break;

        case "ban":
          if (member) {
            await member.ban({
              reason: `Automod: ${violationReason}`,
              deleteMessageSeconds: 24 * 60 * 60,
            });
          }
          break;
      }
    }

    try {
      const dmMessage = getDmMessage(violation.type, guild.name, actions);
      await author.send({ content: dmMessage });
    } catch {}

    await logAutomodAction(
      message,
      violationReason,
      violation.type,
      dbManager,
      guildId,
    );
  } catch (error) {
    logger.error(`[Automod] Error handling violation:`, error);
  }
}

function getViolationReason(type) {
  const reasons = {
    bad_words: "Bad word detected",
    link: "Link detected",
    spam: "Spam detected",
    mention_spam: "Mention spam detected",
    invite_link: "Invite link detected",
    caps_lock: "Excessive caps",
  };
  return reasons[type] || "Automod violation";
}

function getDmMessage(type, guildName, actions) {
  const messages = {
    bad_words: `⚠️ Your message was deleted in ${guildName} for containing inappropriate content.`,
    link: `⚠️ Your message was deleted in ${guildName} for containing a link.`,
    spam: `⚠️ Your message was deleted in ${guildName} for spam.`,
    mention_spam: `⚠️ Your message was deleted in ${guildName} for excessive mentions.`,
    invite_link: `⚠️ Your message was deleted in ${guildName} for posting an invite link.`,
    caps_lock: `⚠️ Your message was deleted in ${guildName} for excessive caps.`,
  };

  let msg = messages[type] || `⚠️ Your message was deleted in ${guildName}.`;

  if (actions.includes("timeout")) {
    msg += " You have been timed out.";
  }
  if (actions.includes("kick")) {
    msg += " You have been kicked.";
  }
  if (actions.includes("ban")) {
    msg += " You have been banned.";
  }

  return msg;
}

async function logAutomodAction(message, reason, type, dbManager, guildId) {
  try {
    logger.info(
      `[Automod] ${message.guild.name}: ${message.author.tag} - ${reason} (${type})`,
    );

    if (dbManager?.automod && guildId) {
      await dbManager.automod.recordViolation(guildId, {
        userId: message.author.id,
        userTag: message.author.tag,
        channelId: message.channel.id,
        channelName: message.channel.name,
        type,
        reason,
        timestamp: new Date(),
      });
    }
  } catch (error) {
    logger.error(`[Automod] Error logging action:`, error);
  }
}
