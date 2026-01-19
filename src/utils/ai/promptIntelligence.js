/**
 * AI Prompt Intelligence System
 * Analyzes user prompts and enhances them for better AI image generation results
 * Helps users who don't know proper prompt formatting or model-specific keywords
 */

import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Common prompt patterns and their improvements
 */
const PROMPT_PATTERNS = {
  // Character descriptions
  characters: {
    patterns: [
      /\b(girl|woman|female|lady)\b/gi,
      /\b(boy|man|male|guy|dude)\b/gi,
      /\b(person|character|someone)\b/gi,
    ],
    enhancements: {
      "girl|woman|female|lady":
        "beautiful anime girl, detailed character design, expressive eyes, elegant features",
      "boy|man|male|guy|dude":
        "handsome anime boy, detailed character design, expressive eyes, strong features",
      "person|character|someone":
        "anime character, detailed character design, expressive eyes, unique features",
    },
  },

  // Hair descriptions
  hair: {
    patterns: [
      /\b(long hair|short hair|curly hair|straight hair)\b/gi,
      /\b(blonde|brunette|redhead|black hair|white hair|silver hair|pink hair|blue hair|green hair|purple hair)\b/gi,
      /\b(ponytail|pigtails|braids|bun|messy hair)\b/gi,
    ],
    enhancements: {
      "long hair":
        "long flowing hair, detailed hair strands, beautiful hair texture",
      "short hair": "short stylish hair, neat hair cut, detailed hair texture",
      "curly hair": "curly wavy hair, voluminous hair, natural hair texture",
      "straight hair":
        "straight silky hair, smooth hair texture, well-groomed hair",
      blonde: "beautiful blonde hair, golden hair color, shiny hair",
      brunette: "beautiful brown hair, rich hair color, lustrous hair",
      redhead: "beautiful red hair, vibrant hair color, fiery hair",
      "black hair": "beautiful black hair, dark hair color, glossy hair",
      "white hair": "beautiful white hair, silver hair color, ethereal hair",
      "silver hair":
        "beautiful silver hair, metallic hair color, shimmering hair",
      "pink hair": "beautiful pink hair, pastel hair color, colorful hair",
      "blue hair": "beautiful blue hair, vibrant hair color, colorful hair",
      "green hair": "beautiful green hair, vibrant hair color, colorful hair",
      "purple hair": "beautiful purple hair, vibrant hair color, colorful hair",
      ponytail: "hair in ponytail, neat hairstyle, elegant hair arrangement",
      pigtails: "hair in pigtails, cute hairstyle, twin tails",
      braids: "braided hair, intricate hairstyle, detailed hair braiding",
      bun: "hair in bun, elegant hairstyle, neat hair arrangement",
      "messy hair": "messy tousled hair, natural hair style, windswept hair",
    },
  },

  // Clothing and style
  clothing: {
    patterns: [
      /\b(dress|skirt|shirt|blouse|jacket|coat|uniform|kimono|hoodie|sweater)\b/gi,
      /\b(casual|formal|elegant|cute|cool|gothic|punk|vintage|modern)\b/gi,
      /\b(school uniform|maid outfit|business suit|wedding dress)\b/gi,
    ],
    enhancements: {
      dress: "beautiful dress, detailed clothing design, elegant outfit",
      skirt: "stylish skirt, detailed clothing, fashionable outfit",
      shirt: "well-fitted shirt, detailed clothing, neat appearance",
      blouse: "elegant blouse, detailed clothing design, refined outfit",
      jacket: "stylish jacket, detailed outerwear, fashionable clothing",
      coat: "elegant coat, detailed outerwear, sophisticated clothing",
      uniform: "detailed uniform, professional clothing, neat appearance",
      kimono:
        "traditional kimono, detailed Japanese clothing, elegant traditional wear",
      hoodie: "comfortable hoodie, casual clothing, relaxed outfit",
      sweater: "cozy sweater, warm clothing, comfortable outfit",
      casual: "casual style, relaxed clothing, comfortable outfit",
      formal: "formal attire, elegant clothing, sophisticated outfit",
      elegant: "elegant style, refined clothing, graceful appearance",
      cute: "cute outfit, adorable clothing, kawaii style",
      cool: "cool style, trendy clothing, stylish appearance",
      gothic: "gothic style, dark clothing, alternative fashion",
      punk: "punk style, edgy clothing, rebellious fashion",
      vintage: "vintage style, retro clothing, classic fashion",
      modern: "modern style, contemporary clothing, current fashion",
      "school uniform":
        "detailed school uniform, student clothing, academic attire",
      "maid outfit":
        "detailed maid outfit, service uniform, elegant work attire",
      "business suit":
        "professional business suit, formal work attire, corporate clothing",
      "wedding dress":
        "beautiful wedding dress, bridal gown, elegant formal wear",
    },
  },

  // Emotions and expressions
  emotions: {
    patterns: [
      /\b(happy|sad|angry|surprised|excited|calm|serious|shy|confident|mysterious)\b/gi,
      /\b(smiling|crying|laughing|frowning|blushing|winking)\b/gi,
    ],
    enhancements: {
      happy: "happy expression, bright smile, joyful mood, positive energy",
      sad: "sad expression, melancholic mood, emotional depth, touching expression",
      angry:
        "angry expression, intense mood, fierce look, determined expression",
      surprised:
        "surprised expression, wide eyes, shocked look, amazed expression",
      excited:
        "excited expression, energetic mood, enthusiastic look, lively expression",
      calm: "calm expression, peaceful mood, serene look, tranquil expression",
      serious:
        "serious expression, focused look, determined mood, professional expression",
      shy: "shy expression, bashful look, timid mood, cute embarrassed expression",
      confident:
        "confident expression, strong look, self-assured mood, powerful expression",
      mysterious:
        "mysterious expression, enigmatic look, secretive mood, intriguing expression",
      smiling: "beautiful smile, warm expression, friendly look, cheerful face",
      crying:
        "emotional tears, touching expression, dramatic mood, heartfelt emotion",
      laughing:
        "joyful laughter, happy expression, cheerful mood, infectious joy",
      frowning:
        "concerned frown, worried expression, thoughtful mood, serious look",
      blushing:
        "cute blush, embarrassed expression, shy mood, adorable reaction",
      winking:
        "playful wink, flirty expression, mischievous mood, charming gesture",
    },
  },

  // Settings and environments
  environments: {
    patterns: [
      /\b(school|classroom|library|cafe|park|beach|forest|city|room|bedroom|kitchen)\b/gi,
      /\b(indoor|outdoor|sunset|sunrise|night|day|rain|snow|spring|summer|autumn|winter)\b/gi,
    ],
    enhancements: {
      school: "school setting, educational environment, academic atmosphere",
      classroom: "classroom setting, learning environment, school interior",
      library: "library setting, quiet atmosphere, scholarly environment",
      cafe: "cafe setting, cozy atmosphere, social environment",
      park: "park setting, natural environment, outdoor scenery",
      beach: "beach setting, coastal scenery, ocean atmosphere",
      forest: "forest setting, natural environment, woodland scenery",
      city: "city setting, urban environment, metropolitan atmosphere",
      room: "indoor room setting, interior environment, personal space",
      bedroom: "bedroom setting, private space, intimate environment",
      kitchen: "kitchen setting, domestic environment, home interior",
      indoor: "indoor setting, interior environment, sheltered space",
      outdoor: "outdoor setting, natural environment, open air",
      sunset: "sunset lighting, golden hour, warm atmospheric lighting",
      sunrise: "sunrise lighting, dawn atmosphere, soft morning light",
      night: "night setting, dark atmosphere, evening mood",
      day: "daytime setting, bright lighting, clear atmosphere",
      rain: "rainy weather, wet atmosphere, dramatic weather effects",
      snow: "snowy weather, winter atmosphere, cold weather effects",
      spring: "spring season, fresh atmosphere, blooming environment",
      summer: "summer season, warm atmosphere, bright sunny environment",
      autumn: "autumn season, fall colors, seasonal atmosphere",
      winter: "winter season, cold atmosphere, snowy environment",
    },
  },

  // Art styles and quality
  styles: {
    patterns: [
      /\b(anime|manga|realistic|cartoon|chibi|kawaii|ghibli|shinkai|shinkai makoto|kyoto animation|kyoani|k-on|vocaloid|vtuber)\b/gi,
      /\b(cyberpunk|steampunk|fantasy|dark fantasy|gothic|victorian|modern|futuristic|sci-fi|vaporwave|synthwave)\b/gi,
      /\b(detailed|high quality|masterpiece|beautiful|cute|cool|elegant|cinematic|photorealistic|ucllay|oil painting|watercolor|sketch)\b/gi,
    ],
    enhancements: {
      anime:
        "anime style, Japanese animation, cel shading, vibrant colors, detailed character design",
      manga:
        "manga style, Japanese comics, high contrast line art, traditional manga aesthetic",
      ghibli:
        "Studio Ghibli style, Hayao Miyazaki inspired, hand-drawn aesthetic, painterly backgrounds, whimsical atmosphere, vintage anime look",
      shinkai:
        "Makoto Shinkai style, Your Name aesthetic, breathtaking scenery, hyper-detailed lighting, lens flare, emotional atmosphere, vibrant sky",
      kyoani:
        "Kyoto Animation style, soft lighting, expressive eye detail, moe aesthetic, fluid character design, high-end production quality",
      cyberpunk:
        "cyberpunk aesthetic, neon lighting, rainy streets, futuristic technology, high-tech low-life, glowing accents, cyan and magenta color palette",
      realistic:
        "photorealistic style, 8k resolution, highly detailed skin texture, natural lighting, professional photography, cinematic composition, sharp focus, depth of field",
      cinematic:
        "cinematic lighting, dramatic shadows, movie-like atmosphere, professional cinematography, anamorphic lens flare, epic composition",
      vaporwave:
        "vaporwave aesthetic, 80s retro style, glitch art, pastel neon colors, surreal atmosphere, nostalgic digital vibes",
      masterpiece:
        "masterpiece, best quality, ultra detailed, official art, high resolution, 8k, sharp focus, perfect composition",
    },
  },

  // Aesthetics and Lighting
  aesthetics: {
    patterns: [
      /\b(soft lighting|dynamic lighting|volumetric lighting|rim lighting|backlighting|golden hour|sunset|sunrise|night|dark|neon|glowing)\b/gi,
      /\b(bokeh|depth of field|sharp focus|wide angle|portrait|macro|fisheye)\b/gi,
      /\b(detailed background|scenery|landscape|interior|outdoor|nature|forest|city|street|space|underwater)\b/gi,
    ],
    enhancements: {
      "soft lighting":
        "soft ambient lighting, gentle shadows, warm glow, diffused light",
      "dynamic lighting":
        "dynamic lighting effects, dramatic light rays, high contrast lighting, cinematic atmosphere",
      "volumetric lighting":
        "volumetric lighting, god rays, atmospheric fog, visible light beams, ethereal atmosphere",
      "golden hour":
        "golden hour lighting, warm sunlight, sunset glow, long shadows, beautiful atmospheric lighting",
      bokeh:
        "beautiful bokeh, blurred background, shallow depth of field, sharp subject, professional photography look",
      neon: "neon glow, vibrant neon lighting, cyberpunk night aesthetic, glowing accents, electric energy",
    },
  },
};

