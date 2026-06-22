import { EmbedBuilder } from "discord.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import {
  successEmbed,
  errorEmbed,
} from "../../../utils/discord/responseMessages.js";
import { getPremiumManager } from "../../../features/premium/PremiumManager.js";
import { THEME } from "../../../config/theme.js";
import { getMentionableCommand } from "../../../utils/commandUtils.js";
import { createAutomodSettingsEmbed } from "./embeds.js";
import { createAutomodSettingsComponents } from "./components.js";

export async function handleEnable(interaction, settings) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    badWords: { ...settings.badWords, enabled: true },
    links: { ...settings.links, enabled: true },
    spam: { ...settings.spam, enabled: true },
    mentionSpam: { ...settings.mentionSpam, enabled: true },
    inviteLink: { ...settings.inviteLink, enabled: true },
  });

  const response = successEmbed({
    title: "Auto-Mod Enabled",
    description: "All filters are now active!",
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleDisable(interaction, settings) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    badWords: { ...settings.badWords, enabled: false },
    links: { ...settings.links, enabled: false },
    spam: { ...settings.spam, enabled: false },
    mentionSpam: { ...settings.mentionSpam, enabled: false },
    inviteLink: { ...settings.inviteLink, enabled: false },
  });

  const response = successEmbed({
    title: "Auto-Mod Disabled",
    description: "All filters have been disabled.",
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleSettings(interaction, settings) {
  const premiumManager = getPremiumManager();
  const isPro = await premiumManager.isFeatureActive(
    interaction.guild.id,
    "pro_engine",
  );

  const embed = createAutomodSettingsEmbed(
    settings,
    isPro,
    interaction.guild.name,
    interaction.client,
  );
  const components = createAutomodSettingsComponents(settings);

  return interaction.reply({
    embeds: [embed],
    components,
    ephemeral: true,
  });
}

export async function handleBadwordsToggle(interaction, settings) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const badwordsSettings = { ...settings.badWords, enabled };

  if (action !== null) {
    badwordsSettings.action = action;
  }
  if (timeoutDuration !== null) {
    badwordsSettings.timeoutDuration = timeoutDuration;
  }
  if (ignoreAdmins !== null) {
    badwordsSettings.ignoreAdmins = ignoreAdmins;
  }

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    badWords: badwordsSettings,
  });

  const parts = [];
  parts.push(`Bad words filter ${enabled ? "enabled" : "disabled"}`);
  if (action !== null) {
    parts.push(`action: ${action}`);
  }
  if (timeoutDuration !== null) {
    parts.push(`timeout: ${timeoutDuration}min`);
  }
  if (ignoreAdmins !== null) {
    parts.push(`ignore-admins: ${ignoreAdmins ? "yes" : "no"}`);
  }

  const response = successEmbed({
    title: "Bad Words Filter Updated",
    description: parts.join(" | "),
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleBadwordsAdvanced(interaction, settings) {
  const { options, guildId } = interaction;

  const premiumManager = getPremiumManager();
  const { isPro, response: proResponse } =
    await premiumManager.checkProAndRespond(
      interaction,
      "Advanced bad words (wildcards/regex)",
    );

  if (!isPro) {
    return interaction.reply({ ...proResponse, ephemeral: true });
  }

  const mode = options.getString("mode");
  const wordsInput = options.getString("words");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");

  const badwordsSettings = { ...settings.badWords };

  if (mode) {
    badwordsSettings.mode = mode;
  }
  if (wordsInput) {
    const words = wordsInput
      .split(",")
      .map(w => w.trim())
      .filter(w => w);
    if (mode === "wildcard") {
      badwordsSettings.wildcardWords = words;
    } else if (mode === "regex") {
      badwordsSettings.regexPatterns = words;
    } else {
      badwordsSettings.advancedWords = words;
    }
  }
  if (action !== null) {
    badwordsSettings.action = action;
  }
  if (timeoutDuration !== null) {
    badwordsSettings.timeoutDuration = timeoutDuration;
  }

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    badWords: badwordsSettings,
  });

  const parts = [];
  parts.push(`Advanced mode: ${mode || "simple"}`);
  if (wordsInput) {
    parts.push(`words: ${wordsInput}`);
  }
  if (action !== null) {
    parts.push(`action: ${action}`);
  }

  const response = successEmbed({
    title: "Advanced Bad Words Updated (Pro)",
    description: parts.join(" | "),
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleBadwordsWords(interaction, settings) {
  const { options, guildId } = interaction;
  const words = options
    .getString("words")
    .split(",")
    .map(w => w.trim());

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    badWords: { ...settings.badWords, enabled: true, words },
  });

  const response = successEmbed({
    title: "Bad Words Updated",
    description: `Bad words set to: ${words.join(", ")}`,
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleLinksToggle(interaction, settings) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const linksSettings = { ...settings.links, enabled };

  if (action !== null) {
    linksSettings.action = action;
  }
  if (timeoutDuration !== null) {
    linksSettings.timeoutDuration = timeoutDuration;
  }
  if (ignoreAdmins !== null) {
    linksSettings.ignoreAdmins = ignoreAdmins;
  }

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,

    links: linksSettings,
  });

  const parts = [];
  parts.push(`Link filter ${enabled ? "enabled" : "disabled"}`);
  if (action !== null) {
    parts.push(`action: ${action}`);
  }
  if (timeoutDuration !== null) {
    parts.push(`timeout: ${timeoutDuration}min`);
  }
  if (ignoreAdmins !== null) {
    parts.push(`ignore-admins: ${ignoreAdmins ? "yes" : "no"}`);
  }

  const linkResponse = new EmbedBuilder()
    .setTitle("Links Filter Updated")
    .setColor(THEME.SUCCESS)
    .setDescription(
      `Filter ${enabled ? "enabled" : "disabled"}\n` + `${parts.join("\n")}`,
    )
    .setTimestamp();

  if (enabled) {
    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(guildId, "pro_engine");

    if (!isPro) {
      const warnEmbed = new EmbedBuilder()
        .setTitle("Links Filter Warning")
        .setColor(THEME.ERROR)
        .setDescription(
          "⚠️ **All links will be blocked!**\n\n" +
            "Without allowed domains, members cannot share:\n" +
            "• Discord invites\n" +
            "• YouTube videos\n" +
            "• Google links\n\n" +
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
            "**Upgrade to Pro** to whitelist trusted domains\n" +
            "**Or disable** using `/automod links toggle enabled:false`",
        )
        .setTimestamp();

      return interaction.reply({ embeds: [warnEmbed], ephemeral: true });
    }
  }

  return interaction.reply({ embeds: [linkResponse], ephemeral: true });
}

export async function handleSpamToggle(interaction, settings) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");
  const threshold = options.getInteger("threshold");
  const rateThreshold = options.getInteger("rate-threshold");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const spamSettings = { ...settings.spam, enabled };

  if (threshold !== null) {
    spamSettings.repeatedMessages = threshold;
  }
  if (rateThreshold !== null) {
    spamSettings.rateThreshold = rateThreshold;
  }
  if (action !== null) {
    spamSettings.action = action;
  }
  if (timeoutDuration !== null) {
    spamSettings.timeoutDuration = timeoutDuration;
  }
  if (ignoreAdmins !== null) {
    spamSettings.ignoreAdmins = ignoreAdmins;
  }

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,

    spam: spamSettings,
  });

  const parts = [];
  parts.push(`Spam detection ${enabled ? "enabled" : "disabled"}`);
  if (threshold !== null) {
    parts.push(`threshold: ${threshold}`);
  }
  if (action !== null) {
    parts.push(`action: ${action}`);
  }
  if (timeoutDuration !== null) {
    parts.push(`timeout: ${timeoutDuration}min`);
  }
  if (ignoreAdmins !== null) {
    parts.push(`ignore-admins: ${ignoreAdmins ? "yes" : "no"}`);
  }

  const response = successEmbed({
    title: "Spam Detection Updated",
    description: parts.join(" | "),
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleMentionSpamToggle(interaction, settings) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");
  const mentionCount = options.getInteger("mention-count");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const mentionSpamSettings = { ...settings.mentionSpam, enabled };

  if (mentionCount !== null) {
    mentionSpamSettings.mentionCount = mentionCount;
  }
  if (action !== null) {
    mentionSpamSettings.action = action;
  }
  if (timeoutDuration !== null) {
    mentionSpamSettings.timeoutDuration = timeoutDuration;
  }
  if (ignoreAdmins !== null) {
    mentionSpamSettings.ignoreAdmins = ignoreAdmins;
  }

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,

    mentionSpam: mentionSpamSettings,
  });

  const parts = [];
  parts.push(`Mention spam filter ${enabled ? "enabled" : "disabled"}`);
  if (mentionCount !== null) {
    parts.push(`mention count: ${mentionCount}`);
  }
  if (action !== null) {
    parts.push(`action: ${action}`);
  }
  if (timeoutDuration !== null) {
    parts.push(`timeout: ${timeoutDuration}min`);
  }
  if (ignoreAdmins !== null) {
    parts.push(`ignore-admins: ${ignoreAdmins ? "yes" : "no"}`);
  }

  const response = successEmbed({
    title: "Mention Spam Filter Updated",
    description: parts.join(" | "),
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleInviteToggle(interaction, settings) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const inviteSettings = { ...settings.inviteLink, enabled };

  if (action !== null) {
    inviteSettings.action = action;
  }
  if (timeoutDuration !== null) {
    inviteSettings.timeoutDuration = timeoutDuration;
  }
  if (ignoreAdmins !== null) {
    inviteSettings.ignoreAdmins = ignoreAdmins;
  }

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,

    inviteLink: inviteSettings,
  });

  const parts = [];
  parts.push(`Invite link filter ${enabled ? "enabled" : "disabled"}`);
  if (action !== null) {
    parts.push(`action: ${action}`);
  }
  if (timeoutDuration !== null) {
    parts.push(`timeout: ${timeoutDuration}min`);
  }
  if (ignoreAdmins !== null) {
    parts.push(`ignore-admins: ${ignoreAdmins ? "yes" : "no"}`);
  }

  const response = successEmbed({
    title: "Invite Link Filter Updated",
    description: parts.join(" | "),
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleCapsLockToggle(interaction, settings) {
  const { options, guildId } = interaction;

  const premiumManager = getPremiumManager();
  const { isPro, response: proResponse } =
    await premiumManager.checkProAndRespond(interaction, "Caps Lock filter");

  if (!isPro) {
    return interaction.reply({ ...proResponse, ephemeral: true });
  }

  const enabled = options.getBoolean("enabled");
  const threshold = options.getInteger("threshold");
  const minLength = options.getInteger("min-length");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const capsLockSettings = { ...settings.capsLock, enabled };

  if (threshold !== null) {
    capsLockSettings.threshold = threshold;
  }
  if (minLength !== null) {
    capsLockSettings.minLength = minLength;
  }
  if (action !== null) {
    capsLockSettings.action = action;
  }
  if (timeoutDuration !== null) {
    capsLockSettings.timeoutDuration = timeoutDuration;
  }
  if (ignoreAdmins !== null) {
    capsLockSettings.ignoreAdmins = ignoreAdmins;
  }

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    capsLock: capsLockSettings,
  });

  const parts = [];
  parts.push(`Caps lock filter ${enabled ? "enabled" : "disabled"}`);
  if (threshold !== null) {
    parts.push(`threshold: ${threshold}%`);
  }
  if (minLength !== null) {
    parts.push(`min-length: ${minLength}`);
  }
  if (action !== null) {
    parts.push(`action: ${action}`);
  }

  const response = successEmbed({
    title: "Caps Lock Filter Updated (Pro)",
    description: parts.join(" | "),
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleDomainsAdd(interaction, settings) {
  const { options, guildId } = interaction;

  const premiumManager = getPremiumManager();
  const { isPro, response: proResponse } =
    await premiumManager.checkProAndRespond(interaction, "Domain allowlisting");

  if (!isPro) {
    return interaction.reply({ ...proResponse, ephemeral: true });
  }

  const newDomains = options
    .getString("domains")
    .split(",")
    .map(d => d.trim().toLowerCase())
    .filter(d => d.length > 0);

  const currentDomains = settings.links?.allowedDomains || [];
  const combinedDomains = [...new Set([...currentDomains, ...newDomains])];

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    links: { ...settings.links, allowedDomains: combinedDomains },
  });

  const successResponse = successEmbed({
    title: "Domains Added",
    description: `Added domains: ${newDomains.join(", ")}\nAllowed domains: ${combinedDomains.join(", ")}`,
  });

  return interaction.reply({ ...successResponse, ephemeral: true });
}

export async function handleDomainsRemove(interaction, settings) {
  const { options, guildId } = interaction;

  const premiumManager = getPremiumManager();
  const { isPro, response: proResponse } =
    await premiumManager.checkProAndRespond(interaction, "Domain allowlisting");

  if (!isPro) {
    return interaction.reply({ ...proResponse, ephemeral: true });
  }

  const removeDomains = options
    .getString("domains")
    .split(",")
    .map(d => d.trim().toLowerCase());

  const currentDomains = settings.links?.allowedDomains || [];
  const remainingDomains = currentDomains.filter(
    d => !removeDomains.includes(d),
  );

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    links: { ...settings.links, allowedDomains: remainingDomains },
  });

  const successResponse = successEmbed({
    title: "Domains Removed",
    description:
      removeDomains.length > 0
        ? `Removed domains: ${removeDomains.join(", ")}\nAllowed domains: ${remainingDomains.join(", ") || "None"}`
        : "No domains to remove.",
  });

  return interaction.reply({ ...successResponse, ephemeral: true });
}

