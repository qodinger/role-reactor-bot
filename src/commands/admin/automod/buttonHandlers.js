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
        createConfigButton("capslock", "Caps Lock"),
      ),
      new ActionRowBuilder().addComponents(
        createConfigButton("domains", "Domains"),
        createConfigButton("stats", "Stats"),
      ),
    ],
    ephemeral: true,
  });
}

export async function handleAutomodBack(interaction) {
  const { getDatabaseManager } = await import(
    "../../../utils/storage/databaseManager.js"
  );

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

  const { getDatabaseManager } = await import(
    "../../../utils/storage/databaseManager.js"
  );
  const {
    createBadwordsModal,
    createLinksModal,
    createSpamModal,
    createMentionsModal,
    createCapslockModal,
    createDomainsModal,
    createLogChannelModal,
    createIgnoredRolesModal,
    createIgnoredChannelsModal,
  } = await import("./modals.js");

  const dbManager = await getDatabaseManager();
  const settings = await dbManager.automod.getByGuild(interaction.guild.id);

  let modal;

  switch (filter) {
    case "badwords":
      modal = createBadwordsModal(settings.badWords);
      break;
    case "links":
      modal = createLinksModal(settings.links);
      break;
    case "spam":
      modal = createSpamModal(settings.spam);
      break;
    case "mentions":
      modal = createMentionsModal(settings.mentionSpam);
      break;
    case "capslock":
      modal = createCapslockModal(settings.capsLock);
      break;
    case "domains":
      modal = createDomainsModal(settings.links);
      break;
    case "logchannel":
      modal = createLogChannelModal(settings);
      break;
    case "ignoredroles":
      modal = createIgnoredRolesModal(settings);
      break;
    case "ignoredchannels":
      modal = createIgnoredChannelsModal(settings);
      break;
    default:
      return;
  }

  await interaction.showModal(modal);
}

