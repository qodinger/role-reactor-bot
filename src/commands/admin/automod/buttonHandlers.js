import { getLogger } from "../../../utils/logger.js";
import { createAutomodSettingsEmbed } from "./embeds.js";
import { createAutomodSettingsComponents } from "./components.js";
import { getPremiumManager } from "../../../features/premium/PremiumManager.js";

async function handleAutomodError(interaction, context) {
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({
      content: `❌ An error occurred while ${context}. Please try again.`,
      flags: 64,
    });
  } else if (interaction.deferred) {
    await interaction.editReply({
      content: `❌ An error occurred while ${context}. Please try again.`,
      embeds: [],
      components: [],
    });
  }
}

async function updateAutomodMessage(interaction, settings, isPro = false) {
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

export async function handleAutomodToggleAll(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const hasAnyFilter =
      settings.badWords?.enabled ||
      settings.links?.enabled ||
      settings.spam?.enabled ||
      settings.mentionSpam?.enabled ||
      settings.inviteLink?.enabled;

    const shouldEnable = !hasAnyFilter;

    const newSettings = {
      ...settings,
      badWords: { ...settings.badWords, enabled: shouldEnable },
      links: { ...settings.links, enabled: shouldEnable },
      spam: { ...settings.spam, enabled: shouldEnable },
      mentionSpam: { ...settings.mentionSpam, enabled: shouldEnable },
      inviteLink: { ...settings.inviteLink, enabled: shouldEnable },
    };

    await dbManager.automod.set(interaction.guild.id, newSettings);

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    await updateAutomodMessage(interaction, newSettings, isPro);

    logger.info(
      `Auto-mod all filters disabled for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod toggle all", error);
    await handleAutomodError(interaction, "toggling all filters");
  }
}

export async function handleAutomodGlobalToggle(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const newEnabled = !settings.enabled;

    await dbManager.automod.set(interaction.guild.id, {
      ...settings,
      enabled: newEnabled,
    });

    await updateAutomodMessage(interaction, {
      ...settings,
      enabled: newEnabled,
    });

    logger.info(
      `Auto-mod system ${newEnabled ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod global toggle", error);
    await handleAutomodError(interaction, "toggling the auto-mod system");
  }
}

export async function handleAutomodBadwordsToggle(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const newEnabled = !settings.badWords?.enabled;

    await dbManager.automod.set(interaction.guild.id, {
      ...settings,

      badWords: {
        ...settings.badWords,
        enabled: newEnabled,
      },
    });

    await updateAutomodMessage(interaction, {
      ...settings,

      badWords: {
        ...settings.badWords,
        enabled: newEnabled,
      },
    });

    logger.info(
      `Bad words filter ${newEnabled ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod badwords toggle", error);
    await handleAutomodError(interaction, "toggling the bad words filter");
  }
}

export async function handleAutomodLinksToggle(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const newEnabled = !settings.links?.enabled;

    await dbManager.automod.set(interaction.guild.id, {
      ...settings,

      links: {
        ...settings.links,
        enabled: newEnabled,
      },
    });

    await updateAutomodMessage(interaction, {
      ...settings,

      links: {
        ...settings.links,
        enabled: newEnabled,
      },
    });

    logger.info(
      `Links filter ${newEnabled ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod links toggle", error);
    await handleAutomodError(interaction, "toggling the links filter");
  }
}

export async function handleAutomodSpamToggle(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const newEnabled = !settings.spam?.enabled;

    await dbManager.automod.set(interaction.guild.id, {
      ...settings,

      spam: {
        ...settings.spam,
        enabled: newEnabled,
      },
    });

    await updateAutomodMessage(interaction, {
      ...settings,

      spam: {
        ...settings.spam,
        enabled: newEnabled,
      },
    });

    logger.info(
      `Spam filter ${newEnabled ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod spam toggle", error);
    await handleAutomodError(interaction, "toggling the spam filter");
  }
}

export async function handleAutomodMentionSpamToggle(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const newEnabled = !settings.mentionSpam?.enabled;

    await dbManager.automod.set(interaction.guild.id, {
      ...settings,

      mentionSpam: {
        ...settings.mentionSpam,
        enabled: newEnabled,
      },
    });

    await updateAutomodMessage(interaction, {
      ...settings,

      mentionSpam: {
        ...settings.mentionSpam,
        enabled: newEnabled,
      },
    });

    logger.info(
      `Mention spam filter ${newEnabled ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod mention-spam toggle", error);
    await handleAutomodError(interaction, "toggling the mention spam filter");
  }
}

export async function handleAutomodInviteToggle(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const newEnabled = !settings.inviteLink?.enabled;

    await dbManager.automod.set(interaction.guild.id, {
      ...settings,

      inviteLink: {
        ...settings.inviteLink,
        enabled: newEnabled,
      },
    });

    await updateAutomodMessage(interaction, {
      ...settings,

      inviteLink: {
        ...settings.inviteLink,
        enabled: newEnabled,
      },
    });

    logger.info(
      `Invite link filter ${newEnabled ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod invite toggle", error);
    await handleAutomodError(interaction, "toggling the invite link filter");
  }
}