/**
 * Model-specific keyword mappings
 */
const MODEL_KEYWORDS = {
  animagine: {
    // Animagine XL 4.0 responds well to these keywords
    quality: [
      "masterpiece",
      "best quality",
      "ultra detailed",
      "highly detailed",
      "perfect anatomy",
      "beautiful composition",
      "professional artwork",
      "detailed character design",
      "expressive eyes",
      "perfect proportions",
    ],
    style: [
      "anime style",
      "manga style",
      "japanese animation",
      "cel shading",
      "vibrant colors",
      "clean line art",
      "modern anime",
      "detailed shading",
    ],
    character: [
      "detailed facial features",
      "expressive eyes",
      "perfect anatomy",
      "beautiful character design",
      "anime character",
      "detailed hair",
      "smooth skin",
      "perfect hands",
      "natural pose",
    ],
  },
  anything: {
    // Anything XL is trained on Danbooru tags
    quality: [
      "masterpiece",
      "best quality",
      "absurdres",
      "highres",
      "ultra_detailed",
      "highly_detailed",
      "sharp_focus",
      "amazing_quality",
      "perfect_composition",
      "detailed_shading",
      "cinematic_lighting",
    ],
    style: [
      "anime_style",
      "illustration",
      "digital_art",
      "clean_line_art",
      "cel_shading",
      "2d",
      "official_art",
      "professional_illustration",
    ],
    character: [
      "1girl",
      "solo",
      "mature_female",
      "detailed_facial_features",
      "expressive_eyes",
      "detailed_eyes",
      "beautiful_eyes",
      "detailed_hair",
      "detailed_skin_texture",
      "detailed_body",
      "perfect_anatomy",
      "detailed_anatomy",
      "natural_lighting",
      "perfect_proportions",
      "refined_body",
      "well-defined_body",
    ],
  },
};

