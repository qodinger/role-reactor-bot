import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ComponentType,
  EmbedBuilder,
} from "discord.js";
import { getTicketPanel } from "../../../../features/ticketing/TicketPanel.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { getTicketTranscript } from "../../../../features/ticketing/TicketTranscript.js";
import { getLogger } from "../../../../utils/logger.js";
import {
  createInfoEmbed,
  createSuccessEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";
import {
  FREE_TIER,
  PRO_ENGINE,
  DEFAULT_CATEGORY,
} from "../../../../features/ticketing/config.js";
import { EMOJIS } from "../../../../config/theme.js";

const logger = getLogger();

// ─────────────────────────────────────────────────────────────────────────────
// /ticket setup
// ─────────────────────────────────────────────────────────────────────────────

export async function handleSetup(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel("channel");
  const title = interaction.options.getString("title") || "Support Tickets";
  const description =
    interaction.options.getString("description") ||
    "Click a button below to create a ticket and get support from our team.";
  const colorInput = interaction.options.getString("color");
  const ticketCategory = interaction.options.getChannel("category");

  let color = 0x5865f2;
  if (colorInput) {
    const hex = colorInput.startsWith("#") ? colorInput.slice(1) : colorInput;
    color = parseInt(hex, 16) || 0x5865f2;
  }

  if (!channel.isTextBased()) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "Please select a text channel.",
          "Invalid Channel",
          interaction.client,
        ),
      ],
    });
  }

  // Require a staff role before creating a panel
  const ticketManager = getTicketManager();
  await ticketManager.initialize();
  const settings =
    await ticketManager.storage.dbManager.guildSettings.getByGuild(
      interaction.guildId,
    );
  const staffRoleId = settings?.ticketSettings?.staffRoleId;

  if (!staffRoleId) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "You need to configure a Staff Role before creating a ticket panel. This ensures the bot knows who has permission to view and manage user tickets.\n\n" +
            `Please run </ticket staff-role:${interaction.commandId}> to set it up.`,
          "No Staff Role Configured",
          interaction.client,
        ),
      ],
    });
  }

  // Check bot permissions
  const botMember = await interaction.guild.members.me;
  if (!botMember.permissions.has("ManageChannels")) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "I don't have the **Manage Channels** permission in this server.\n\n" +
            "I need this permission to create categories and channels for your tickets. Please enable it in my role settings.",
          "Missing Permissions",
          interaction.client,
        ),
      ],
    });
  }

  const ticketPanel = getTicketPanel();
  await ticketPanel.initialize();

  const result = await ticketPanel.createPanel({
    guildId: interaction.guildId,
    channelId: channel.id,
    title,
    description,
    categories: [DEFAULT_CATEGORY],
    settings: {
      ticketCategoryId: ticketCategory?.id || null,
    },
    styling: { color },
  });

  if (!result.success) {
    return interaction.editReply({ embeds: [result.error] });
  }

  const sendResult = await ticketPanel.sendPanelMessage({
    channel,
    panel: result.panel,
  });

  if (!sendResult.success) {
    return interaction.editReply({ embeds: [sendResult.error] });
  }

  return interaction.editReply({
    embeds: [
      createSuccessEmbed(
        `**Panel:** \`#${result.panel.panelId.split("-").pop()}\`\n` +
          `**Channel:** ${channel}`,
        "Panel Created",
        interaction.client,
      ),
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /ticket info
// ─────────────────────────────────────────────────────────────────────────────

export async function handleInfo(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const action = interaction.options.getString("action") || "view";
  const guildId = interaction.guildId;

  const ticketPanel = getTicketPanel();
  const ticketManager = getTicketManager();
  const ticketTranscript = getTicketTranscript();

  await ticketPanel.initialize();
  await ticketManager.initialize();
  await ticketTranscript.initialize();

  if (action === "view") {
    return await handleInfoView(
      interaction,
      guildId,
      ticketPanel,
      ticketManager,
    );
  } else if (action === "stats") {
    return await handleInfoStats(interaction, guildId, ticketManager);
  } else if (action === "storage") {
    return await handleInfoStorage(interaction, guildId, ticketTranscript);
  }
}

async function handleInfoView(
  interaction,
  guildId,
  ticketPanel,
  ticketManager,
) {
  const panels = await ticketPanel.getGuildPanels(guildId);
  const panelLimit = await ticketPanel.checkPanelLimit(guildId);
  const ticketLimit = await ticketManager.checkTicketLimit(guildId);

  const settings =
    await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
  const staffRoleId = settings?.ticketSettings?.staffRoleId;
  const staffRoleDisplay = staffRoleId
    ? `<@&${staffRoleId}>`
    : "Not configured";

  const logChannelId = settings?.ticketSettings?.transcriptChannelId;
  const logChannelDisplay = logChannelId
    ? `<#${logChannelId}>`
    : "Not configured";

  const allowUserTranscripts =
    settings?.ticketSettings?.allowUserTranscripts !== false;
  const userTranscriptsDisplay = allowUserTranscripts ? "Enabled" : "Disabled";

  const embed = createInfoEmbed(
    "Ticket System Information",
    "Current ticket system limits and settings.",
    interaction.client,
  ).addFields(
    { name: "Staff Role", value: staffRoleDisplay, inline: true },
    { name: "Log Channel", value: logChannelDisplay, inline: true },
    {
      name: "Transcript Access",
      value: userTranscriptsDisplay,
      inline: true,
    },
    {
      name: "Panels",
      value: `${panels.length} / ${panelLimit.max}`,
      inline: true,
    },
    {
      name: "Monthly Tickets",
      value: `${ticketLimit.current} / ${ticketLimit.max}`,
      inline: true,
    },
    {
      name: "Tier",
      value: ticketLimit.isPro ? "Pro Engine" : "Free Tier",
      inline: true,
    },
    {
      name: "Categories",
      value: ticketLimit.isPro ? "20 (Pro)" : "3 (Free)",
      inline: true,
    },
    {
      name: "Retention",
      value: ticketLimit.isPro ? "Unlimited" : "7 days",
      inline: true,
    },
    {
      name: "Exports",
      value: ticketLimit.isPro ? "HTML, JSON, MD" : "MD (Markdown)",
      inline: true,
    },
  );

  return interaction.editReply({ embeds: [embed] });
}

async function handleInfoStats(interaction, guildId, ticketManager) {
  const stats = await ticketManager.getGuildStats(guildId);

  const embed = createInfoEmbed(
    "Ticket Statistics",
    "Ticket usage statistics for this server.",
    interaction.client,
  ).addFields(
    { name: "Total (Month)", value: stats.current.toString(), inline: true },
    { name: "Open", value: stats.open.toString(), inline: true },
    { name: "Closed", value: stats.closed.toString(), inline: true },
    { name: "Archived", value: stats.archived.toString(), inline: true },
    {
      name: "Tier",
      value: stats.isPro ? "Pro Engine" : "Free Tier",
      inline: true,
    },
    {
      name: "Usage",
      value: `${stats.current} / ${stats.limit} (${Math.round((stats.current / stats.limit) * 100)}%)`,
      inline: true,
    },
  );

  return interaction.editReply({ embeds: [embed] });
}

async function handleInfoStorage(interaction, guildId, ticketTranscript) {
  const usage = await ticketTranscript.getStorageUsage(guildId);

  const embed = createInfoEmbed(
    "Transcript Storage",
    "Transcript storage usage for this server.",
    interaction.client,
  ).addFields(
    {
      name: "Transcripts",
      value: usage.totalTranscripts.toString(),
      inline: true,
    },
    { name: "Storage", value: `${usage.totalSizeMB} MB`, inline: true },
    {
      name: "Avg Size",
      value:
        usage.totalTranscripts > 0
          ? `${((parseFloat(usage.totalSizeMB) / usage.totalTranscripts) * 1024).toFixed(2)} KB`
          : "0 KB",
      inline: true,
    },
  );

  return interaction.editReply({ embeds: [embed] });
}

// ─────────────────────────────────────────────────────────────────────────────
// /ticket panel (subcommand group router)
// ─────────────────────────────────────────────────────────────────────────────

export async function handlePanel(interaction) {
  const panelSubcommand = interaction.options.getSubcommand(false);

  if (panelSubcommand === "list") return await handlePanelList(interaction);
  if (panelSubcommand === "delete") return await handlePanelDelete(interaction);
  if (panelSubcommand === "add-category")
    return await handlePanelCategoryAdd(interaction);
  if (panelSubcommand === "remove-category")
    return await handlePanelCategoryRemove(interaction);
  if (panelSubcommand === "list-categories")
    return await handlePanelCategoryList(interaction);

  return interaction.reply({
    embeds: [
      createErrorEmbed(
        "Unknown panel subcommand.",
        "Invalid Subcommand",
        interaction.client,
      ),
    ],
    ephemeral: true,
  });
}

async function handlePanelCategoryAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const panelInput = interaction.options
    .getString("panel-id")
    .replace(/^#/, "");
  const label = interaction.options.getString("label");
  const keyword = interaction.options
    .getString("id")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const emoji = interaction.options.getString("emoji");
  const description = interaction.options.getString("description");
  const colorInput = interaction.options.getString("color");
  const guildId = interaction.guildId;

  const ticketPanel = getTicketPanel();
  const ticketManager = getTicketManager();
  await ticketPanel.initialize();
  await ticketManager.initialize();

  const panels = await ticketPanel.getGuildPanels(guildId);
  const formattedNum = panelInput.padStart(3, "0");
  const panel = panels.find(p => p.panelId.endsWith(`-${formattedNum}`));

  if (!panel) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Panel #${formattedNum} not found.`,
          "Panel Not Found",
          interaction.client,
        ),
      ],
    });
  }

  // Check category limit
  const ticketLimit = await ticketManager.checkTicketLimit(guildId);
  const maxCategories = ticketLimit.isPro
    ? PRO_ENGINE.MAX_CATEGORIES
    : FREE_TIER.MAX_CATEGORIES;

  if (panel.categories.length >= maxCategories) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Maximum ${maxCategories} categories allowed for this panel.${!ticketLimit.isPro ? " Upgrade to Pro for more!" : ""}`,
          "Limit Reached",
          interaction.client,
        ),
      ],
    });
  }

  // Check if ID already exists
  if (panel.categories.find(c => c.id === keyword)) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `A category with ID \`${keyword}\` already exists on this panel.`,
          "Duplicate ID",
          interaction.client,
        ),
      ],
    });
  }

  let color = null;
  if (colorInput) {
    color = parseInt(colorInput.replace("#", ""), 16) || null;
  }

  const newCategory = {
    id: keyword,
    label,
    emoji: emoji || null,
    description: description || null,
    color,
  };

  const updatedCategories = [...panel.categories, newCategory];
  await ticketPanel.updatePanel(panel.panelId, {
    categories: updatedCategories,
  });

  // Refresh Discord message
  await ticketPanel.refreshPanelMessage(interaction.guild, panel.panelId);

  return interaction.editReply({
    embeds: [
      createSuccessEmbed(
        `Category **${label}** has been added to panel \`#${formattedNum}\`.`,
        "Category Added",
        interaction.client,
      ),
    ],
  });
}

