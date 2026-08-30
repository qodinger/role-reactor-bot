import { EmbedBuilder } from "discord.js";
import { THEME, UI_COMPONENTS } from "../../../config/theme.js";

/**
 * Build a test alert embed for the given alert type.
 * @param {string} alertType - goLive | offline | follow | subscribe | giftSub | raid | resub
 * @returns {EmbedBuilder|null}
 */
export function buildAlertTestEmbed(alertType) {
  switch (alertType) {
    case "goLive":
      return new EmbedBuilder()
        .setTitle("🔴 Now Streaming! (TEST)")
        .setDescription("TestStreamer is now live!")
        .addFields(
          { name: "Category", value: "Just Chatting", inline: true },
          { name: "Viewers", value: "42", inline: true },
        )
        .setURL("https://twitch.tv/teststreamer")
        .setImage(
          "https://static-cdn.jtvnw.net/previews-ttv/live_user_teststreamer-1920x1080.jpg",
        )
        .setColor(THEME.TWITCH)
        .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
        .setTimestamp();
    case "offline":
      return new EmbedBuilder()
        .setTitle("⚫ Stream Ended (TEST)")
        .setDescription("**TestStreamer** is now offline.")
        .setColor(THEME.TWITCH)
        .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
        .setTimestamp();
    case "follow":
      return new EmbedBuilder()
        .setTitle("👋 New Follower! (TEST)")
        .setDescription("TestUser just followed!")
        .setColor(THEME.TWITCH_GREEN)
        .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
        .setTimestamp();
    case "subscribe":
      return new EmbedBuilder()
        .setTitle("⭐ New Subscriber! (TEST)")
        .setDescription("TestUser subscribed at Tier 1!")
        .setColor(THEME.TWITCH_PINK)
        .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
        .setTimestamp();
    case "giftSub":
      return new EmbedBuilder()
        .setTitle("🎁 Gift Sub! (TEST)")
        .setDescription("TestUser gifted 5 subs!")
        .setColor(THEME.TWITCH_GOLD)
        .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
        .setTimestamp();
    case "raid":
      return new EmbedBuilder()
        .setTitle("⚡ Raid! (TEST)")
        .setDescription("TestRaid is raiding with 100 viewers!")
        .setURL("https://twitch.tv/testraid")
        .setColor(THEME.TWITCH_RED)
        .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
        .setTimestamp();
    case "resub":
      return new EmbedBuilder()
        .setTitle("⭐ Resub! (TEST)")
        .setDescription("TestUser resubscribed for 12 months!")
        .addFields({
          name: "Message",
          value: "Great stream as always!",
          inline: false,
        })
        .setColor(THEME.TWITCH_PINK)
        .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
        .setTimestamp();
    default:
      return null;
  }
}