/**
 * Analyze prompt quality and determine if enhancement is needed
 * @param {string} prompt - The prompt to analyze
 * @returns {Object} Analysis result with quality metrics
 */
function analyzePromptQuality(prompt) {
  if (!prompt || typeof prompt !== "string") {
    return {
      needsEnhancement: true,
      quality: "poor",
      reasons: ["Empty or invalid prompt"],
    };
  }

  const lowerPrompt = prompt.toLowerCase();
  const wordCount = prompt.split(/\s+/).length;
  const reasons = [];
  let qualityScore = 0;

  // Check word count (detailed prompts are usually longer)
  if (wordCount >= 20) {
    qualityScore += 3;
  } else if (wordCount >= 10) {
    qualityScore += 2;
  } else if (wordCount >= 5) {
    qualityScore += 1;
  } else {
    reasons.push("Very short prompt");
  }

  // Check for quality keywords already present
  const qualityKeywords = [
    "masterpiece",
    "best quality",
    "detailed",
    "high quality",
    "ultra detailed",
    "professional",
    "beautiful",
    "perfect",
    "cinematic",
    "sharp focus",
  ];
  const presentQualityKeywords = qualityKeywords.filter(keyword =>
    lowerPrompt.includes(keyword),
  );
  if (presentQualityKeywords.length >= 3) {
    qualityScore += 3;
  } else if (presentQualityKeywords.length >= 1) {
    qualityScore += 1;
  } else {
    reasons.push("Missing quality keywords");
  }

  // Check for style specification
  const styleKeywords = [
    "anime",
    "manga",
    "realistic",
    "photorealistic",
    "digital art",
    "oil painting",
    "watercolor",
    "sketch",
    "illustration",
    "artwork",
    "painting",
    "drawing",
  ];
  const hasStyle = styleKeywords.some(keyword => lowerPrompt.includes(keyword));
  if (hasStyle) {
    qualityScore += 2;
  } else {
    reasons.push("No style specification");
  }

  // Check for detailed descriptions
  const descriptiveWords = [
    "beautiful",
    "detailed",
    "elegant",
    "expressive",
    "vibrant",
    "soft",
    "dramatic",
    "natural",
    "perfect",
    "smooth",
    "flowing",
    "intricate",
    "delicate",
    "graceful",
  ];
  const presentDescriptive = descriptiveWords.filter(word =>
    lowerPrompt.includes(word),
  );
  if (presentDescriptive.length >= 5) {
    qualityScore += 2;
  } else if (presentDescriptive.length >= 2) {
    qualityScore += 1;
  } else {
    reasons.push("Lacks descriptive details");
  }

  // Check for technical terms (indicates advanced user)
  const technicalTerms = [
    "composition",
    "lighting",
    "perspective",
    "depth of field",
    "bokeh",
    "exposure",
    "contrast",
    "saturation",
    "hue",
    "gradient",
    "texture",
    "rendering",
    "shading",
  ];
  const hasTechnicalTerms = technicalTerms.some(term =>
    lowerPrompt.includes(term),
  );
  if (hasTechnicalTerms) {
    qualityScore += 2;
  }

  // Check for specific character/scene details
  const specificDetails = [
    /\b\w+\s+hair\b/i, // "blue hair", "long hair"
    /\b\w+\s+eyes\b/i, // "green eyes", "expressive eyes"
    /\b\w+\s+clothing\b/i, // "casual clothing"
    /\b\w+\s+background\b/i, // "forest background"
    /\b\w+\s+lighting\b/i, // "soft lighting"
  ];
  const specificMatches = specificDetails.filter(pattern =>
    pattern.test(prompt),
  );
  if (specificMatches.length >= 3) {
    qualityScore += 2;
  } else if (specificMatches.length >= 1) {
    qualityScore += 1;
  }

  // Determine quality level and enhancement need
  let quality, needsEnhancement;
  if (qualityScore >= 10) {
    quality = "excellent";
    needsEnhancement = false;
  } else if (qualityScore >= 7) {
    quality = "good";
    needsEnhancement = false;
  } else if (qualityScore >= 4) {
    quality = "fair";
    needsEnhancement = true; // Light enhancement only
  } else {
    quality = "poor";
    needsEnhancement = true; // Full enhancement
  }

  return {
    needsEnhancement,
    quality,
    score: qualityScore,
    reasons: reasons.length > 0 ? reasons : ["Prompt quality is sufficient"],
    wordCount,
    hasQualityKeywords: presentQualityKeywords.length > 0,
    hasStyle,
    hasTechnicalTerms,
  };
}
const COMMON_MISTAKES = {
  // Fix common spelling mistakes
  spelling: {
    beatiful: "beautiful",
    detaild: "detailed",
    charachter: "character",
    expresion: "expression",
    proffesional: "professional",
    awsome: "awesome",
    amzing: "amazing",
  },

  // Fix common grammar issues
  grammar: {
    "a anime": "an anime",
    "a elegant": "an elegant",
    "a amazing": "an amazing",
    "a awesome": "an awesome",
  },

  // Remove redundant words
  redundancy: [
    /\b(very very|really really|super super)\b/gi,
    /\b(beautiful beautiful|cute cute|detailed detailed)\b/gi,
  ],
};

