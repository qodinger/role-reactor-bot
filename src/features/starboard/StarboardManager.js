import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { getLogger } from "../../utils/logger.js";

export class StarboardManager {
  static async handleReaction(reaction, _user) {
    const logger = getLogger();

    try {
      if (reaction.partial) {
        await reaction.fetch();
      }

      const message = reaction.message;
      if (message.partial) {
        await message.fetch();
      }

      if (!message.guild) return;

      const db = await getDatabaseManager();
      if (!db || !db.starboardSettings) return;

      const guildId = message.guild.id;
      const settings = await db.starboardSettings.getSettings(guildId);

      if (!settings || !settings.enabled || !settings.channelId) return;

      // Determine the reaction emoji string to match
      const reactionEmojiStr = reaction.emoji.id
        ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
        : reaction.emoji.name;

      if (reactionEmojiStr !== settings.emoji) return;

      // Ignore messages sent in the starboard channel itself
      if (message.channel.id === settings.channelId) return;

      // Ignore bot messages by default for starboard
      if (message.author.bot) return;

      // Calculate stars
      const starCount = reaction.count;

      const mapping = await db.starboardMessages.getMessageMapping(
        guildId,
        message.id,
      );

      const starboardChannel =
        message.guild.channels.cache.get(settings.channelId) ||
        (await message.guild.channels
          .fetch(settings.channelId)
          .catch(() => null));

      if (!starboardChannel) return; // Starboard channel deleted or inaccessible

      // If it falls below threshold
      if (starCount < settings.threshold) {
        if (mapping && mapping.starboardMessageId) {
          try {
            const starboardMsg = await starboardChannel.messages.fetch(
              mapping.starboardMessageId,
            );
            if (starboardMsg) {
              await starboardMsg.delete();
            }
          } catch (_error) {
            // Message might already be deleted
          }
          await db.starboardMessages.deleteMessageMapping(guildId, message.id);
        }
        return;
      }

      // It meets or exceeds threshold
      const embed = await this.buildStarboardEmbed(
        message,
        starCount,
        settings.emoji,
      );
      const components = this.buildStarboardComponents(message);
      const content = `${settings.emoji} **${starCount}** | <#${message.channel.id}>`;

      if (mapping && mapping.starboardMessageId) {
        // Update existing
        try {
          const starboardMsg = await starboardChannel.messages.fetch(
            mapping.starboardMessageId,
          );
          if (starboardMsg) {
            await starboardMsg.edit({ content, embeds: [embed], components });
          }
        } catch (_error) {
          // If the message was deleted from the starboard, create a new one
          const newMsg = await starboardChannel.send({
            content,
            embeds: [embed],
            components,
          });
          await db.starboardMessages.upsertMessageMapping(guildId, message.id, {
            channelId: message.channel.id,
            starboardMessageId: newMsg.id,
            stars: starCount,
            authorId: message.author.id,
          });
        }
      } else {
        // Create new
        const newMsg = await starboardChannel.send({
          content,
          embeds: [embed],
          components,
        });
        await db.starboardMessages.upsertMessageMapping(guildId, message.id, {
          channelId: message.channel.id,
          starboardMessageId: newMsg.id,
          stars: starCount,
          authorId: message.author.id,
        });
      }
    } catch (error) {
      logger.error("StarboardManager error:", error);
    }
  }

  static async buildStarboardEmbed(message, starCount, _emoji) {
    // Dynamic heat-map color: gold → orange → red as star count grows
    const color =
      starCount >= 10 ? 0xe74c3c : starCount >= 5 ? 0xe67e22 : 0xfee75c;

    const embed = new EmbedBuilder().setColor(color).setAuthor({
      name: message.author.username,
      iconURL: message.author.displayAvatarURL({ dynamic: true }),
      url: message.url, // clicking the author name jumps to the original message
    });

    if (message.content) {
      embed.setDescription(message.content);
    }

    // Reply context: show a snippet of the message being replied to
    if (message.reference?.messageId) {
      try {
        const replied = await message.channel.messages.fetch(
          message.reference.messageId,
        );
        const snippet = replied.content
          ? replied.content.slice(0, 80) +
            (replied.content.length > 80 ? "…" : "")
          : "(no text content)";
        embed.addFields({
          name: `↩️ Replying to ${replied.author.username}`,
          value: `[${snippet}](${replied.url})`,
          inline: false,
        });
      } catch (_) {
        // Referenced message may have been deleted — silently skip
      }
    }

    // Embed the first image attachment
    const imageAttachment = message.attachments.find(
      a => a.contentType && a.contentType.startsWith("image/"),
    );
    if (imageAttachment) {
      embed.setImage(imageAttachment.url);
    }

    // List any extra non-image attachments as named clickable links
    const otherAttachments = [
      ...message.attachments
        .filter(a => !a.contentType || !a.contentType.startsWith("image/"))
        .values(),
    ];
    if (otherAttachments.length > 0) {
      const lines = otherAttachments.map(a => {
        const icon = a.contentType?.startsWith("video/")
          ? "🎬"
          : a.contentType?.startsWith("audio/")
            ? "🎵"
            : "📁";
        return `${icon} [${a.name}](${a.url})`;
      });
      embed.addFields({
        name: "📎 Attachments",
        value: lines.join("\n"),
        inline: false,
      });
    }

    return embed;
  }

  static buildStarboardComponents(message) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Jump to Message")
        .setStyle(ButtonStyle.Link)
        .setURL(message.url),
    );
    return [row];
  }
}