// Keep the old function for backward compatibility
export async function handleAutomodConfigureButtonOld(interaction) {
  const filter = interaction.customId.replace("automod_configure_", "");

  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } =
    await import("discord.js");
  const { getDatabaseManager } = await import(
    "../../../utils/storage/databaseManager.js"
  );

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
          style: "Paragraph",
        },
        {
          label: "Timeout minutes (if using timeout action)",
          customId: "badwords_timeout",
          value: String(settings.badWords?.timeoutDuration || 5),
          placeholder: "5",
          style: "Short",
        },
      ],
    },
    links: {
      title: "Configure Links",
      settings: settings.links,
      fields: [
        {
          label: "Allowed Domains (comma-separated)",
          customId: "links_domains",
          value: settings.links?.allowedDomains?.join(", ") || "",
          placeholder: "discord.com,youtube.com",
          style: "Paragraph",
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
          label: "Timeout minutes (if using timeout action)",
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
          label: "Timeout minutes (if using timeout action)",
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
      fields: [],
    },
    capslock: {
      title: "Configure Caps Lock",
      settings: settings.capsLock,
      fields: [
        {
          label: "Threshold (50-100%)",
          customId: "capslock_threshold",
          value: String(settings.capsLock?.threshold || 70),
          placeholder: "70",
          style: TextInputStyle.Short,
        },
        {
          label: "Min Length",
          customId: "capslock_minlength",
          value: String(settings.capsLock?.minLength || 10),
          placeholder: "10",
          style: TextInputStyle.Short,
        },
        {
          label: "Action (delete / timeout / kick / ban)",
          customId: "capslock_action",
          value: settings.capsLock?.action || "delete",
          placeholder: "delete",
          style: TextInputStyle.Short,
        },
        {
          label: "Timeout minutes (if action = timeout)",
          customId: "capslock_timeout",
          value: String(settings.capsLock?.timeoutDuration || 5),
          placeholder: "5",
          style: TextInputStyle.Short,
        },
      ],
    },
    domains: {
      title: "Configure Allowed Domains",
      settings: settings.links,
      fields: [
        {
          label: "Domains (comma-separated)",
          customId: "domains_list",
          value: settings.links?.allowedDomains?.join(", ") || "",
          placeholder: "discord.com, youtube.com",
          style: TextInputStyle.Paragraph,
        },
      ],
    },
    stats: {
      title: "Auto-Mod Statistics",
      settings: {},
      fields: [],
    },
    logchannel: {
      title: "Configure Log Channel",
      settings: {},
      fields: [
        {
          label: "Channel ID",
          customId: "log_channel_id",
          value: settings.logChannel || "",
          placeholder: "1234567890",
          style: TextInputStyle.Short,
        },
      ],
    },
    ignoredroles: {
      title: "Configure Ignored Roles",
      settings: {},
      fields: [
        {
          label: "Role IDs (comma-separated)",
          customId: "ignored_roles",
          value: settings.ignoredRoles?.join(", ") || "",
          placeholder: "1234567890, 9876543210",
          style: TextInputStyle.Paragraph,
        },
      ],
    },
    ignoredchannels: {
      title: "Configure Ignored Channels",
      settings: {},
      fields: [
        {
          label: "Channel IDs (comma-separated)",
          customId: "ignored_channels",
          value: settings.ignoredChannels?.join(", ") || "",
          placeholder: "1234567890, 9876543210",
          style: TextInputStyle.Paragraph,
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
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const newSettings = {
      ...settings,
      badWords: { ...settings.badWords, enabled: true },
      links: { ...settings.links, enabled: true },
      spam: { ...settings.spam, enabled: true },
      mentionSpam: { ...settings.mentionSpam, enabled: true },
      inviteLink: { ...settings.inviteLink, enabled: true },
      capsLock: { ...settings.capsLock, enabled: true },
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
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const newSettings = {
      ...settings,
      badWords: { ...settings.badWords, enabled: false },
      links: { ...settings.links, enabled: false },
      spam: { ...settings.spam, enabled: false },
      mentionSpam: { ...settings.mentionSpam, enabled: false },
      inviteLink: { ...settings.inviteLink, enabled: false },
      capsLock: { ...settings.capsLock, enabled: false },
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

export async function handleAutomodQuickSetup(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const newSettings = {
      ...settings,
      badWords: {
        ...settings.badWords,
        enabled: true,
        words: settings.badWords?.words || [],
        action: settings.badWords?.action || "delete",
        timeoutDuration: settings.badWords?.timeoutDuration || 5,
      },
      links: {
        ...settings.links,
        enabled: true,
        action: settings.links?.action || "delete",
        timeoutDuration: settings.links?.timeoutDuration || 5,
      },
      spam: {
        ...settings.spam,
        enabled: true,
        repeatedMessages: settings.spam?.repeatedMessages || 3,
        action: settings.spam?.action || "timeout",
        timeoutDuration: settings.spam?.timeoutDuration || 5,
      },
      mentionSpam: {
        ...settings.mentionSpam,
        enabled: true,
        mentionCount: settings.mentionSpam?.mentionCount || 5,
        action: settings.mentionSpam?.action || "delete",
        timeoutDuration: settings.mentionSpam?.timeoutDuration || 5,
      },
      inviteLink: {
        ...settings.inviteLink,
        enabled: true,
        action: settings.inviteLink?.action || "delete",
        timeoutDuration: settings.inviteLink?.timeoutDuration || 5,
      },
      capsLock: {
        ...settings.capsLock,
        enabled: true,
        threshold: settings.capsLock?.threshold || 70,
        minLength: settings.capsLock?.minLength || 10,
        action: settings.capsLock?.action || "delete",
        timeoutDuration: settings.capsLock?.timeoutDuration || 5,
      },
    };

    await dbManager.automod.set(interaction.guild.id, newSettings);

    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(
      interaction.guild.id,
      "pro_engine",
    );

    await updateAutomodMessage(interaction, newSettings, isPro);

    logger.info(
      `Auto-mod quick setup enabled for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod quick setup", error);
    await handleAutomodError(interaction, "running quick setup");
  }
}

export async function handleAutomodBadwordsToggle(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

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
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

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
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

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
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

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
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

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

export async function showActionSelectMenu(interaction, filterName, currentAction) {
  const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    EmbedBuilder,
  } = await import("discord.js");
  const { THEME } = await import("../../../config/theme.js");

  const embed = new EmbedBuilder()
    .setTitle(`Select Action for ${filterName}`)
    .setDescription("Choose what action to take when this filter is triggered")
    .setColor(THEME.PRIMARY);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`automod_action_select_${filterName}`)
    .setPlaceholder("Select an action...")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Delete Message")
        .setDescription("Remove the offending message")
        .setValue("delete")
        .setDefault(currentAction === "delete"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Timeout User")
        .setDescription("Temporarily mute the user")
        .setValue("timeout")
        .setDefault(currentAction === "timeout"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Kick User")
        .setDescription("Remove user from server")
        .setValue("kick")
        .setDefault(currentAction === "kick"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Ban User")
        .setDescription("Permanently ban the user")
        .setValue("ban")
        .setDefault(currentAction === "ban"),
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.followUp({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

export async function handleAutomodBadwordsModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const words = interaction.fields
      .getTextInputValue("badwords_words")
      .split(",")
      .map(w => w.trim())
      .filter(w => w);

    const timeoutDuration = await parseNumber(
      interaction.fields.getTextInputValue("badwords_timeout"),
      5,
    );

    const newSettings = {
      ...settings,
      badWords: {
        ...settings.badWords,
        words,
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

    await showActionSelectMenu(
      interaction,
      "Bad Words",
      settings.badWords?.action || "delete",
    );

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
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const allowedDomains = interaction.fields
      .getTextInputValue("links_domains")
      .split(",")
      .map(d => d.trim())
      .filter(d => d);

    const newSettings = {
      ...settings,
      links: {
        ...settings.links,
        blockUrls: true,
        allowedDomains,
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

    await showActionSelectMenu(
      interaction,
      "Links",
      settings.links?.action || "delete",
    );

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
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const repeatedMessages = await parseNumber(
      interaction.fields.getTextInputValue("spam_repeated"),
      3,
    );
    const timeoutDuration = await parseNumber(
      interaction.fields.getTextInputValue("spam_timeout"),
      5,
    );

    const newSettings = {
      ...settings,
      spam: {
        ...settings.spam,
        repeatedMessages,
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

    await showActionSelectMenu(
      interaction,
      "Spam",
      settings.spam?.action || "timeout",
    );

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
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const mentionCount = await parseNumber(
      interaction.fields.getTextInputValue("mentions_count"),
      5,
    );
    const timeoutDuration = await parseNumber(
      interaction.fields.getTextInputValue("mentions_timeout"),
      5,
    );

    const newSettings = {
      ...settings,
      mentionSpam: {
        ...settings.mentionSpam,
        mentionCount,
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

    await showActionSelectMenu(
      interaction,
      "Mention Spam",
      settings.mentionSpam?.action || "delete",
    );

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
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

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

    await showActionSelectMenu(
      interaction,
      "Invite Links",
      settings.inviteLink?.action || "delete",
    );

    logger.info(
      `Invite link filter configured for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod invites modal", error);
    await handleAutomodError(interaction, "saving invite link settings");
  }
}

export async function handleAutomodCapslockModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const threshold = await parseNumber(
      interaction.fields.getTextInputValue("capslock_threshold"),
      70,
    );
    const minLength = await parseNumber(
      interaction.fields.getTextInputValue("capslock_minlength"),
      10,
    );
    const timeoutDuration = await parseNumber(
      interaction.fields.getTextInputValue("capslock_timeout"),
      5,
    );

    const newSettings = {
      ...settings,
      capsLock: {
        ...settings.capsLock,
        threshold,
        minLength,
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

    await showActionSelectMenu(
      interaction,
      "Caps Lock",
      settings.capsLock?.action || "delete",
    );

    logger.info(
      `Caps lock filter configured for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod capslock modal", error);
    await handleAutomodError(interaction, "saving caps lock settings");
  }
}

export async function handleAutomodDomainsModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const domains = interaction.fields
      .getTextInputValue("domains_list")
      .split(",")
      .map(d => d.trim().toLowerCase())
      .filter(d => d);

    const newSettings = {
      ...settings,
      links: {
        ...settings.links,
        allowedDomains: domains,
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
      `Domains configured for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod domains modal", error);
    await handleAutomodError(interaction, "saving domains settings");
  }
}

export async function handleAutomodStatsModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const analytics = await dbManager.automod.getAnalytics(interaction.guild.id);

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
      )
      .setColor(THEME.color);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });

    logger.info(
      `Stats viewed for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod stats modal", error);
    await handleAutomodError(interaction, "viewing stats");
  }
}

export async function handleAutomodLogChannelModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const channelId = interaction.fields
      .getTextInputValue("log_channel_id")
      .trim();

    const newSettings = {
      ...settings,
      logChannel: channelId || null,
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
      `Log channel configured for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod log channel modal", error);
    await handleAutomodError(interaction, "saving log channel settings");
  }
}

export async function handleAutomodIgnoredRolesModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const roleIds = interaction.fields
      .getTextInputValue("ignored_roles")
      .split(",")
      .map(id => id.trim())
      .filter(id => id);

    const newSettings = {
      ...settings,
      ignoredRoles: roleIds,
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
      `Ignored roles configured for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod ignored roles modal", error);
    await handleAutomodError(interaction, "saving ignored roles settings");
  }
}

export async function handleAutomodIgnoredChannelsModal(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const channelIds = interaction.fields
      .getTextInputValue("ignored_channels")
      .split(",")
      .map(id => id.trim())
      .filter(id => id);

    const newSettings = {
      ...settings,
      ignoredChannels: channelIds,
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
      `Ignored channels configured for guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod ignored channels modal", error);
    await handleAutomodError(interaction, "saving ignored channels settings");
  }
}

export async function handleAutomodActionSelect(interaction) {
  const logger = getLogger();

  try {
    const { getDatabaseManager } = await import(
      "../../../utils/storage/databaseManager.js"
    );

    const dbManager = await getDatabaseManager();
    const settings = await dbManager.automod.getByGuild(interaction.guild.id);

    const filterName = interaction.customId.replace("automod_action_select_", "");
    const selectedAction = interaction.values[0];

    const filterMap = {
      "Bad Words": "badWords",
      Links: "links",
      Spam: "spam",
      "Mention Spam": "mentionSpam",
      "Invite Links": "inviteLink",
      "Caps Lock": "capsLock",
    };

    const filterKey = filterMap[filterName];
    if (!filterKey) return;

    const newSettings = {
      ...settings,
      [filterKey]: {
        ...settings[filterKey],
        action: selectedAction,
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
      `Action set to ${selectedAction} for ${filterName} in guild ${interaction.guild.name} by user ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error("Error handling automod action select", error);
    await handleAutomodError(interaction, "selecting action");
  }
}