export async function handleDomainsClear(interaction, settings) {
  const { guildId } = interaction;

  const premiumManager = getPremiumManager();
  const { isPro, response: proResponse } =
    await premiumManager.checkProAndRespond(interaction, "Domain allowlisting");

  if (!isPro) {
    return interaction.reply({ ...proResponse, ephemeral: true });
  }

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    links: { ...settings.links, allowedDomains: [] },
  });

  const successResponse = successEmbed({
    title: "Domains Cleared",
    description: "All allowed domains have been cleared.",
  });

  return interaction.reply({ ...successResponse, ephemeral: true });
}

export async function handleDomainsList(interaction, settings) {
  const premiumManager = getPremiumManager();
  const { isPro, response: proResponse } =
    await premiumManager.checkProAndRespond(interaction, "Domain allowlisting");

  if (!isPro) {
    return interaction.reply({ ...proResponse, ephemeral: true });
  }

  const domains = settings.links?.allowedDomains || [];

  const noDomainsMsg = `No domains in allowlist. Use ${getMentionableCommand(interaction.client, "automod domains add")} to add domains.`;

  return interaction.reply({
    content:
      domains.length > 0
        ? `**Allowed Domains:** ${domains.join(", ")}`
        : noDomainsMsg,
    ephemeral: true,
  });
}