/**
 * Analyze user prompt and suggest improvements
 * @param {string} userPrompt - Original user prompt
 * @param {string} model - Model being used (animagine, anything)
 * @returns {Object} Analysis results with suggestions
 */
export function analyzePrompt(userPrompt, _model = "anything") {
  if (!userPrompt || typeof userPrompt !== "string") {
    return {
      original: userPrompt,
      enhanced: userPrompt,
      suggestions: [],
      improvements: [],
    };
  }

  const analysis = {
    original: userPrompt.trim(),
    enhanced: userPrompt.trim(),
    suggestions: [],
    improvements: [],
    detectedElements: {
      characters: [],
      clothing: [],
      emotions: [],
      environments: [],
      styles: [],
    },
  };

  // Detect elements in the prompt
  for (const [category, config] of Object.entries(PROMPT_PATTERNS)) {
    for (const pattern of config.patterns) {
      const matches = userPrompt.match(pattern);
      if (matches) {
        analysis.detectedElements[category].push(
          ...matches.map(m => m.toLowerCase()),
        );
      }
    }
  }

  return analysis;
}

/**
 * Enhance user prompt with intelligent improvements
 * @param {string} userPrompt - Original user prompt
 * @param {string} model - Model being used (animagine, anything)
 * @param {Object} options - Enhancement options
 * @returns {string} Enhanced prompt
 */
