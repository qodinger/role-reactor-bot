import { Events } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { getDatabaseManager } from "../utils/storage/databaseManager.js";
import { getPremiumManager } from "../features/premium/PremiumManager.js";

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
    if (!settings || !settings.enabled) return;

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
        });
      }
    }

    if (settings.links?.enabled && settings.links.blockUrls) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const hasLink = urlRegex.test(message.content);

      if (hasLink) {
        const shouldBlock =
          allowedDomains.length === 0
            ? true
            : !containsAllowedDomain(message.content, allowedDomains);

        if (shouldBlock) {
          violations.push({
            type: "link",
            action: settings.links.action,
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

      const duplicateCount = userMessages.filter(
        m => m.content === message.content,
      ).length;

      if (duplicateCount >= settings.spam.repeatedMessages) {
        violations.push({
          type: "spam",
          action: settings.spam.action,
          duration: settings.spam.timeoutDuration,
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
  const { member, author } = message;

  try {
    switch (violation.type) {
      case "bad_words":
        await message.delete().catch(() => {});

        if (violation.action === "warn" || violation.action === "timeout") {
          if (member) {
            await member.timeout(
              violation.duration * 1000,
              "Automod: Bad word detected",
            );
          }
        }

        try {
          await author.send({
            content: `⚠️ Your message was deleted in ${message.guild.name} for containing inappropriate content.`,
          });
        } catch {}

        await logAutomodAction(message, "Bad word detected", violation.type);
        break;

      case "link":
        await message.delete().catch(() => {});

        try {
          await author.send({
            content: `⚠️ Your message was deleted in ${message.guild.name} for containing a link.`,
          });
        } catch {}

        await logAutomodAction(message, "Link detected", violation.type);
        break;

      case "spam":
        if (violation.action === "timeout" && member) {
          await member.timeout(
            violation.duration * 1000,
            "Automod: Spam detected",
          );
        }

        await logAutomodAction(message, "Spam detected", violation.type);
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
