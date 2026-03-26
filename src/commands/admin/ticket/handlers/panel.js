import { MessageFlags } from "discord.js";
import { getTicketPanel } from "../../../../features/ticketing/TicketPanel.js";
import { getLogger } from "../../../../utils/logger.js";
import {
  createInfoEmbed,
  createSuccessEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";

const logger = getLogger();

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
    flags: [MessageFlags.Ephemeral],
  });
}

async function handlePanelList(interaction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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
