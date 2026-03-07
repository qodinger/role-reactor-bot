import { getTicketPanel } from "../../../../features/ticketing/TicketPanel.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { getTicketTranscript } from "../../../../features/ticketing/TicketTranscript.js";
import { getLogger } from "../../../../utils/logger.js";
import {
  createInfoEmbed,
  createSuccessEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";
import { DEFAULT_CATEGORY } from "../../../../features/ticketing/config.js";

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

  const ticketPanel = getTicketPanel();
  await ticketPanel.initialize();

  const result = await ticketPanel.createPanel({
    guildId: interaction.guildId,
    channelId: channel.id,
    title,
    description,
    categories: [DEFAULT_CATEGORY],
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
// /ticket staff-role
// ─────────────────────────────────────────────────────────────────────────────

export async function handleStaffRole(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const role = interaction.options.getRole("role");
  const guildId = interaction.guildId;

  try {
    const ticketManager = getTicketManager();
    await ticketManager.initialize();

    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
    settings.ticketSettings = settings.ticketSettings || {};
    settings.ticketSettings.staffRoleId = role.id;
    await ticketManager.storage.dbManager.guildSettings.set(guildId, settings);

    return interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `Staff role has been successfully set to <@&${role.id}> for all ticket operations.`,
          "Configuration Saved",
          interaction.client,
        ),
      ],
    });
  } catch (error) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Failed to save staff role: ${error.message}`,
          "Save Failed",
          interaction.client,
        ),
      ],
    });
  }
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

  const embed = createInfoEmbed(
    "Ticket System Information",
    "Current ticket system limits and settings.",
    interaction.client,
  ).addFields(
    { name: "Staff Role", value: staffRoleDisplay, inline: true },
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
      value: ticketLimit.isPro ? "HTML, PDF, JSON" : "HTML only",
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
      return `${status} **${p.title}** (\`#${p.panelId.split("-").pop()}\`)`;
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
