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

export async function handleAutomodConfigure(interaction) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } =
    await import("discord.js");
  const { THEME, EMOJIS } = await import("../../../config/theme.js");

  const createConfigButton = (filter, label) =>
    new ButtonBuilder()
      .setCustomId(`automod_configure_${filter}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary);

  const configureEmbed = new EmbedBuilder()
    .setTitle("Configure Auto-Mod")
    .setDescription("Click a filter to edit its settings")
    .setColor(THEME.PRIMARY)
    .setTimestamp();

  await interaction.reply({
    embeds: [configureEmbed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("automod_back")
          .setEmoji(EMOJIS.ACTIONS.BACK)
          .setStyle(ButtonStyle.Secondary),
        createConfigButton("badwords", "Bad Words"),
        createConfigButton("links", "Links"),
        createConfigButton("spam", "Spam"),
      ),
      new ActionRowBuilder().addComponents(
        createConfigButton("mentions", "Mentions"),
        createConfigButton("invites", "Invites"),
      ),
    ],
    ephemeral: true,
  });
}

export async function handleAutomodBack(interaction) {
  const { getDatabaseManager } =
    await import("../../../utils/storage/databaseManager.js");

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(interaction.guild.id);

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

export async function handleAutomodConfigureButton(interaction) {
  const filter = interaction.customId.replace("automod_configure_", "");

  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } =
    await import("discord.js");
  const { getDatabaseManager } =
    await import("../../../utils/storage/databaseManager.js");

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(interaction.guild.id);

  const filterConfigs = {
    badwords: {
      title: "Configure Bad Words",
      settings: settings.badWords,
      fields: [
        {
          label: "Words (comma-separated)",
          customId: "badwords_words",
          value: settings.badWords?.words?.join(", ") || "",
          placeholder: "badword1,badword2,badword3",
          style: TextInputStyle.Paragraph,
        },
        {
          label: "Action",
          customId: "badwords_action",
          value: settings.badWords?.action || "delete",
          placeholder: "delete, warn, timeout",
          style: TextInputStyle.Short,
        },
        {
          label: "Timeout (minutes)",
          customId: "badwords_timeout",
          value: String(settings.badWords?.timeoutDuration || 5),
          placeholder: "5",
          style: TextInputStyle.Short,
        },
      ],
    },
    links: {
      title: "Configure Links",
      settings: settings.links,
      fields: [
        {
          label: "Allowed Domains (Pro)",
          customId: "links_domains",
          value: settings.links?.allowedDomains?.join(", ") || "",
          placeholder: "discord.com,youtube.com",
          style: TextInputStyle.Paragraph,
        },
        {
          label: "Action",
          customId: "links_action",
          value: settings.links?.action || "delete",
          placeholder: "delete, warn, timeout",
          style: TextInputStyle.Short,
        },
      ],
    },
    spam: {
      title: "Configure Spam",
      settings: settings.spam,
      fields: [
        {
          label: "Repeated Messages",
          customId: "spam_repeated",
          value: String(settings.spam?.repeatedMessages || 3),
          placeholder: "3",
          style: TextInputStyle.Short,
        },
        {
          label: "Action",
          customId: "spam_action",
          value: settings.spam?.action || "timeout",
          placeholder: "delete, warn, timeout",
          style: TextInputStyle.Short,
        },
        {
          label: "Timeout (minutes)",
          customId: "spam_timeout",
          value: String(settings.spam?.timeoutDuration || 5),
          placeholder: "5",
          style: TextInputStyle.Short,
        },
      ],
    },
    mentions: {
      title: "Configure Mention Spam",
      settings: settings.mentionSpam,
      fields: [
        {
          label: "Mention Count",
          customId: "mentions_count",
          value: String(settings.mentionSpam?.mentionCount || 5),
          placeholder: "5",
          style: TextInputStyle.Short,
        },
        {
          label: "Action",
          customId: "mentions_action",
          value: settings.mentionSpam?.action || "delete",
          placeholder: "delete, warn, timeout",
          style: TextInputStyle.Short,
        },
        {
          label: "Timeout (minutes)",
          customId: "mentions_timeout",
          value: String(settings.mentionSpam?.timeoutDuration || 5),
          placeholder: "5",
          style: TextInputStyle.Short,
        },
      ],
    },
    invites: {
      title: "Configure Invite Links",
      settings: settings.inviteLink,
      fields: [
        {
          label: "Action",
          customId: "invites_action",
          value: settings.inviteLink?.action || "delete",
          placeholder: "delete, warn, timeout",
          style: TextInputStyle.Short,
        },
        {
          label: "Timeout (minutes)",
          customId: "invites_timeout",
          value: String(settings.inviteLink?.timeoutDuration || 5),
          placeholder: "5",
          style: TextInputStyle.Short,
        },
      ],
    },
  };

  const config = filterConfigs[filter];
  if (!config) return;

  const modal = new ModalBuilder()
    .setCustomId(`automod_${filter}_modal`)
    .setTitle(config.title);

  const actionRows = config.fields.map(field => {
    const input = new TextInputBuilder()
      .setCustomId(field.customId)
      .setLabel(field.label)
      .setValue(field.value)
      .setPlaceholder(field.placeholder)
      .setStyle(field.style)
      .setRequired(false);
    return new ActionRowBuilder().addComponents(input);
  });

  modal.addComponents(...actionRows);

  await interaction.showModal(modal);
}

export async function handleAutomodToggleAll(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const newSettings = {
      ...settings,
      badWords: { ...settings.badWords, enabled: true },
      links: { ...settings.links, enabled: true },
      spam: { ...settings.spam, enabled: true },
      mentionSpam: { ...settings.mentionSpam, enabled: true },
      inviteLink: { ...settings.inviteLink, enabled: true },
    };

    await dbManager.automod.set(interaction.guild.id, newSettings);

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    await updateAutomodMessage(interaction, newSettings, isPro);

    logger.info(
      `Auto-mod all filters enabled for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod enable all", error);
    await handleAutomodError(interaction, "enabling all filters");
  }
}