async function handlePanelCategoryRemove(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const panelInput = interaction.options
    .getString("panel-id")
    .replace(/^#/, "");
  const categoryId = interaction.options.getString("category-id");
  const guildId = interaction.guildId;

  const ticketPanel = getTicketPanel();
  await ticketPanel.initialize();

  const panels = await ticketPanel.getGuildPanels(guildId);
  const formattedNum = panelInput.padStart(3, "0");
  const panel = panels.find(p => p.panelId.endsWith(`-${formattedNum}`));

  if (!panel) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Panel #${formattedNum} not found.`,
          "Panel Not Found",
          interaction.client,
        ),
      ],
    });
  }

  const categoryIndex = panel.categories.findIndex(c => c.id === categoryId);
  if (categoryIndex === -1) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Category \`${categoryId}\` not found on this panel.`,
          "Category Not Found",
          interaction.client,
        ),
      ],
    });
  }

  // Prevent removing the last category
  if (panel.categories.length <= 1) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "A panel must have at least one category.",
          "Action Blocked",
          interaction.client,
        ),
      ],
    });
  }

  const removedCategory = panel.categories[categoryIndex];
  const updatedCategories = panel.categories.filter(c => c.id !== categoryId);

  await ticketPanel.updatePanel(panel.panelId, {
    categories: updatedCategories,
  });

  // Refresh Discord message
  await ticketPanel.refreshPanelMessage(interaction.guild, panel.panelId);

  return interaction.editReply({
    embeds: [
      createSuccessEmbed(
        `Category **${removedCategory.label}** (\`${categoryId}\`) has been removed from panel \`#${formattedNum}\`.`,
        "Category Removed",
        interaction.client,
      ),
    ],
  });
}