export async function handleAutomodCommand(interaction) {
  const { options, guildId } = interaction;

  const dbManager = await getDatabaseManager();
  if (!dbManager?.automod) {
    const response = errorEmbed({
      title: "Database Error",
      description: "Database error. Please try again.",
    });
    return interaction.reply({ ...response, ephemeral: true });
  }

  const settings = await dbManager.automod.getByGuild(guildId);
  const subcommand = options.getSubcommand();
  const subcommandGroup = options.getSubcommandGroup(false);

  if (subcommand === "settings") {
    return handleSettings(interaction, settings);
  }

  if (subcommand === "enable") {
    return handleEnable(interaction, settings);
  }

  if (subcommand === "disable") {
    return handleDisable(interaction, settings);
  }

  if (subcommandGroup === "badwords") {
    if (subcommand === "toggle") {
      return handleBadwordsToggle(interaction, settings);
    }
    if (subcommand === "words") {
      return handleBadwordsWords(interaction, settings);
    }
    if (subcommand === "mode") {
      return handleBadwordsAdvanced(interaction, settings);
    }
  }

  if (subcommandGroup === "links") {
    if (subcommand === "toggle") {
      return handleLinksToggle(interaction, settings);
    }
  }

  if (subcommandGroup === "spam") {
    if (subcommand === "toggle") {
      return handleSpamToggle(interaction, settings);
    }
  }

  if (subcommandGroup === "mention-spam") {
    if (subcommand === "toggle") {
      return handleMentionSpamToggle(interaction, settings);
    }
  }

  if (subcommandGroup === "invite") {
    if (subcommand === "toggle") {
      return handleInviteToggle(interaction, settings);
    }
  }

  if (subcommandGroup === "caps-lock") {
    if (subcommand === "toggle") {
      return handleCapsLockToggle(interaction, settings);
    }
  }

  if (subcommandGroup === "domains") {
    if (subcommand === "add") {
      return handleDomainsAdd(interaction, settings);
    }
    if (subcommand === "remove") {
      return handleDomainsRemove(interaction, settings);
    }
    if (subcommand === "clear") {
      return handleDomainsClear(interaction, settings);
    }
    if (subcommand === "list") {
      return handleDomainsList(interaction, settings);
    }
  }

  if (subcommandGroup === "channel") {
    if (subcommand === "add") {
      return handleChannelAdd(interaction, settings);
    }
    if (subcommand === "remove") {
      return handleChannelRemove(interaction, settings);
    }
    if (subcommand === "list") {
      return handleChannelList(interaction, settings);
    }
  }

  if (subcommandGroup === "stats") {
    if (subcommand === "show") {
      return handleStatsShow(interaction, settings);
    }
    if (subcommand === "export") {
      return handleStatsExport(interaction, settings);
    }
    if (subcommand === "clear") {
      return handleStatsClear(interaction, settings);
    }
  }

  return interaction.reply({
    content: "Unknown command",
    ephemeral: true,
  });
}

