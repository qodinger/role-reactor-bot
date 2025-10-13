import { getLogger } from "../../../utils/logger.js";

/**
 * Validate user prompt for inappropriate content
 * @param {string} prompt - User's prompt
 * @returns {Object} Validation result with isValid and reason
 */
export function validatePrompt(prompt) {
  const logger = getLogger();

  // Comprehensive content filter for AI image generation
  const inappropriateKeywords = [
    // Explicit content
    "nude",
    "naked",
    "explicit",
    "porn",
    "sexual",
    "nsfw",
    "adult",
    "18+",
    "xxx",
    "sex",
    "nudity",
    "bare",
    "topless",
    "bottomless",
    "undressed",
    "unclothed",
    "exposed",

    // Body parts (anatomical) - using word boundaries for precision
    "breast",
    "boob",
    "boobs",
    "chest",
    "nipple",
    "nipples",
    "genital",
    "genitals",
    "penis",
    "vagina",
    "pussy",
    "cock",
    "dick",
    "anus",
    "butthole",
    "clitoris",
    "labia",
    "scrotum",
    "testicle",
    "testicles",

    // Sexual content
    "hentai",
    "ecchi",
    "yaoi",
    "yuri",
    "loli",
    "shota",
    "futa",
    "futanari",
    "masturbat",
    "orgasm",
    "ejaculat",
    "cum",
    "sperm",
    "semen",
    "erotic",
    "sexy",
    "seductive",
    "provocative",
    "sensual",
    "intimate",
    "foreplay",
    "intercourse",

    // Inappropriate poses/actions
    "spread",
    "spreading",
    "bent over",
    "on all fours",
    "doggy",
    "missionary",
    "cowgirl",
    "reverse cowgirl",
    "69",
    "blowjob",
    "handjob",
    "fingering",
    "penetrat",
    "thrust",
    "thrusting",
    "riding",
    "mounting",
    "grinding",

    // Clothing/outfit terms (suggestive contexts)
    "lingerie",
    "bra",
    "panties",
    "underwear",
    "thong",
    "g-string",
    "bikini",
    "swimsuit",
    "bathing suit",
    "corset",
    "bustier",
    "garter",
    "stockings",
    "fishnet",
    "leather",
    "latex",
    "rubber",
    "bondage",
    "bdsm",
    "dominat",
    "submissive",
    "slave",
    "master",
    "mistress",

    // Character age terms (inappropriate contexts)
    "child",
    "minor",
    "underage",
    "teen",
    "teenage",
    "school",
    "student",
    "kid",
    "kids",
    "baby",
    "infant",
    "toddler",
    "preteen",
    "adolescent",
    "young",
    "youth",
    "juvenile",
    "pedo",
    "pedophile",

    // Violence and harmful content
    "violence",
    "blood",
    "gore",
    "death",
    "kill",
    "murder",
    "suicide",
    "self-harm",
    "torture",
    "abuse",
    "assault",
    "attack",
    "fight",
    "fighting",
    "battle",
    "war",
    "weapon",
    "gun",
    "knife",
    "sword",
    "bomb",
    "explosion",
    "fire",

    // Profanity and offensive terms
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "damn",
    "crap",
    "stupid",
    "idiot",
    "moron",
    "retard",
    "faggot",
    "dyke",
    "tranny",
    "shemale",
    "trap",
    "whore",
    "slut",
    "cunt",
    "pussy",
    "dickhead",

    // Illegal activities
    "rape",
    "molest",
    "harass",
    "stalk",
    "threat",
    "blackmail",
    "scam",
    "fraud",
    "steal",
    "rob",
    "burglary",
    "theft",
    "kidnap",
    "abduct",

    // Drug references
    "drug",
    "cocaine",
    "heroin",
    "marijuana",
    "weed",
    "lsd",
    "acid",
    "mdma",
    "ecstasy",
    "meth",
    "amphetamine",
    "opioid",
    "narcotic",
    "hallucinogen",

    // AI-specific inappropriate terms
    "realistic",
    "photorealistic",
    "3d render",
    "cgi",
    "computer generated",
    "artificial",
    "fake",
    "cartoon",
    "western animation",
    "disney style",
    "pixar style",
    "low resolution",
    "pixelated",
    "grainy",
    "noisy",

    // Additional inappropriate content
    "fetish",
    "kink",
    "fetishist",
    "pervert",
    "perverted",
    "deviant",
    "abnormal",
    "disturbing",
    "disgusting",
    "revolting",
    "repulsive",
    "offensive",
    "inappropriate",
    "unacceptable",
    "forbidden",
    "banned",
  ];

  const lowerPrompt = prompt.toLowerCase();

  // Check for inappropriate keywords
  for (const keyword of inappropriateKeywords) {
    if (lowerPrompt.includes(keyword)) {
      logger.warn(
        `Inappropriate content detected in prompt: "${prompt}" (keyword: ${keyword})`,
      );
      return {
        isValid: false,
        reason: `Your prompt contains inappropriate content. Please describe your character in a family-friendly way.`,
      };
    }
  }

  // Additional validation checks
  const additionalChecks = [
    // Check for anatomical terms with word boundaries
    {
      pattern: /\b(ass|butt|buttock|buttocks)\b/i,
      reason: "Please avoid inappropriate anatomical references.",
    },

    // Check for age-related terms that might be inappropriate
    {
      pattern:
        /\b(young|little|small|tiny)\s+(girl|boy|woman|man|person|character)\b/i,
      reason:
        "Please avoid age-related descriptors that could be inappropriate.",
    },

    // Check for suggestive clothing combinations
    {
      pattern:
        /\b(see-through|transparent|revealing|skimpy|tight)\s+(clothing|dress|shirt|pants)\b/i,
      reason: "Please avoid suggestive clothing descriptions.",
    },

    // Check for inappropriate poses
    {
      pattern:
        /\b(sitting|lying|standing|posing)\s+(naked|nude|bare|exposed)\b/i,
      reason: "Please avoid inappropriate pose descriptions.",
    },

    // Check for excessive sexual content
    {
      pattern:
        /\b(sexy|hot|attractive|beautiful)\s+(naked|nude|bare|exposed)\b/i,
      reason:
        "Please keep character descriptions appropriate and family-friendly.",
    },

    // Check for inappropriate age-related content
    {
      pattern:
        /\b(child|minor|underage|teen|teenage|school|student|kid|kids|baby|infant|toddler|preteen|adolescent|young|youth|juvenile)\s+(naked|nude|bare|exposed|sexual|sexy|hot|attractive|beautiful)\b/i,
      reason: "Please avoid inappropriate age-related content.",
    },

    // Check for inappropriate clothing contexts
    {
      pattern:
        /\b(bra|bikini|swimsuit|bathing suit|leather|latex|rubber)\s+(naked|nude|bare|exposed|sexual|sexy|hot|attractive|beautiful)\b/i,
      reason: "Please avoid inappropriate clothing contexts.",
    },

    // Check for violence in inappropriate contexts
    {
      pattern:
        /\b(violence|violent)\s+(naked|nude|bare|exposed|sexual|sexy|hot|attractive|beautiful)\b/i,
      reason: "Please avoid inappropriate violent content.",
    },

    // Check for profanity in inappropriate contexts
    {
      pattern:
        /\b(hell)\s+(naked|nude|bare|exposed|sexual|sexy|hot|attractive|beautiful|character|scene|content)\b/i,
      reason: "Please avoid inappropriate profanity.",
    },
  ];

  for (const check of additionalChecks) {
    if (check.pattern.test(prompt)) {
      logger.warn(
        `Pattern-based inappropriate content detected in prompt: "${prompt}"`,
      );
      return {
        isValid: false,
        reason: check.reason,
      };
    }
  }

  return { isValid: true, reason: null };
}

/**
 * Format style options for logging
 * @param {Object} styleOptions - Style options object
 * @returns {string} Formatted string
 */
export function formatStyleOptions(styleOptions) {
  const options = [];
  if (styleOptions.colorStyle)
    options.push(`Color: ${styleOptions.colorStyle}`);
  if (styleOptions.mood) options.push(`Mood: ${styleOptions.mood}`);
  if (styleOptions.artStyle) options.push(`Art: ${styleOptions.artStyle}`);

  return options.length > 0 ? options.join(", ") : "None";
}

/**
 * Calculate generation cost based on user status
 * @param {Object} userData - User credit data
 * @returns {number} Cost in credits
 */
export function calculateGenerationCost(userData) {
  return userData.isCore ? 1 : 2;
}

/**
 * Format generation time for display
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp
 * @returns {string} Formatted time string
 */
export function formatGenerationTime(startTime, endTime) {
  const duration = endTime - startTime;
  const seconds = Math.floor(duration / 1000);
  const milliseconds = duration % 1000;

  if (seconds > 0) {
    return `${seconds}.${Math.floor(milliseconds / 100)}s`;
  }
  return `${milliseconds}ms`;
}