async function handlePanelCategoryList(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const panelInput = interaction.options
    .getString("panel-id")
    .replace(/^#/, "");
  const guildId = interaction.guildId;

  const ticketPanel = getTicketPanel();
  await ticketPanel.initialize();

  const panels = await ticketPanel.getGuildPanels(guildId);
  const formattedNum = panelInput.padStart(3, "0");
  const panel = panels.find(p => p.panelId.endsWith(`-${formattedNum}`));

  if (!panel) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Panel #${formattedNum} not found.`,
          "Panel Not Found",
          interaction.client,
        ),
      ],
    });
  }

  const categoryList = panel.categories
    .map(c => `• **${c.label}** (\`${c.id}\`)`)
    .join("\n");

  const embed = createInfoEmbed(
    `Categories for Panel #${formattedNum}`,
    `Here are all the categories configured for this panel:\n\n${categoryList}`,
    interaction.client,
  );

  return interaction.editReply({ embeds: [embed] });
}

async function handlePanelList(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  const ticketPanel = getTicketPanel();
  await ticketPanel.initialize();

  const panels = await ticketPanel.getGuildPanels(guildId);
  const panelLimit = await ticketPanel.checkPanelLimit(guildId);

  if (panels.length === 0) {
    return interaction.editReply({
      embeds: [
        createInfoEmbed(
          "Ticket Panels",
          `No ticket panels have been set up yet.\nUse </ticket setup:${interaction.commandId}> to create one.`,
          interaction.client,
        ),
      ],
    });
  }

  const panelList = panels
    .map(p => {
      const status = p.settings?.enabled ? "🟢" : "🔴";
      const link =
        p.messageId && p.channelId
          ? `([Jump to Panel](https://discord.com/channels/${guildId}/${p.channelId}/${p.messageId}))`
          : "";
      return `${status} **${p.title}** (\`#${p.panelId.split("-").pop()}\`) <#${p.channelId}> ${link}`;
    })
    .join("\n");

  const embed = createInfoEmbed(
    `Ticket Panels (${panels.length} / ${panelLimit.max})`,
    "Here are all the ticket panels configured for this server:\n\n" +
      panelList,
    interaction.client,
  );

  return interaction.editReply({ embeds: [embed] });
}

