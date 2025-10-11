import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { createAvatarEmbed, createErrorEmbed } from "./embeds.js";
import { createAvatarButtons } from "./components.js";

export async function execute(interaction, _client) {
  const logger = getLogger();

  // Defer immediately to prevent timeout
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const targetUser = interaction.options.getUser("user") || interaction.user;

    // Get server member for server-specific avatar
    const member = interaction.guild?.members.cache.get(targetUser.id);
    const serverAvatar = member?.displayAvatarURL({
      size: 1024,
      dynamic: true,
    });
    const globalAvatar = targetUser.displayAvatarURL({
      size: 1024,
      dynamic: true,
    });
    const hasServerAvatar = serverAvatar !== globalAvatar;

    // Create buttons
    const buttons = createAvatarButtons(targetUser);

    // Create embed
    const embed = createAvatarEmbed(
      targetUser,
      globalAvatar,
      serverAvatar,
      hasServerAvatar,
    );

    await interaction.editReply({ embeds: [embed], components: [buttons] });
    logger.logCommand("avatar", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in avatar command", error);
    await interaction.editReply({
      embeds: [createErrorEmbed()],
    });
  }
}