export function enhancePromptIntelligently(
  userPrompt,
  model = "anything",
  _options = {},
) {
  if (!userPrompt || typeof userPrompt !== "string") {
    return userPrompt;
  }

  let enhanced = userPrompt.trim();
  const improvements = [];

  try {
    // EXPERT BYPASS: If the prompt contains high-quality markers or specific Danbooru weighting,
    // we assume the user is an expert and skip ALL modifications to preserve their exact tokenization.
    const isExpertPrompt =
      enhanced.includes("(") ||
      enhanced.includes("_") ||
      enhanced.toLowerCase().includes("masterpiece") ||
      enhanced.toLowerCase().includes("absurdres") ||
      enhanced.toLowerCase().includes("highres");

    if (isExpertPrompt) {
      logger.info(
        "[PromptIntelligence] Expert prompt detected, bypassing all enhancement.",
      );
      return userPrompt;
    }

    // First, analyze the prompt quality
    const qualityAnalysis = analyzePromptQuality(enhanced);

    // If the prompt is already excellent or good, do minimal enhancement
    if (!qualityAnalysis.needsEnhancement) {
      logger.info(
        `[PromptIntelligence] High-quality prompt detected (${qualityAnalysis.quality}), skipping enhancement:`,
        {
          original: userPrompt,
          score: qualityAnalysis.score,
          reasons: qualityAnalysis.reasons,
        },
      );

      // Only fix obvious mistakes for high-quality prompts
      enhanced = fixBasicMistakes(enhanced, improvements);
      return enhanced;
    }

    // For lower quality prompts, apply full enhancement
    logger.info(
      `[PromptIntelligence] Enhancing ${qualityAnalysis.quality} quality prompt:`,
      {
        original: userPrompt,
        score: qualityAnalysis.score,
        reasons: qualityAnalysis.reasons,
      },
    );

    // 1. Fix common spelling mistakes
    enhanced = fixBasicMistakes(enhanced, improvements);

    // 2. Enhance based on detected patterns (only for fair/poor quality)
    if (qualityAnalysis.score < 10) {
      const enhancements = [];

      // Helper to add keyword only if not already present
      const addKeyword = keyword => {
        if (!enhanced.toLowerCase().includes(keyword.toLowerCase())) {
          enhancements.push(keyword);
          return true;
        }
        return false;
      };

      for (const [category, config] of Object.entries(PROMPT_PATTERNS)) {
        for (const pattern of config.patterns) {
          const matches = enhanced.match(pattern);
          if (matches) {
            for (const match of matches) {
              const key = Object.keys(config.enhancements).find(k =>
                new RegExp(k, "i").test(match),
              );
              if (key && config.enhancements[key]) {
                const pieces = config.enhancements[key]
                  .split(",")
                  .map(p => p.trim());
                for (const piece of pieces) {
                  if (addKeyword(piece)) {
                    improvements.push(
                      `Enhanced ${category}: Added "${piece}" context`,
                    );
                  }
                }
              }
            }
          }
        }
      }

      // Add model-specific quality keywords
      if (MODEL_KEYWORDS[model]) {
        // Quality
        const qualityKeywords = MODEL_KEYWORDS[model].quality.slice(0, 5);
        for (const kw of qualityKeywords) {
          if (addKeyword(kw)) {
            improvements.push(`Added quality keyword for ${model}: ${kw}`);
          }
        }

        // Style (only if missing)
        if (!qualityAnalysis.hasStyle) {
          const styleKeywords = MODEL_KEYWORDS[model].style.slice(0, 3);
          for (const kw of styleKeywords) {
            if (addKeyword(kw)) {
              improvements.push(`Added style specification: ${kw}`);
            }
          }
        }

        // Character (if character detected)
        const hasCharacter =
          /\b(girl|boy|woman|man|character|person|female|male|lady|guy|dude|1girl|1boy)\b/i.test(
            enhanced,
          );
        if (hasCharacter) {
          const characterKeywords = MODEL_KEYWORDS[model].character.slice(0, 5);
          for (const kw of characterKeywords) {
            if (addKeyword(kw)) {
              improvements.push(`Refined character design: ${kw}`);
            }
          }
        }
      }

      // Smart semi-realistic detection
      if (
        enhanced.toLowerCase().includes("realistic") ||
        enhanced.toLowerCase().includes("semi-realistic")
      ) {
        const realismTags = [
          "(semi-realistic anime style:1.2)",
          "detailed skin texture",
          "soft cinematic lighting",
          "refined details",
        ];
        for (const tag of realismTags) {
          addKeyword(tag);
        }
        improvements.push("Injected semi-realistic anime balancing tags");
      }

      // Combine original prompt with enhancements
      if (enhancements.length > 0) {
        enhanced = `${enhanced}, ${enhancements.join(", ")}`;
      }
    }

    // Clean up the final prompt
    enhanced = enhanced
      .replace(/,\s*,/g, ",") // Remove double commas
      .replace(/\s+/g, " ") // Normalize spaces
      .replace(/,\s*$/, "") // Remove trailing comma
      .trim();

    if (improvements.length > 0) {
      logger.info(`[PromptIntelligence] Enhanced prompt for ${model}:`, {
        original: userPrompt,
        enhanced,
        improvements,
        qualityBefore: qualityAnalysis.quality,
        scoreBefore: qualityAnalysis.score,
      });
    }

    return enhanced;
  } catch (error) {
    logger.error("[PromptIntelligence] Error enhancing prompt:", error);
    return userPrompt; // Return original on error
  }
}

