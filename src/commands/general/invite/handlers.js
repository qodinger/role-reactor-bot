import { MessageFlags, EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";
import { getDefaultInviteLink } from "../../../utils/discord/invite.js";
import { createInviteEmbed } from "./embeds.js";
import { createInviteButtons } from "./components.js";

export async function execute(interaction, client) {
  try {
    // Defer immediately to prevent timeout
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    // Generate invite link dynamically
    let inviteLink = client.inviteLink;
    if (!inviteLink) {
      inviteLink = await getDefaultInviteLink(client);
    }
    if (!inviteLink) {
      throw new Error("Unable to generate invite link.");
    }

    const botName = client.user?.username || "Role Reactor";
    const botAvatar = client.user?.displayAvatarURL() || null;
    const userName = interaction.user.displayName || interaction.user.username;

    const embed = createInviteEmbed(botName, botAvatar, userName, inviteLink);
    const buttons = await createInviteButtons(inviteLink);

    await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });
  } catch (_error) {
    const errorEmbed = new EmbedBuilder()
      .setTitle("Invite Error")
      .setDescription(
        "Unable to generate invite link. Please try again later or contact support.",
      )
      .setColor(THEME.ERROR || 0xfca5a5);

    await interaction.editReply({
      content: "",
      embeds: [errorEmbed],
    });
  }
}
