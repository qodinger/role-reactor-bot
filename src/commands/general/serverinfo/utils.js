/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Get server verification level emoji
 * @param {import('discord.js').GuildVerificationLevel} level - Verification level
 * @returns {string} Emoji for verification level
 */
export function getVerificationLevelEmoji(level) {
  const emojiMap = {
    None: "🔓",
    Low: "🟢",
    Medium: "🟡",
    High: "🟠",
    VeryHigh: "🔒",
  };
  return emojiMap[level] || "❓";
}

/**
 * Get server verification level name
 * @param {import('discord.js').GuildVerificationLevel} level - Verification level
 * @returns {string} Human-readable name
 */
export function getVerificationLevelName(level) {
  const nameMap = {
    None: "None",
    Low: "Low",
    Medium: "Medium",
    High: "High",
    VeryHigh: "Very High",
  };
  return nameMap[level] || "Unknown";
}

/**
 * Get server NSFW level emoji
 * @param {import('discord.js').GuildNSFWLevel} level - NSFW level
 * @returns {string} Emoji for NSFW level
 */
export function getNSFWLevelEmoji(level) {
  const emojiMap = {
    Default: "⚪",
    Explicit: "🔞",
    Safe: "✅",
    AgeRestricted: "🔞",
  };
  return emojiMap[level] || "❓";
}

/**
 * Get server NSFW level name
 * @param {import('discord.js').GuildNSFWLevel} level - NSFW level
 * @returns {string} Human-readable name
 */
export function getNSFWLevelName(level) {
  const nameMap = {
    Default: "Default",
    Explicit: "Explicit",
    Safe: "Safe",
    AgeRestricted: "Age Restricted",
  };
  return nameMap[level] || "Unknown";
}

/**
 * Format channel counts
 * @param {import('discord.js').Guild} guild - Guild instance
 * @returns {Object} Channel counts
 */
export function getChannelCounts(guild) {
  const channels = guild.channels.cache;
  return {
    total: channels.size,
    text: channels.filter(c => c.isTextBased() && !c.isThread()).size,
    voice: channels.filter(c => c.isVoiceBased()).size,
    forum: channels.filter(c => c.type === 15).size, // ForumChannel
    stage: channels.filter(c => c.type === 13).size, // StageChannel
    category: channels.filter(c => c.type === 4).size, // CategoryChannel
    threads: channels.filter(c => c.isThread()).size,
  };
}

/**
 * Format member counts
 * @param {import('discord.js').Guild} guild - Guild instance
 * @returns {Object} Member counts
 */
export function getMemberCounts(guild) {
  const members = guild.members.cache;
  const total = guild.memberCount;
  const cached = members.size;
  const uncached = total - cached;

  // Bot/human counts are only accurate for cached members
  const bots = members.filter(m => m.user.bot).size;
  const humans = members.filter(m => !m.user.bot).size;

  // Presence data - separate counts for humans and bots
  // When asked "how many are online", use human online count only
  // Convert Collection to array for filtering
  const humanMembersArray = Array.from(members.filter(m => !m.user.bot));
  const botMembersArray = Array.from(members.filter(m => m.user.bot));

  // Human member status counts (what users care about)
  const online = humanMembersArray.filter(
    m => m.presence?.status === "online",
  ).length;
  const idle = humanMembersArray.filter(
    m => m.presence?.status === "idle",
  ).length;
  const dnd = humanMembersArray.filter(
    m => m.presence?.status === "dnd",
  ).length;
  const offline = humanMembersArray.filter(
    m => !m.presence || m.presence.status === "offline",
  ).length;

  // Bot status counts (for reference, but not used when asked about "members online")
  const botsOnline = botMembersArray.filter(
    m => m.presence?.status === "online",
  ).length;
  const botsIdle = botMembersArray.filter(
    m => m.presence?.status === "idle",
  ).length;
  const botsDnd = botMembersArray.filter(
    m => m.presence?.status === "dnd",
  ).length;

  return {
    total,
    cached,
    uncached,
    online, // Human members online only
    idle, // Human members idle only
    dnd, // Human members dnd only
    offline, // Human members offline only
    bots,
    humans,
    botsOnline, // For reference
    botsIdle, // For reference
    botsDnd, // For reference
  };
}

/**
 * Calculate server age
 * @param {Date} createdAt - Server creation date
 * @returns {string} Formatted server age
 */
export function calculateServerAge(createdAt) {
  if (!createdAt) return "Unknown";

  const now = new Date();
  const diff = now - createdAt;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return `${years} year${years !== 1 ? "s" : ""} (${days} days)`;
  } else if (months > 0) {
    return `${months} month${months !== 1 ? "s" : ""} (${days} days)`;
  } else {
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
}

/**
 * Format features list
 * @param {import('discord.js').GuildFeature[]} features - Guild features
 * @returns {string} Formatted features string
 */
export function formatFeatures(features) {
  if (!features || features.length === 0) return "None";

  const featureMap = {
    ANIMATED_ICON: "Animated Icon",
    BANNER: "Banner",
    COMMERCE: "Commerce",
    COMMUNITY: "Community",
    DISCOVERABLE: "Discoverable",
    FEATURABLE: "Featurable",
    INVITE_SPLASH: "Invite Splash",
    MEMBER_VERIFICATION_GATE_ENABLED: "Member Verification Gate",
    MONETIZATION_ENABLED: "Monetization",
    MORE_STICKERS: "More Stickers",
    NEWS: "News Channels",
    PARTNERED: "Partnered",
    PREVIEW_ENABLED: "Preview Enabled",
    PRIVATE_THREADS: "Private Threads",
    ROLE_ICONS: "Role Icons",
    SEVEN_DAY_THREAD_ARCHIVE: "7-Day Thread Archive",
    THREE_DAY_THREAD_ARCHIVE: "3-Day Thread Archive",
    TICKETED_EVENTS_ENABLED: "Ticketed Events",
    VANITY_URL: "Vanity URL",
    VERIFIED: "Verified",
    VIP_REGIONS: "VIP Regions",
    WELCOME_SCREEN_ENABLED: "Welcome Screen",
  };

  return features.map(feature => featureMap[feature] || feature).join(", ");
}