/**
 * Fix basic mistakes (spelling, grammar, redundancy) without adding content
 * @param {string} prompt - The prompt to fix
 * @param {Array} improvements - Array to track improvements
 * @returns {string} Fixed prompt
 */
function fixBasicMistakes(prompt, improvements) {
  let fixed = prompt;

  // Fix spelling mistakes
  for (const [mistake, correction] of Object.entries(
    COMMON_MISTAKES.spelling,
  )) {
    const regex = new RegExp(`\\b${mistake}\\b`, "gi");
    if (regex.test(fixed)) {
      fixed = fixed.replace(regex, correction);
      improvements.push(`Fixed spelling: "${mistake}" → "${correction}"`);
    }
  }

  // Fix grammar issues
  for (const [mistake, correction] of Object.entries(COMMON_MISTAKES.grammar)) {
    const regex = new RegExp(mistake, "gi");
    if (regex.test(fixed)) {
      fixed = fixed.replace(regex, correction);
      improvements.push(`Fixed grammar: "${mistake}" → "${correction}"`);
    }
  }

  // Remove redundant words
  for (const pattern of COMMON_MISTAKES.redundancy) {
    fixed = fixed.replace(pattern, match => {
      const words = match.split(" ");
      const unique = words[0];
      improvements.push(`Removed redundancy: "${match}" → "${unique}"`);
      return unique;
    });
  }

  return fixed;
}