async function handlePanelDelete(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const panelInput = interaction.options
    .getString("panel-id")
    .replace(/^#/, "");
  const guildId = interaction.guildId;
  const formattedNum = panelInput.padStart(3, "0");

  const ticketPanel = getTicketPanel();
  await ticketPanel.initialize();

  const panels = await ticketPanel.getGuildPanels(guildId);
  const panel = panels.find(p => p.panelId.endsWith(`-${formattedNum}`));

  if (!panel) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Panel #${formattedNum} not found.`,
          "Panel Not Found",
          interaction.client,
        ),
      ],
    });
  }

  // Delete the Discord message if it still exists
  if (panel.messageId && panel.channelId) {
    try {
      const channel = await interaction.guild.channels.fetch(panel.channelId);
      if (channel?.isTextBased()) {
        const message = await channel.messages
          .fetch(panel.messageId)
          .catch(() => null);
        if (message) await message.delete();
      }
    } catch (_err) {
      logger.debug("Panel message already deleted or channel not found");
    }
  }

  const success = await ticketPanel.deletePanel(panel.panelId);

  if (success) {
    return interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `Panel \`#${panel.panelId.split("-").pop()}\` has been deleted successfully.\n\n` +
            `Existing tickets are not affected.`,
          "Panel Deleted",
          interaction.client,
        ),
      ],
    });
  }

  return interaction.editReply({
    embeds: [
      createErrorEmbed(
        "Failed to delete panel. Please try again.",
        "Deletion Failed",
        interaction.client,
      ),
    ],
  });
}

/**
 * handleSettings - Interactive Ticket Dashboard
 */
