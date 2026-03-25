import { CORE_STATUS } from "../../../../features/premium/config.js";
import { MessageFlags } from "discord.js";
import { getTicketPanel } from "../../../../features/ticketing/TicketPanel.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { getLogger } from "../../../../utils/logger.js";
import {
  createInfoEmbed,
  createSuccessEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";
import {
  FREE_TIER,
  PRO_ENGINE,
} from "../../../../features/ticketing/config.js";

const logger = getLogger();

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
    flags: [MessageFlags.Ephemeral],
  });
}

async function handlePanelCategoryAdd(interaction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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
          `Maximum ${maxCategories} categories allowed for this panel.${!ticketLimit.isPro ? ` Upgrade to **${CORE_STATUS.PRO.emoji} Pro Engine** for more! Enable it on our **[website](https://rolereactor.app)** using Cores.` : ""}`,
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
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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
