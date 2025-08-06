import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { hasAdminPermissions } from "../../utils/discord/permissions.js";
import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { THEME_COLOR, EMOJIS } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";
import {
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";
import { testWelcomeSystem } from "../../utils/discord/welcomeUtils.js";

export const data = new SlashCommandBuilder()
  .setName("test-welcome")
  .setDescription("Test the welcome system by sending a sample welcome message")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction, _client) {
  const logger = getLogger();
  const startTime = Date.now();

  await interaction.deferReply({ flags: 64 });

  try {
    // Validate user permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply(
        permissionErrorEmbed({
          requiredPermissions: ["ManageGuild"],
          userPermissions: interaction.member.permissions.toArray(),
          tip: "You need Manage Guild permissions to test the welcome system.",
        }),
      );
    }

    // Get database manager and settings
    const dbManager = await getDatabaseManager();

    // Check if welcome settings repository is available
    if (!dbManager.welcomeSettings) {
      return interaction.editReply(
        errorEmbed({
          title: "Database Error",
          description: "Welcome settings repository is not available.",
          solution:
            "Please restart the bot or contact support if the issue persists.",
        }),
      );
    }

    const settings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Check if welcome system is configured
    if (!settings.enabled) {
      return interaction.editReply(
        errorEmbed({
          title: "Welcome System Not Enabled",
          description:
            "The welcome system is not currently enabled for this server.",
          solution:
            "Use `/setup-welcome` to configure and enable the welcome system.",
        }),
      );
    }

    if (!settings.channelId) {
      return interaction.editReply(
        errorEmbed({
          title: "Welcome Channel Not Set",
          description:
            "No welcome channel has been configured for this server.",
          solution: "Use `/setup-welcome` to set a welcome channel.",
        }),
      );
    }

    // Get the welcome channel
    const welcomeChannel = interaction.guild.channels.cache.get(
      settings.channelId,
    );
    if (!welcomeChannel) {
      return interaction.editReply(
        errorEmbed({
          title: "Welcome Channel Not Found",
          description: `The configured welcome channel (${settings.channelId}) no longer exists.`,
          solution: "Use `/setup-welcome` to reconfigure the welcome system.",
        }),
      );
    }

    // Check bot permissions in welcome channel
    if (
      !welcomeChannel
        .permissionsFor(interaction.client.user)
        .has("SendMessages")
    ) {
      return interaction.editReply(
        errorEmbed({
          title: "Permission Error",
          description: `I don't have permission to send messages in ${welcomeChannel.toString()}`,
          solution:
            "Please grant me Send Messages permission in the welcome channel.",
        }),
      );
    }

    // Use the actual interaction member for testing (has real roles functionality)
    const member = interaction.member;

    // Test the welcome system using the reusable function
    const testResult = await testWelcomeSystem(
      settings,
      member,
      welcomeChannel,
      logger,
    );

    if (!testResult.success) {
      return interaction.editReply(
        errorEmbed({
          title: "Test Failed",
          description: testResult.error,
          solution: testResult.solution,
        }),
      );
    }

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`${EMOJIS.STATUS.SUCCESS} Welcome Test Successful`)
      .setDescription(
        `Test welcome message sent to ${welcomeChannel.toString()}`,
      )
      .addFields([
        {
          name: `${EMOJIS.UI.CHANNELS} Channel`,
          value: welcomeChannel.toString(),
          inline: true,
        },
        {
          name: `${EMOJIS.UI.IMAGE} Format`,
          value: testResult.format,
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.ROLES} Auto-Role Test`,
          value: settings.autoRoleId
            ? testResult.roleTestResult
              ? "✅ Role assignment would work"
              : `❌ Role assignment failed: ${testResult.roleTestDetails}`
            : "No auto-role configured",
          inline: true,
        },
        {
          name: `${EMOJIS.UI.QUESTION} Message`,
          value: settings.message || "Default message",
          inline: false,
        },
      ])
      .setFooter({
        text: `${EMOJIS.FEATURES.ROLES} Welcome System Test • ${interaction.guild.name}`,
        iconURL: interaction.guild.iconURL(),
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [successEmbed],
    });

    logger.info(
      `Welcome system tested for ${interaction.guild.name} by ${interaction.user.tag} (${Date.now() - startTime}ms)`,
    );
  } catch (error) {
    logger.error(
      `Failed to test welcome system for ${interaction.guild.name}`,
      error,
    );
    await interaction.editReply(
      errorEmbed({
        title: "Test Error",
        description: "An error occurred while testing the welcome system.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
