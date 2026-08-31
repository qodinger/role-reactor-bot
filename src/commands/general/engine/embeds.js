import { EmbedBuilder } from "discord.js";
import { THEME, UI_COMPONENTS, EMOJIS } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";
import { WEBSITE_URL } from "../../../config/domains.js";

/**
 * Creates Pro Engine status embed
 * @param {Object} params
 * @param {import("discord.js").Guild} params.guild
 * @param {boolean} params.isPro
 * @param {Object} params.sub
 * @param {Object} params.vaultData
 * @param {import("discord.js").Client} params.client
 */
export function createStatusEmbed({ guild, isPro, sub, vaultData, client }) {
  const coreEmoji = emojiConfig.core;

  const embed = new EmbedBuilder()
    .setAuthor(
      UI_COMPONENTS.createAuthor(
        `${guild.name} • Pro Engine Status`,
        guild.iconURL() || client?.user?.displayAvatarURL(),
      ),
    )
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Anyone can contribute Cores via /engine fuel!",
        client?.user?.displayAvatarURL(),
      ),
    );

  if (isPro) {
    const expiresAt = sub?.nextDeductionDate
      ? new Date(sub.nextDeductionDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Active";

    const isTrial = !!sub?.isTrial;
    const isCancelled = !!sub?.cancelledAt;
    const vaultBalance = vaultData?.balance || 0;
    const weeksFunded = Math.floor((vaultBalance / 20) * 100) / 100;

    embed
      .setColor(THEME.PRO)
      .setTitle(`${EMOJIS.ENGINE.ACTIVE} Pro Engine is ACTIVE`)
      .setDescription(
        "This server is fueled with **Pro Engine**, unlocking max capacity for all members!",
      )
      .addFields(
        {
          name: "💳 Subscription Tier",
          value: isTrial
            ? "🎁 **Free Trial** (7 Days)"
            : `${coreEmoji} **Pro Engine** (20 Cores/week)`,
          inline: true,
        },
        {
          name: "⏰ Next Renewal",
          value: isCancelled
            ? `${EMOJIS.STATUS.ERROR} Cancelled (Active until ${expiresAt})`
            : `📅 **${expiresAt}**`,
          inline: true,
        },
        {
          name: `${EMOJIS.ENGINE.VAULT} Guild Vault Reserve`,
          value: `${coreEmoji} **${vaultBalance.toFixed(2)} Cores** *(≈ ${weeksFunded} weeks prepaid)*`,
          inline: false,
        },
      );
  } else {
    const vaultBalance = vaultData?.balance || 0;
    const needsMore = (20 - vaultBalance).toFixed(2);

    embed
      .setColor(THEME.SECONDARY)
      .setTitle(`${EMOJIS.ENGINE.FREE} Free Tier (Standard Limits)`)
      .setDescription(
        "This server is currently running on the **Free Tier**.\n\n" +
          "Upgrade to **Pro Engine** (20 Cores/week) to unlock higher giveaway limits, HTML ticket transcripts, and 100 scheduled roles!",
      )
      .addFields(
        {
          name: `${EMOJIS.ENGINE.VAULT} Guild Vault Reserve`,
          value: `${coreEmoji} **${vaultBalance.toFixed(2)} Cores** ${
            vaultBalance >= 20
              ? "*(Enough to activate Pro Engine!)*"
              : `*(Need ${needsMore} more Cores)*`
          }`,
          inline: false,
        },
        {
          name: `${EMOJIS.ENGINE.SUCCESS} How to Activate Pro Engine`,
          value:
            "1. **Fuel the Guild Vault:** Use `/engine fuel <cores>` to deposit Cores.\n" +
            `2. **Activate via Web:** Visit **[Role Reactor Dashboard](${WEBSITE_URL})** to enable Pro Engine!`,
          inline: false,
        },
      );
  }

  return embed;
}

/**
 * Creates Guild Core Vault embed
 * @param {Object} params
 * @param {import("discord.js").Guild} params.guild
 * @param {Object} params.vaultData
 * @param {import("discord.js").Client} params.client
 */