export async function handleAutomodToggleAllOff(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const newSettings = {
      ...settings,
      badWords: { ...settings.badWords, enabled: false },
      links: { ...settings.links, enabled: false },
      spam: { ...settings.spam, enabled: false },
      mentionSpam: { ...settings.mentionSpam, enabled: false },
      inviteLink: { ...settings.inviteLink, enabled: false },
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
    logger.error("Error handling automod disable all", error);
    await handleAutomodError(interaction, "disabling all filters");
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

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    await updateAutomodMessage(
      interaction,
      {
        ...settings,
        badWords: {
          ...settings.badWords,
          enabled: newEnabled,
        },
      },
      isPro,
    );

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

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    await updateAutomodMessage(
      interaction,
      {
        ...settings,
        links: {
          ...settings.links,
          enabled: newEnabled,
        },
      },
      isPro,
    );

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

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    await updateAutomodMessage(
      interaction,
      {
        ...settings,
        spam: {
          ...settings.spam,
          enabled: newEnabled,
        },
      },
      isPro,
    );

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

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    await updateAutomodMessage(
      interaction,
      {
        ...settings,
        mentionSpam: {
          ...settings.mentionSpam,
          enabled: newEnabled,
        },
      },
      isPro,
    );

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

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    await updateAutomodMessage(
      interaction,
      {
        ...settings,
        inviteLink: {
          ...settings.inviteLink,
          enabled: newEnabled,
        },
      },
      isPro,
    );

    logger.info(
      `Invite link filter ${newEnabled ? "enabled" : "disabled"} for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod invite toggle", error);
    await handleAutomodError(interaction, "toggling the invite link filter");
  }
}

async function parseNumber(value, defaultValue = 0) {
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}

export async function handleAutomodBadwordsModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const words = interaction.fields
      .getTextInputValue("badwords_words")
      .split(",")
      .map(w => w.trim())
      .filter(w => w);

    const action =
      interaction.fields.getTextInputValue("badwords_action") || "delete";
    const timeoutDuration = await parseNumber(
      interaction.fields.getTextInputValue("badwords_timeout"),
      5,
    );

    const newSettings = {
      ...settings,
      badWords: {
        ...settings.badWords,
        words,
        action,
        timeoutDuration,
      },
    };

    await dbManager.automod.set(interaction.guild.id, newSettings);

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    const embed = createAutomodSettingsEmbed(
      newSettings,
      isPro,
      interaction.guild.name,
      interaction.client,
    );
    const components = createAutomodSettingsComponents(newSettings);

    await interaction.update({
      embeds: [embed],
      components,
    });

    logger.info(
      `Bad words filter configured for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod badwords modal", error);
    await handleAutomodError(interaction, "saving bad words settings");
  }
}

export async function handleAutomodLinksModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const allowedDomains = interaction.fields
      .getTextInputValue("links_domains")
      .split(",")
      .map(d => d.trim())
      .filter(d => d);
    const action =
      interaction.fields.getTextInputValue("links_action") || "delete";

    const newSettings = {
      ...settings,
      links: {
        ...settings.links,
        blockUrls: true,
        allowedDomains,
        action,
      },
    };

    await dbManager.automod.set(interaction.guild.id, newSettings);

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    const embed = createAutomodSettingsEmbed(
      newSettings,
      isPro,
      interaction.guild.name,
      interaction.client,
    );
    const components = createAutomodSettingsComponents(newSettings);

    await interaction.update({
      embeds: [embed],
      components,
    });

    logger.info(
      `Links filter configured for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod links modal", error);
    await handleAutomodError(interaction, "saving links settings");
  }
}

export async function handleAutomodSpamModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const repeatedMessages = await parseNumber(
      interaction.fields.getTextInputValue("spam_repeated"),
      3,
    );
    const action =
      interaction.fields.getTextInputValue("spam_action") || "timeout";
    const timeoutDuration = await parseNumber(
      interaction.fields.getTextInputValue("spam_timeout"),
      5,
    );

    const newSettings = {
      ...settings,
      spam: {
        ...settings.spam,
        repeatedMessages,
        action,
        timeoutDuration,
      },
    };

    await dbManager.automod.set(interaction.guild.id, newSettings);

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    const embed = createAutomodSettingsEmbed(
      newSettings,
      isPro,
      interaction.guild.name,
      interaction.client,
    );
    const components = createAutomodSettingsComponents(newSettings);

    await interaction.update({
      embeds: [embed],
      components,
    });

    logger.info(
      `Spam filter configured for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod spam modal", error);
    await handleAutomodError(interaction, "saving spam settings");
  }
}