/**
 * Get suggestions for improving a prompt
 * @param {string} userPrompt - Original user prompt
 * @param {string} model - Model being used
 * @returns {Array} Array of suggestion objects
 */
export function getPromptSuggestions(userPrompt, model = "anything") {
  const suggestions = [];

  if (!userPrompt || typeof userPrompt !== "string") {
    return suggestions;
  }

  // Analyze prompt quality first
  const qualityAnalysis = analyzePromptQuality(userPrompt);

  // Don't show suggestions for excellent prompts
  if (qualityAnalysis.quality === "excellent") {
    return [];
  }

  // Show fewer suggestions for good prompts
  if (qualityAnalysis.quality === "good") {
    // Only show advanced tips for good prompts
    if (model === "animagine") {
      suggestions.push({
        type: "advanced",
        message:
          "Try adding specific emotions or expressions for even better character portrayal",
        example:
          "Add 'gentle smile', 'mysterious expression', or 'confident pose'",
      });
    } else {
      suggestions.push({
        type: "advanced",
        message:
          "Consider adding lighting or composition details for professional results",
        example:
          "Add 'cinematic lighting', 'dramatic composition', or 'depth of field'",
      });
    }
    return suggestions;
  }

  const prompt = userPrompt.toLowerCase();
  const wordCount = userPrompt.split(/\s+/).length;

  // Suggest adding more details for very short prompts
  if (wordCount < 5) {
    suggestions.push({
      type: "length",
      message: "Consider adding more descriptive details to your prompt",
      example:
        "Instead of 'anime girl', try 'beautiful anime girl with long blue hair and expressive eyes'",
    });
  }

  // Suggest adding character details
  if (
    /\b(girl|boy|woman|man|character|person)\b/i.test(prompt) &&
    !/(hair|eyes|clothing|expression)/i.test(prompt)
  ) {
    suggestions.push({
      type: "character",
      message: "Add character details like hair color, eye color, or clothing",
      example:
        "Add details like 'long blonde hair', 'blue eyes', or 'school uniform'",
    });
  }

  // Suggest adding environment (only for fair/poor quality)
  if (
    qualityAnalysis.quality === "poor" &&
    !/(background|setting|environment|room|outdoor|indoor|school|cafe|park)/i.test(
      prompt,
    )
  ) {
    suggestions.push({
      type: "environment",
      message: "Consider adding a background or setting",
      example:
        "Add location like 'in a classroom', 'at the beach', or 'simple background'",
    });
  }

  // Suggest adding emotion/expression
  if (
    /\b(girl|boy|woman|man|character|person)\b/i.test(prompt) &&
    !/(happy|sad|smile|expression|mood|emotion)/i.test(prompt)
  ) {
    suggestions.push({
      type: "emotion",
      message: "Add an expression or emotion to bring the character to life",
      example:
        "Add expressions like 'smiling', 'happy expression', or 'mysterious look'",
    });
  }

  // Model-specific suggestions (only for fair/poor quality)
  if (qualityAnalysis.quality !== "good") {
    if (model === "animagine") {
      if (!qualityAnalysis.hasStyle) {
        suggestions.push({
          type: "style",
          message: "Animagine works best with anime/manga style specifications",
          example: "Add 'anime style' or 'manga style' to your prompt",
        });
      }
    }
  }

  // Limit suggestions to avoid overwhelming users
  return suggestions.slice(0, 3);
}