export function createVaultEmbed({ guild, vaultData, client }) {
  const balance = vaultData?.balance || 0;
  const weeksFunded = (balance / 20).toFixed(1);
  const history = vaultData?.history || [];
  const coreEmoji = emojiConfig.core;

  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.ENGINE.VAULT} Guild Core Reserve`)
    .setAuthor(
      UI_COMPONENTS.createAuthor(
        `${guild.name} • Guild Vault`,
        guild.iconURL() || client?.user?.displayAvatarURL(),
      ),
    )
    .setDescription(
      `The **Guild Core Vault** lets anyone in the community pool Cores ${coreEmoji} to keep Pro Engine active for **${guild.name}**!`,
    )
    .addFields(
      {
        name: `${coreEmoji} Vault Balance`,
        value: `**${balance.toFixed(2)} Cores**`,
        inline: true,
      },
      {
        name: "⏱️ Funded Coverage",
        value: `≈ **${weeksFunded} weeks**`,
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Use /engine fuel <amount> to deposit Cores into the Vault!",
        client?.user?.displayAvatarURL(),
      ),
    );

  if (history.length > 0) {
    const contributorTotals = {};
    for (const entry of history) {
      const name = entry.username || "Anonymous";
      contributorTotals[name] = (contributorTotals[name] || 0) + (entry.amount || 0);
    }

    const sortedSponsors = Object.entries(contributorTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const sponsorList = sortedSponsors
      .map(([name, amount], index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🎖️";
        return `${medal} **${name}**: ${amount.toFixed(2)} Cores`;
      })
      .join("\n");

    embed.addFields({
      name: "🏆 Top Community Sponsors",
      value: sponsorList,
      inline: false,
    });
  } else {
    embed.addFields({
      name: "🏆 Top Community Sponsors",
      value: "No contributions yet. Be the first to fuel this server with `/engine fuel`!",
      inline: false,
    });
  }

  return embed;
}

/**
 * Creates Fuel Confirmation embed with clean inline fields
 * @param {Object} params
 * @param {import("discord.js").Guild} params.guild
 * @param {import("discord.js").User} params.user
 * @param {number} params.amount
 * @param {number} [params.userBalance]
 * @param {import("discord.js").Client} params.client
 */
export function createFuelConfirmationEmbed({
  guild,
  user,
  amount,
  userBalance,
  client,
}) {
  const coreEmoji = emojiConfig.core;

  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.ENGINE.CONFIRM} Confirm Guild Vault Fueling`)
    .setAuthor(
      UI_COMPONENTS.createAuthor(
        user.username,
        user.displayAvatarURL(),
      ),
    )
    .setDescription(
      `Deposit **${amount.toFixed(2)} Cores ${coreEmoji}** into the **${guild.name}** Guild Vault?`,
    )
    .addFields(
      {
        name: "Deposit Amount",
        value: `${coreEmoji} **${amount.toFixed(2)} Cores**`,
        inline: true,
      },
      {
        name: "Target Server",
        value: `${EMOJIS.ENGINE.VAULT} **${guild.name}**`,
        inline: true,
      },
    );

  if (typeof userBalance === "number") {
    const remaining = userBalance - amount;
    embed.addFields({
      name: "Core Balance",
      value: `💳 **${userBalance.toFixed(2)}** ➔ **${remaining >= 0 ? remaining.toFixed(2) : "0.00"} Cores**`,
      inline: true,
    });
  }

  embed
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Vault deposits are permanent and non-refundable",
        client?.user?.displayAvatarURL(),
      ),
    );

  return embed;
}

/**
 * Creates Fuel Cancelled embed
 * @param {import("discord.js").User} user
 * @param {import("discord.js").Client} client
 */
export function createFuelCancelledEmbed(user, client) {
  return new EmbedBuilder()
    .setColor(THEME.SECONDARY)
    .setTitle(`${EMOJIS.STATUS.ERROR} Fueling Cancelled`)
    .setAuthor(
      UI_COMPONENTS.createAuthor(
        user.username,
        user.displayAvatarURL(),
      ),
    )
    .setDescription("No Cores were deducted from your personal balance.")
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Transfer Cancelled",
        client?.user?.displayAvatarURL(),
      ),
    );
}

/**
 * Creates Fuel Success embed
 * @param {Object} params
 * @param {import("discord.js").Guild} params.guild
 * @param {import("discord.js").User} params.user
 * @param {number} params.amount
 * @param {number} params.newVaultBalance
 * @param {import("discord.js").Client} params.client
 */
export function createFuelSuccessEmbed({ guild, user, amount, newVaultBalance, client }) {
  const weeksFunded = (newVaultBalance / 20).toFixed(1);
  const coreEmoji = emojiConfig.core;

  return new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.ENGINE.SUCCESS} Guild Vault Fueled!`)
    .setAuthor(
      UI_COMPONENTS.createAuthor(
        user.username,
        user.displayAvatarURL(),
      ),
    )
    .setDescription(
      `**${user.username}** deposited **${amount.toFixed(2)} Cores ${coreEmoji}** into the Guild Core Reserve for **${guild.name}**!`,
    )
    .addFields(
      {
        name: `${EMOJIS.ENGINE.VAULT} New Vault Balance`,
        value: `**${newVaultBalance.toFixed(2)} Cores**`,
        inline: true,
      },
      {
        name: "⏱️ Funded Coverage",
        value: `≈ **${weeksFunded} weeks** of Pro Engine`,
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Your support keeps this server running at maximum capacity! ❤️",
        client?.user?.displayAvatarURL(),
      ),
    );
}