async function handleChannelAdd(interaction, _settings) {
  const { guildId, options } = interaction;
  const channel = options.getChannel("channel");
  const filterType = options.getString("filter") || "all";

  const dbManager = await getDatabaseManager();

  const channelSettings = {
    enabled: true,
    filters:
      filterType === "all"
        ? {
            badWords: true,
            links: true,
            spam: true,
            mentionSpam: true,
            inviteLink: true,
            capsLock: true,
          }
        : { [filterType]: true },
  };

  await dbManager.automod.setChannelSettings(
    guildId,
    channel.id,
    channelSettings,
  );

  const response = successEmbed({
    title: "Channel Filter Added",
    description: `Auto-mod filters enabled for #${channel.name}`,
  });

  return interaction.reply({ ...response, ephemeral: true });
}

async function handleChannelRemove(interaction, _settings) {
  const { guildId, options } = interaction;
  const channel = options.getChannel("channel");

  const dbManager = await getDatabaseManager();
  await dbManager.automod.deleteChannelSettings(guildId, channel.id);

  const response = successEmbed({
    title: "Channel Filter Removed",
    description: `Auto-mod filters removed for #${channel.name}`,
  });

  return interaction.reply({ ...response, ephemeral: true });
}

async function handleChannelList(interaction, _settings) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  const channels = await dbManager.automod.getChannelSettingsList(guildId);

  const channelList = Object.entries(channels).map(
    ([channelId, channelSettings]) => {
      const filters = Object.entries(channelSettings.filters || {})
        .filter(([, enabled]) => enabled)
        .map(([filter]) => filter)
        .join(", ");
      return `• <#${channelId}>: ${filters}`;
    },
  );

  const embed = new EmbedBuilder()
    .setTitle("Channel Filters")
    .setDescription(
      channelList.length > 0
        ? channelList.join("\n")
        : "No channel-specific filters configured",
    )
    .setColor(THEME.color);

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleStatsShow(interaction, _settings) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  const analytics = await dbManager.automod.getAnalytics(guildId);

  const embed = new EmbedBuilder()
    .setTitle("Auto-Mod Statistics")
    .addFields(
      {
        name: "Total Violations",
        value: `${analytics.totalViolations || 0}`,
        inline: true,
      },
      {
        name: "Bad Words",
        value: `${analytics.violationsByType?.bad_words || 0}`,
        inline: true,
      },
      {
        name: "Links",
        value: `${analytics.violationsByType?.link || 0}`,
        inline: true,
      },
      {
        name: "Spam",
        value: `${analytics.violationsByType?.spam || 0}`,
        inline: true,
      },
      {
        name: "Mention Spam",
        value: `${analytics.violationsByType?.mention_spam || 0}`,
        inline: true,
      },
      {
        name: "Invite Links",
        value: `${analytics.violationsByType?.invite_link || 0}`,
        inline: true,
      },
    )
    .setColor(THEME.color);

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleStatsExport(interaction, _settings) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  const logs = await dbManager.automod.getLogs(guildId, 100);

  const exportData = logs.map(log => ({
    user: log.userTag,
    type: log.type,
    reason: log.reason,
    channel: log.channelName,
    timestamp: log.timestamp,
  }));

  const csv =
    "User,Type,Reason,Channel,Timestamp\n" +
    exportData
      .map(d => `${d.user},${d.type},${d.reason},${d.channel},${d.timestamp}`)
      .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("Moderation Logs Exported")
    .setDescription(
      `Exported ${logs.length} violation records. Use the attachment to view.`,
    )
    .setColor(THEME.color);

  return interaction.reply({
    embeds: [embed],
    files: [
      { attachment: Buffer.from(csv, "utf-8"), name: "moderation-logs.csv" },
    ],
    ephemeral: true,
  });
}

async function handleStatsClear(interaction, _settings) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  await dbManager.automod.clearLogs(guildId);

  const response = successEmbed({
    title: "Statistics Cleared",
    description: "All auto-mod statistics and logs have been cleared.",
  });

  return interaction.reply({ ...response, ephemeral: true });
}