/**
 * Check if prompt needs NSFW flag based on content
 * @param {string} userPrompt - User prompt to analyze
 * @returns {Object} Analysis result with recommendation
 */
export function analyzeNSFWContent(userPrompt) {
  if (!userPrompt || typeof userPrompt !== "string") {
    return { needsNSFW: false, confidence: 0, reasons: [] };
  }

  const prompt = userPrompt.toLowerCase();
  const nsfwKeywords = [
    "nude",
    "naked",
    "topless",
    "bottomless",
    "underwear",
    "lingerie",
    "bikini",
    "sexual",
    "erotic",
    "adult",
    "explicit",
    "suggestive",
    "seductive",
    "provocative",
    "breast",
    "breasts",
    "cleavage",
    "nipple",
    "nipples",
    "genitals",
    "intimate",
    "sensual",
  ];

  const foundKeywords = nsfwKeywords.filter(keyword =>
    prompt.includes(keyword),
  );
  const needsNSFW = foundKeywords.length > 0;
  const confidence = Math.min(foundKeywords.length * 0.3, 1.0);

  return {
    needsNSFW,
    confidence,
    reasons: foundKeywords.map(keyword => `Contains keyword: "${keyword}"`),
    recommendation: needsNSFW ? "Add --nsfw flag to your prompt" : null,
  };
}

/**
 * Get model-specific tips for better results
 * @param {string} model - Model name
 * @returns {Array} Array of tips
 */
export function getModelTips(model) {
  const tips = {
    animagine: [
      "Animagine XL 4.0 excels at character design and facial expressions",
      "Use detailed character descriptions for best results",
      "Specify 'anime style' or 'manga style' in your prompt",
      "Add emotion keywords like 'happy expression' or 'mysterious look'",
      "Include clothing details like 'school uniform' or 'casual outfit'",
    ],
    anything: [
      "Anything XL is versatile and works well with various anime styles",
      "Use quality keywords like 'masterpiece' and 'best quality'",
      "Specify lighting conditions like 'soft lighting' or 'dramatic lighting'",
      "Add composition keywords like 'beautiful composition' or 'cinematic'",
      "Include detailed descriptions for better anatomy and proportions",
    ],
  };

  return tips[model] || [];
}
