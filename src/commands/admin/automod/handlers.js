import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import {
  successEmbed,
  errorEmbed,
} from "../../../utils/discord/responseMessages.js";
import { getPremiumManager } from "../../../features/premium/PremiumManager.js";

const CORE_STATUS = {
  PRO: { emoji: "⚡", name: "Pro Engine" },
};

export async function handleToggle(interaction, settings) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, { ...settings, enabled });

  const response = successEmbed({
    title: "Auto-Moderation Updated",
    description: `Auto-moderation ${enabled ? "enabled" : "disabled"}!`,
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleStatus(interaction, settings) {
  const { isPro, allowedDomains } = await getDomainSettings(
    interaction.guild.id,
    settings,
  );

  const status = [
    `**Auto-Moderation Status**`,
    `Global: ${settings.enabled ? "✅ Enabled" : "❌ Disabled"}`,
    ``,
    `**Bad Words:** ${settings.badWords?.enabled ? "✅ On" : "❌ Off"}`,
    `Words: ${settings.badWords?.words?.join(", ") || "None"}`,
    ``,
    `**Links:** ${settings.links?.enabled ? "✅ On" : "❌ Off"}`,
    `${isPro && allowedDomains?.length > 0 ? `Allowed Domains: ${allowedDomains.join(", ")}` : ""}`,
    `${!isPro && settings.links?.enabled ? `🔒 Domain allowlisting: Pro only` : ""}`,
    ``,
    `**Spam:** ${settings.spam?.enabled ? "✅ On" : "❌ Off"}`,
    `Threshold: ${settings.spam?.repeatedMessages || 3} messages`,
  ]
    .filter(Boolean)
    .join("\n");

  return interaction.reply({
    content: status,
    ephemeral: true,
  });
}

export async function handleBadwordsToggle(interaction, settings) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    badWords: { ...settings.badWords, enabled },
  });

  const response = successEmbed({
    title: "Bad Words Filter Updated",
    description: `Bad words filter ${enabled ? "enabled" : "disabled"}!`,
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

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    links: { ...settings.links, enabled },
  });

  const response = successEmbed({
    title: "Link Filter Updated",
    description: `Link filter ${enabled ? "enabled" : "disabled"}!`,
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleSpamToggle(interaction, settings) {
  const { options, guildId } = interaction;
  const enabled = options.getBoolean("enabled");

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    spam: { ...settings.spam, enabled },
  });

  const response = successEmbed({
    title: "Spam Detection Updated",
    description: `Spam detection ${enabled ? "enabled" : "disabled"}!`,
  });

  return interaction.reply({ ...response, ephemeral: true });
}

async function getDomainSettings(guildId, settings) {
  const premiumManager = getPremiumManager();
  const isPro = await premiumManager.isFeatureActive(guildId, "pro_engine");

  let allowedDomains = settings.links?.allowedDomains || [];
  if (!isPro && allowedDomains.length > 0) {
    allowedDomains = [];
  }

  return { isPro, allowedDomains };
}

export async function handleDomainsAdd(interaction, settings) {
  const { options, guildId } = interaction;

  const premiumManager = getPremiumManager();
  const isPro = await premiumManager.isFeatureActive(guildId, "pro_engine");

  if (!isPro) {
    return interaction.reply({
      embeds: [
        errorEmbed({
          title: `${CORE_STATUS.PRO.emoji} Pro Engine Required`,
          description: `Domain allowlisting is a premium feature.`,
          solution: `Enable ${CORE_STATUS.PRO.name} on our **[website](https://rolereactor.app)** using Cores to unlock this feature!`,
        }),
      ],
      ephemeral: true,
    });
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

  const response = successEmbed({
    title: "Domains Added",
    description: `Added domains: ${newDomains.join(", ")}\nAllowed domains: ${combinedDomains.join(", ")}`,
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleDomainsRemove(interaction, settings) {
  const { options, guildId } = interaction;

  const premiumManager = getPremiumManager();
  const isPro = await premiumManager.isFeatureActive(guildId, "pro_engine");

  if (!isPro) {
    return interaction.reply({
      embeds: [
        errorEmbed({
          title: `${CORE_STATUS.PRO.emoji} Pro Engine Required`,
          description: `Domain allowlisting is a premium feature.`,
          solution: `Enable ${CORE_STATUS.PRO.name} on our **[website](https://rolereactor.app)** using Cores to unlock this feature!`,
        }),
      ],
      ephemeral: true,
    });
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

  const response = successEmbed({
    title: "Domains Removed",
    description:
      removeDomains.length > 0
        ? `Removed domains: ${removeDomains.join(", ")}\nAllowed domains: ${remainingDomains.join(", ") || "None"}`
        : "No domains to remove.",
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleDomainsClear(interaction, settings) {
  const { guildId } = interaction;

  const premiumManager = getPremiumManager();
  const isPro = await premiumManager.isFeatureActive(guildId, "pro_engine");

  if (!isPro) {
    return interaction.reply({
      embeds: [
        errorEmbed({
          title: `${CORE_STATUS.PRO.emoji} Pro Engine Required`,
          description: `Domain allowlisting is a premium feature.`,
          solution: `Enable ${CORE_STATUS.PRO.name} on our **[website](https://rolereactor.app)** using Cores to unlock this feature!`,
        }),
      ],
      ephemeral: true,
    });
  }

  const dbManager = await getDatabaseManager();
  await dbManager.automod.set(guildId, {
    ...settings,
    links: { ...settings.links, allowedDomains: [] },
  });

  const response = successEmbed({
    title: "Domains Cleared",
    description: "All allowed domains have been cleared.",
  });

  return interaction.reply({ ...response, ephemeral: true });
}

export async function handleDomainsList(interaction, settings) {
  const { guildId } = interaction;

  const premiumManager = getPremiumManager();
  const isPro = await premiumManager.isFeatureActive(guildId, "pro_engine");

  if (!isPro) {
    return interaction.reply({
      embeds: [
        errorEmbed({
          title: `${CORE_STATUS.PRO.emoji} Pro Engine Required`,
          description: `Domain allowlisting is a premium feature.`,
          solution: `Enable ${CORE_STATUS.PRO.name} on our **[website](https://rolereactor.app)** using Cores to unlock this feature!`,
        }),
      ],
      ephemeral: true,
    });
  }

  const domains = settings.links?.allowedDomains || [];

  return interaction.reply({
    content:
      domains.length > 0
        ? `**Allowed Domains:** ${domains.join(", ")}`
        : "No domains in allowlist. Use `/automod domains add` to add domains.",
    ephemeral: true,
  });
}

export async function handleAutomodCommand(interaction) {
  const { options, guildId } = interaction;

  const dbManager = await getDatabaseManager();
  if (!dbManager?.automod) {
    return interaction.reply({
      embeds: [
        errorEmbed({
          title: "Database Error",
          description: "Database error. Please try again.",
        }),
      ],
      ephemeral: true,
    });
  }

  const settings = await dbManager.automod.getByGuild(guildId);
  const subcommand = options.getSubcommand();
  const subcommandGroup = options.getSubcommandGroup(false);

  if (subcommand === "toggle" && !subcommandGroup) {
    return handleToggle(interaction, settings);
  }

  if (subcommand === "status") {
    return handleStatus(interaction, settings);
  }

  if (subcommandGroup === "badwords") {
    if (subcommand === "toggle") {
      return handleBadwordsToggle(interaction, settings);
    }
    if (subcommand === "words") {
      return handleBadwordsWords(interaction, settings);
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

  return interaction.reply({
    content: "Unknown command",
    ephemeral: true,
  });
}