export async function handleAutomodMentionsModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const mentionCount = await parseNumber(
      interaction.fields.getTextInputValue("mentions_count"),
      5,
    );
    const action =
      interaction.fields.getTextInputValue("mentions_action") || "delete";
    const timeoutDuration = await parseNumber(
      interaction.fields.getTextInputValue("mentions_timeout"),
      5,
    );

    const newSettings = {
      ...settings,
      mentionSpam: {
        ...settings.mentionSpam,
        mentionCount,
        action,
        timeoutDuration,
      },
    };

    await dbManager.automod.set(interaction.guild.id, newSettings);

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    const embed = createAutomodSettingsEmbed(
      newSettings,
      isPro,
      interaction.guild.name,
      interaction.client,
    );
    const components = createAutomodSettingsComponents(newSettings);

    await interaction.update({
      embeds: [embed],
      components,
    });

    logger.info(
      `Mention spam filter configured for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod mentions modal", error);
    await handleAutomodError(interaction, "saving mention spam settings");
  }
}

export async function handleAutomodInvitesModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } =
      await import("../../../utils/storage/databaseManager.js");

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const action =
      interaction.fields.getTextInputValue("invites_action") || "delete";
    const timeoutDuration = await parseNumber(
      interaction.fields.getTextInputValue("invites_timeout"),
      5,
    );

    const newSettings = {
      ...settings,
      inviteLink: {
        ...settings.inviteLink,
        action,
        timeoutDuration,
      },
    };

    await dbManager.automod.set(interaction.guild.id, newSettings);

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    const embed = createAutomodSettingsEmbed(
      newSettings,
      isPro,
      interaction.guild.name,
      interaction.client,
    );
    const components = createAutomodSettingsComponents(newSettings);

    await interaction.update({
      embeds: [embed],
      components,
    });

    logger.info(
      `Invite link filter configured for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod invites modal", error);
    await handleAutomodError(interaction, "saving invite link settings");
  }
}