export async function handleSettings(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  const ticketManager = getTicketManager();
  const ticketPanel = getTicketPanel();
  const ticketTranscript = getTicketTranscript();

  await ticketManager.initialize();
  await ticketPanel.initialize();
  await ticketTranscript.initialize();

  const renderDashboard = async inter => {
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
    const panels = await ticketPanel.getGuildPanels(guildId);
    const panelLimit = await ticketPanel.checkPanelLimit(guildId);
    const ticketLimit = await ticketManager.checkTicketLimit(guildId);

    const staffRoleId = settings?.ticketSettings?.staffRoleId;
    const staffRoleDisplay = staffRoleId
      ? `${EMOJIS.FEATURES.ROLES} <@&${staffRoleId}>`
      : `${EMOJIS.STATUS.ERROR} Not Set`;

    const logChannelId = settings?.ticketSettings?.transcriptChannelId;
    const logChannelDisplay = logChannelId
      ? `${EMOJIS.UI.CHANNELS} <#${logChannelId}>`
      : `${EMOJIS.STATUS.ERROR} Not Set`;

    const allowUserTranscripts =
      settings?.ticketSettings?.allowUserTranscripts !== false;
    const accessDisplay = allowUserTranscripts
      ? `${EMOJIS.STATUS.SUCCESS} Enabled`
      : `${EMOJIS.STATUS.ERROR} Disabled`;

    const embed = new EmbedBuilder()
      .setTitle("Ticketing System")
      .setDescription("Configure support tickets for your server")
      .setColor(0x5865f2) // Primary blurple
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Ticketing System",
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .addFields([
        {
          name: "Staff Role",
          value: staffRoleDisplay,
          inline: true,
        },
        {
          name: "Log Channel",
          value: logChannelDisplay,
          inline: true,
        },
        {
          name: "Transcript Access",
          value: accessDisplay,
          inline: true,
        },
        {
          name: "System Statistics",
          value: `**Active Panels:** ${panels.length}/${panelLimit.max}\n**Tickets Used:** ${ticketLimit.current}/${ticketLimit.max}`,
          inline: false,
        },
      ]);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("t_set_staff")
        .setLabel("Configure Staff Role")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("t_set_logs")
        .setLabel("Set Log Channel")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("t_set_access")
        .setLabel(
          allowUserTranscripts ? "Disable Transcripts" : "Enable Transcripts",
        )
        .setStyle(
          allowUserTranscripts ? ButtonStyle.Secondary : ButtonStyle.Primary,
        ),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("t_list_panels")
        .setLabel("View Panels")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("t_refresh")
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("t_purge_data")
        .setLabel("Purge All Data")
        .setStyle(ButtonStyle.Danger),
    );

    const response = {
      embeds: [embed],
      components: [row1, row2, row3],
    };

    if (inter.replied || inter.deferred) {
      return await inter.editReply(response);
    } else {
      return await inter.update(response);
    }
  };

  const message = await renderDashboard(interaction);

  // Interaction Collector
  const collector = message.createMessageComponentCollector({
    time: 600000, // 10 minutes
  });

  collector.on("collect", async i => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({
        content: "This menu is not for you.",
        ephemeral: true,
      });
    }

    if (i.customId === "t_refresh") {
      return await renderDashboard(i);
    }

    if (i.customId === "t_set_staff") {
      const roleRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("t_role_select")
          .setPlaceholder("Select the Staff Role")
          .setMaxValues(1),
      );
      return await i.update({
        content: "Please select the role that should handle tickets:",
        components: [roleRow],
      });
    }

    if (i.customId === "t_set_logs") {
      const chanRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("t_chan_select")
          .setPlaceholder("Select the Transcript Log Channel")
          .addChannelTypes(0), // Text channels
      );
      return await i.update({
        content: "Please select the channel where transcripts should be sent:",
        components: [chanRow],
      });
    }

    if (i.customId === "t_set_access") {
      const settings =
        await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
      settings.ticketSettings = settings.ticketSettings || {};
      const current = settings.ticketSettings.allowUserTranscripts !== false;
      settings.ticketSettings.allowUserTranscripts = !current;
      await ticketManager.storage.dbManager.guildSettings.set(
        guildId,
        settings,
      );
      return await renderDashboard(i);
    }

    if (i.customId === "t_list_panels") {
      await handlePanelList(i);
      return;
    }

    // Handle Select Menus
    if (i.customId === "t_role_select") {
      const roleId = i.values[0];
      const settings =
        await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
      settings.ticketSettings = settings.ticketSettings || {};
      settings.ticketSettings.staffRoleId = roleId;
      await ticketManager.storage.dbManager.guildSettings.set(
        guildId,
        settings,
      );
      return await renderDashboard(i);
    }

    if (i.customId === "t_chan_select") {
      const channelId = i.values[0];
      const settings =
        await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
      settings.ticketSettings = settings.ticketSettings || {};
      settings.ticketSettings.transcriptChannelId = channelId;
      await ticketManager.storage.dbManager.guildSettings.set(
        guildId,
        settings,
      );
      return await renderDashboard(i);
    }

    if (i.customId === "t_purge_data") {
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("t_confirm_purge")
          .setLabel("Confirm Total Purge")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("t_refresh")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary),
      );

      return await i.update({
        content: `### 🚨 TOTAL PURGE\nThis will permanently delete:\n- **ALL** Active and Closed Tickets\n- **ALL** Saved Transcripts\n- **RESET** the counter to #0001\n\n**This action cannot be undone.**`,
        embeds: [],
        components: [confirmRow],
      });
    }

    if (i.customId === "t_confirm_purge") {
      await ticketManager.purgeGuildData(guildId);
      return await renderDashboard(i);
    }
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch {}
  });
}
