import { EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../../config/theme.js";

export function createSupportEmbed(user) {
  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.UI.INFO} Support`)
    .setDescription("Need help with the bot? Here's how to get support!")
    .addFields(
      {
        name: "🆘 How to Get Help",
        value: [
          "• 📚 **Help Command** - Use `/help` for command information",
          "• 🎯 **Specific Help** - Use `/help command:command_name` for detailed help",
          "• 💬 **Community** - Join our support server for assistance",
          "• 📖 **Documentation** - Check our comprehensive guides",
        ].join("\n"),
        inline: false,
      },
      {
        name: "🐛 Report Issues",
        value: [
          "• 🔍 **Bug Reports** - Report bugs with detailed information",
          "• 💡 **Feature Requests** - Suggest new features and improvements",
          "• ⚡ **Performance Issues** - Report slow responses or errors",
          "• 📱 **Compatibility** - Report issues with different platforms",
        ].join("\n"),
        inline: false,
      },
    )
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Requested by ${user.username}`,
        user.displayAvatarURL(),
      ),
    )
    .setTimestamp();
}

export function createErrorEmbed() {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
    .setDescription("Sorry, an error occurred.");
}
