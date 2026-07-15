import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  handleAutomodSettings,
  handleEnable,
  handleDisable,
  handleBadwordsToggle,
  handleBadwordsWords,
  handleLinksToggle,
  handleSpamToggle,
  handleMentionSpamToggle,
  handleInviteToggle,
  handleCapsLockToggle,
  handleDomainsAdd,
  handleDomainsRemove,
  handleDomainsList,
  handleDomainsClear,
  handleLogChannel,
  handleIgnoredRoles,
  handleIgnoredChannels,
  handleStatsShow,
} from "./handlers.js";

// Hide from help system until ready for release
export const disabled = false;

// ============================================================================
// COMMAND METADATA
// ============================================================================

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "automod",
  category: "admin",
  description: "Configure auto-moderation settings",
  keywords: ["automod", "auto-mod", "moderation", "spam", "filter", "badwords"],
  emoji: "🛡️",
  createdAt: "2026-04-23",
  premium: false, // Has free tier + premium features
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/automod settings```",
        "```/automod enable```",
        "```/automod disable```",
        "```/automod badwords toggle enabled:true```",
        "```/automod badwords words word1,word2```",
        "```/automod links toggle enabled:true```",
        "```/automod spam toggle enabled:true```",
        "```/automod mention-spam toggle enabled:true```",
        "```/automod invite toggle enabled:true```",
        "```/automod caps-lock toggle enabled:true```",
        "```/automod domains add youtube.com,discord.com```",
        "```/automod log-channel #mod-logs```",
        "```/automod ignored-roles @Role1,@Role2```",
        "```/automod ignored-channels #general,#off-topic```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands (Free)`,
      value: [
        "**settings** - Interactive settings panel",
        "**enable** - Enable all configured filters",
        "**disable** - Disable all filters",
        "**badwords toggle** - Enable or disable bad words filter",
        "**badwords words** - Set bad words list (comma separated)",
        "**links toggle** - Enable or disable link filter",
        "**spam toggle** - Enable or disable spam detection",
        "**mention-spam toggle** - Enable or disable mention spam filter",
        "**invite toggle** - Enable or disable invite link filter",
        "**caps-lock toggle** - Enable or disable caps lock filter",
        "**domains add** - Add allowed domains (comma separated)",
        "**domains remove** - Remove allowed domains",
        "**domains list** - Show allowed domains",
        "**domains clear** - Clear all allowed domains",
        "**log-channel** - Set channel for automod logs",
        "**ignored-roles** - Set roles to ignore (comma separated)",
        "**ignored-channels** - Set channels to ignore (comma separated)",
        "**stats show** - Show violation statistics",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Options`,
      value: [
        "**enabled** *(required for toggle)* - Enable or disable the filter",
        "**action** *(optional)* - Action to take: delete, timeout, kick, ban",
        "**timeout-duration** *(optional)* - Timeout duration in minutes (1-60)",
        "**ignore-admins** *(optional)* - Don't affect admins/mods",
        "**threshold** *(spam only)* - Repeated messages to trigger (3-10)",
        "**rate-threshold** *(spam only)* - Messages per 5s to trigger (3-10)",
        "**words** *(badwords)* - Bad words list (comma separated)",
        "**domains** *(domains)* - Allowed domains (comma separated)",
        "**channel** *(log-channel)* - Channel for automod logs",
        "**roles** *(ignored-roles)* - Roles to ignore (comma separated)",
        "**channels** *(ignored-channels)* - Channels to ignore (comma separated)",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value:
        "• **Manage Server** permission required for all automod commands",
      inline: false,
    },
    {
      name: `Key Features`,
      value: [
        "**6 Free Filters** - Bad words, links, spam, mentions, invites, caps lock",
        "**Multiple Actions** - Delete message, timeout, kick, or ban users",
        "**Quick Setup** - Enable all filters with one click",
        "**Domain Allowlist** - Allow specific domains while blocking others",
        "**Ignore List** - Skip automod for specific roles and channels",
        "**Log Channel** - Dedicated channel for automod logs",
        "**Statistics** - Track violations by type and day",
      ].join("\n"),
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub =>
    sub.setName("settings").setDescription("Open auto-moderation settings"),
  )
  .addSubcommand(sub =>
    sub.setName("enable").setDescription("Enable all configured filters"),
  )
  .addSubcommand(sub =>
    sub.setName("disable").setDescription("Disable all filters"),
  )
  .addSubcommandGroup(group =>
    group
      .setName("badwords")
      .setDescription("Bad words filter settings")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable bad words filter")
          .addBooleanOption(option =>
            option
              .setName("enabled")
              .setDescription("Enable filter?")
              .setRequired(true),
          )
          .addStringOption(option =>
            option
              .setName("action")
              .setDescription("Action when bad word detected")
              .addChoices(
                { name: "Delete Message", value: "delete" },
                { name: "Timeout User", value: "timeout" },
                { name: "Kick User", value: "kick" },
                { name: "Ban User", value: "ban" },
              ),
          )
          .addIntegerOption(option =>
            option
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60),
          )
          .addBooleanOption(option =>
            option
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)"),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("words")
          .setDescription("Set bad words list (comma separated)")
          .addStringOption(option =>
            option
              .setName("words")
              .setDescription("Words to filter")
              .setRequired(true),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("links")
      .setDescription("Link filter settings")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable link filter")
          .addBooleanOption(option =>
            option
              .setName("enabled")
              .setDescription("Enable filter?")
              .setRequired(true),
          )
          .addStringOption(option =>
            option
              .setName("action")
              .setDescription("Action when link detected")
              .addChoices(
                { name: "Delete Message", value: "delete" },
                { name: "Timeout User", value: "timeout" },
                { name: "Kick User", value: "kick" },
                { name: "Ban User", value: "ban" },
              ),
          )
          .addIntegerOption(option =>
            option
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60),
          )
          .addBooleanOption(option =>
            option
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)"),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("spam")
      .setDescription("Spam detection settings")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable spam detection")
          .addBooleanOption(option =>
            option
              .setName("enabled")
              .setDescription("Enable detection?")
              .setRequired(true),
          )
          .addIntegerOption(option =>
            option
              .setName("threshold")
              .setDescription("Repeated messages to trigger (3-10)")
              .setMinValue(3)
              .setMaxValue(10),
          )
          .addIntegerOption(option =>
            option
              .setName("rate-threshold")
              .setDescription("Messages per 5s to trigger spam (3-10)")
              .setMinValue(3)
              .setMaxValue(10),
          )
          .addStringOption(option =>
            option
              .setName("action")
              .setDescription("Action when spam detected")
              .addChoices(
                { name: "Delete Message", value: "delete" },
                { name: "Timeout User", value: "timeout" },
                { name: "Kick User", value: "kick" },
                { name: "Ban User", value: "ban" },
              ),
          )
          .addIntegerOption(option =>
            option
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60),
          )
          .addBooleanOption(option =>
            option
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)"),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("mention-spam")
      .setDescription("Mention spam settings")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable mention spam filter")
          .addBooleanOption(option =>
            option
              .setName("enabled")
              .setDescription("Enable filter?")
              .setRequired(true),
          )
          .addIntegerOption(option =>
            option
              .setName("mention-count")
              .setDescription("Mentions to trigger (3-20)")
              .setMinValue(3)
              .setMaxValue(20),
          )
          .addStringOption(option =>
            option
              .setName("action")
              .setDescription("Action when mention spam detected")
              .addChoices(
                { name: "Delete Message", value: "delete" },
                { name: "Timeout User", value: "timeout" },
                { name: "Kick User", value: "kick" },
                { name: "Ban User", value: "ban" },
              ),
          )
          .addIntegerOption(option =>
            option
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60),
          )
          .addBooleanOption(option =>
            option
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)"),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("invite")
      .setDescription("Invite link filter settings")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable invite link filter")
          .addBooleanOption(option =>
            option
              .setName("enabled")
              .setDescription("Enable filter?")
              .setRequired(true),
          )
          .addStringOption(option =>
            option
              .setName("action")
              .setDescription("Action when invite link detected")
              .addChoices(
                { name: "Delete Message", value: "delete" },
                { name: "Timeout User", value: "timeout" },
                { name: "Kick User", value: "kick" },
                { name: "Ban User", value: "ban" },
              ),
          )
          .addIntegerOption(option =>
            option
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60),
          )
          .addBooleanOption(option =>
            option
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)"),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("caps-lock")
      .setDescription("Caps lock filter settings")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable caps lock filter")
          .addBooleanOption(option =>
            option
              .setName("enabled")
              .setDescription("Enable filter?")
              .setRequired(true),
          )
          .addIntegerOption(option =>
            option
              .setName("threshold")
              .setDescription("Caps percentage to trigger (50-100)")
              .setMinValue(50)
              .setMaxValue(100),
          )
          .addIntegerOption(option =>
            option
              .setName("min-length")
              .setDescription("Minimum message length to check")
              .setMinValue(1)
              .setMaxValue(100),
          )
          .addStringOption(option =>
            option
              .setName("action")
              .setDescription("Action when caps detected")
              .addChoices(
                { name: "Delete Message", value: "delete" },
                { name: "Timeout User", value: "timeout" },
                { name: "Kick User", value: "kick" },
                { name: "Ban User", value: "ban" },
              ),
          )
          .addIntegerOption(option =>
            option
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60),
          )
          .addBooleanOption(option =>
            option
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)"),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("domains")
      .setDescription("Domain allowlist settings")
      .addSubcommand(sub =>
        sub
          .setName("add")
          .setDescription("Add allowed domains (comma separated)")
          .addStringOption(option =>
            option
              .setName("domains")
              .setDescription("Domains to allow (e.g., youtube.com,discord.com)")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("remove")
          .setDescription("Remove allowed domains (comma separated)")
          .addStringOption(option =>
            option
              .setName("domains")
              .setDescription("Domains to remove")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub.setName("list").setDescription("Show allowed domains"),
      )
      .addSubcommand(sub =>
        sub.setName("clear").setDescription("Clear all allowed domains"),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("log-channel")
      .setDescription("Set channel for automod logs")
      .addChannelOption(option =>
        option
          .setName("channel")
          .setDescription("Channel for automod logs")
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("ignored-roles")
      .setDescription("Set roles to ignore (comma separated)")
      .addStringOption(option =>
        option
          .setName("roles")
          .setDescription("Role IDs to ignore (comma separated)")
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("ignored-channels")
      .setDescription("Set channels to ignore (comma separated)")
      .addStringOption(option =>
        option
          .setName("channels")
          .setDescription("Channel IDs to ignore (comma separated)")
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub.setName("stats").setDescription("Show violation statistics"),
  );

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      const response = errorEmbed({
        title: "Permission Denied",
        description:
          "You need Manage Server permissions to configure the auto-moderation system.",
        solution: "Contact a server administrator for assistance.",
      });

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Defer the interaction to prevent timeout
    let deferred = false;
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        deferred = true;
      }
    } catch (deferError) {
      logger.warn("Failed to defer interaction, proceeding without deferral", {
        interactionId: interaction.id,
        error: deferError.message,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup();

    logger.debug(
      `Automod command executed by ${interaction.user.username} (${interaction.user.id}): ${subcommandGroup || ""} ${subcommand}`,
    );

    if (subcommandGroup) {
      switch (subcommandGroup) {
        case "badwords":
          if (subcommand === "toggle") {
            await handleBadwordsToggle(interaction);
          } else if (subcommand === "words") {
            await handleBadwordsWords(interaction);
          }
          break;
        case "links":
          if (subcommand === "toggle") {
            await handleLinksToggle(interaction);
          }
          break;
        case "spam":
          if (subcommand === "toggle") {
            await handleSpamToggle(interaction);
          }
          break;
        case "mention-spam":
          if (subcommand === "toggle") {
            await handleMentionSpamToggle(interaction);
          }
          break;
        case "invite":
          if (subcommand === "toggle") {
            await handleInviteToggle(interaction);
          }
          break;
        case "caps-lock":
          if (subcommand === "toggle") {
            await handleCapsLockToggle(interaction);
          }
          break;
        case "domains":
          switch (subcommand) {
            case "add":
              await handleDomainsAdd(interaction);
              break;
            case "remove":
              await handleDomainsRemove(interaction);
              break;
            case "list":
              await handleDomainsList(interaction);
              break;
            case "clear":
              await handleDomainsClear(interaction);
              break;
          }
          break;
      }
    } else {
      switch (subcommand) {
        case "settings":
          await handleAutomodSettings(interaction);
          break;
        case "enable":
          await handleEnable(interaction);
          break;
        case "disable":
          await handleDisable(interaction);
          break;
        case "log-channel":
          await handleLogChannel(interaction);
          break;
        case "ignored-roles":
          await handleIgnoredRoles(interaction);
          break;
        case "ignored-channels":
          await handleIgnoredChannels(interaction);
          break;
        case "stats":
          await handleStatsShow(interaction);
          break;
      }
    }
  } catch (error) {
    logger.error("Error in automod command:", error);
    const response = errorEmbed({
      title: "Error",
      description: "Failed to process automod command.",
      solution: "Please try again or contact support if the issue persists.",
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(response).catch(() => {});
    } else {
      await interaction.reply(response).catch(() => {});
    }
  }
}
