import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { errorEmbed, successEmbed } from "../../../utils/discord/responseMessages.js";
import { getPremiumManager } from "../../../features/premium/PremiumManager.js";
import { createAutomodSettingsEmbed } from "./embeds.js";
import { createAutomodSettingsComponents } from "./components.js";

export async function handleAutomodSettings(interaction) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  if (!dbManager?.automod) {
    const response = errorEmbed({
      title: "Database Error",
      description: "Database error. Please try again.",
    });
    return interaction.reply({ ...response, ephemeral: true });
  }

  const settings = await dbManager.automod.getByGuild(guildId);

  const premiumManager = getPremiumManager();
  const isPro = await premiumManager.isFeatureActive(guildId, "pro_engine");

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

export async function updateSettingsAndReply(interaction, settings) {
  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(interaction.guild.id, settings);

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

  await interaction.update({
    embeds: [embed],
    components,
  });
}

export async function handleEnable(interaction) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

  await dbManager.automod.set(guildId, {
    ...settings,
    badWords: { ...settings.badWords, enabled: true },
    links: { ...settings.links, enabled: true },
    spam: { ...settings.spam, enabled: true },
    mentionSpam: { ...settings.mentionSpam, enabled: true },
    inviteLink: { ...settings.inviteLink, enabled: true },
    capsLock: { ...settings.capsLock, enabled: true },
  });

  const response = successEmbed({
    title: "Auto-Mod Enabled",
    description: "All filters are now active!",
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleDisable(interaction) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

  await dbManager.automod.set(guildId, {
    ...settings,
    badWords: { ...settings.badWords, enabled: false },
    links: { ...settings.links, enabled: false },
    spam: { ...settings.spam, enabled: false },
    mentionSpam: { ...settings.mentionSpam, enabled: false },
    inviteLink: { ...settings.inviteLink, enabled: false },
    capsLock: { ...settings.capsLock, enabled: false },
  });

  const response = successEmbed({
    title: "Auto-Mod Disabled",
    description: "All filters have been disabled.",
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleBadwordsToggle(interaction) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

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

  await dbManager.automod.set(guildId, {
    ...settings,
    badWords: badwordsSettings,
  });

  const response = successEmbed({
    title: "Bad Words Filter Updated",
    description: `Bad words filter is now **${enabled ? "enabled" : "disabled"}**.`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleBadwordsWords(interaction) {
  const { options, guildId } = interaction;
  const words = options
    .getString("words")
    .split(",")
    .map(w => w.trim())
    .filter(w => w);

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

  await dbManager.automod.set(guildId, {
    ...settings,
    badWords: { ...settings.badWords, words },
  });

  const response = successEmbed({
    title: "Bad Words Updated",
    description: `Bad words list updated to: **${words.join(", ")}**`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleLinksToggle(interaction) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

  const linksSettings = { ...settings.links, enabled, blockUrls: true };

  if (action !== null) {
    linksSettings.action = action;
  }
  if (timeoutDuration !== null) {
    linksSettings.timeoutDuration = timeoutDuration;
  }
  if (ignoreAdmins !== null) {
    linksSettings.ignoreAdmins = ignoreAdmins;
  }

  await dbManager.automod.set(guildId, {
    ...settings,
    links: linksSettings,
  });

  const response = successEmbed({
    title: "Links Filter Updated",
    description: `Links filter is now **${enabled ? "enabled" : "disabled"}**.`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleSpamToggle(interaction) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");
  const threshold = options.getInteger("threshold");
  const rateThreshold = options.getInteger("rate-threshold");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

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

  await dbManager.automod.set(guildId, {
    ...settings,
    spam: spamSettings,
  });

  const response = successEmbed({
    title: "Spam Detection Updated",
    description: `Spam detection is now **${enabled ? "enabled" : "disabled"}**.`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleMentionSpamToggle(interaction) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");
  const mentionCount = options.getInteger("mention-count");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

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

  await dbManager.automod.set(guildId, {
    ...settings,
    mentionSpam: mentionSpamSettings,
  });

  const response = successEmbed({
    title: "Mention Spam Filter Updated",
    description: `Mention spam filter is now **${enabled ? "enabled" : "disabled"}**.`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleInviteToggle(interaction) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

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

  await dbManager.automod.set(guildId, {
    ...settings,
    inviteLink: inviteSettings,
  });

  const response = successEmbed({
    title: "Invite Link Filter Updated",
    description: `Invite link filter is now **${enabled ? "enabled" : "disabled"}**.`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleCapsLockToggle(interaction) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");
  const threshold = options.getInteger("threshold");
  const minLength = options.getInteger("min-length");
  const action = options.getString("action");
  const timeoutDuration = options.getInteger("timeout-duration");
  const ignoreAdmins = options.getBoolean("ignore-admins");

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

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

  await dbManager.automod.set(guildId, {
    ...settings,
    capsLock: capsLockSettings,
  });

  const response = successEmbed({
    title: "Caps Lock Filter Updated",
    description: `Caps lock filter is now **${enabled ? "enabled" : "disabled"}**.`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleDomainsAdd(interaction) {
  const { options, guildId } = interaction;
  const domainsInput = options.getString("domains");
  const newDomains = domainsInput
    .split(",")
    .map(d => d.trim().toLowerCase())
    .filter(d => d);

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

  const existingDomains = settings.links?.allowedDomains || [];
  const uniqueDomains = [...new Set([...existingDomains, ...newDomains])];

  await dbManager.automod.set(guildId, {
    ...settings,
    links: { ...settings.links, allowedDomains: uniqueDomains },
  });

  const response = successEmbed({
    title: "Domains Added",
    description: `Added domains: **${newDomains.join(", ")}**`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleDomainsRemove(interaction) {
  const { options, guildId } = interaction;
  const domainsToRemove = options
    .getString("domains")
    .split(",")
    .map(d => d.trim().toLowerCase())
    .filter(d => d);

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

  const existingDomains = settings.links?.allowedDomains || [];
  const updatedDomains = existingDomains.filter(
    d => !domainsToRemove.includes(d),
  );

  await dbManager.automod.set(guildId, {
    ...settings,
    links: { ...settings.links, allowedDomains: updatedDomains },
  });

  const response = successEmbed({
    title: "Domains Removed",
    description: `Removed domains: **${domainsToRemove.join(", ")}**`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleDomainsList(interaction) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

  const domains = settings.links?.allowedDomains || [];

  const response = successEmbed({
    title: "Allowed Domains",
    description:
      domains.length > 0
        ? `**${domains.join("\n")}**`
        : "No domains configured. Links from all domains will be blocked.",
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleDomainsClear(interaction) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

  await dbManager.automod.set(guildId, {
    ...settings,
    links: { ...settings.links, allowedDomains: [] },
  });

  const response = successEmbed({
    title: "Domains Cleared",
    description: "All allowed domains have been cleared.",
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleLogChannel(interaction) {
  const { options, guildId } = interaction;
  const channel = options.getChannel("channel");

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

  await dbManager.automod.set(guildId, {
    ...settings,
    logChannel: channel.id,
  });

  const response = successEmbed({
    title: "Log Channel Updated",
    description: `Automod logs will now be sent to ${channel}`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleIgnoredRoles(interaction) {
  const { options, guildId } = interaction;
  const rolesInput = options.getString("roles");
  const roleIds = rolesInput
    .split(",")
    .map(r => r.trim())
    .filter(r => r);

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

  await dbManager.automod.set(guildId, {
    ...settings,
    ignoredRoles: roleIds,
  });

  const response = successEmbed({
    title: "Ignored Roles Updated",
    description: `Ignored roles: **${roleIds.length > 0 ? roleIds.join(", ") : "None"}**`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleIgnoredChannels(interaction) {
  const { options, guildId } = interaction;
  const channelsInput = options.getString("channels");
  const channelIds = channelsInput
    .split(",")
    .map(c => c.trim())
    .filter(c => c);

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(guildId);

  await dbManager.automod.set(guildId, {
    ...settings,
    ignoredChannels: channelIds,
  });

  const response = successEmbed({
    title: "Ignored Channels Updated",
    description: `Ignored channels: **${channelIds.length > 0 ? channelIds.join(", ") : "None"}**`,
  });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  } else {
    return interaction.reply({ ...response, ephemeral: true });
  }
}

export async function handleStatsShow(interaction) {
  const { guildId } = interaction;

  const dbManager = await getDatabaseManager();
  const analytics = await dbManager.automod.getAnalytics(guildId);

  const { EmbedBuilder } = await import("discord.js");
  const { THEME } = await import("../../../config/theme.js");

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
      {
        name: "Caps Lock",
        value: `${analytics.violationsByType?.caps_lock || 0}`,
        inline: true,
      },
    )
    .setColor(THEME.PRIMARY);

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ embeds: [embed] });
  } else {
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
