/**
 * Image Generation Prompts
 * Simplified prompt configuration for current AI image generation system
 *
 * PROVIDER_PROMPTS: Used by /avatar command only
 * IMAGINE_PROMPTS: Used by /imagine command for quality enhancements
 */

import dedent from "dedent";

// ============================================================================
// AVATAR COMMAND PROMPTS (Provider-specific)
// ============================================================================

// Provider-specific base prompt templates for /avatar command
export const PROVIDER_PROMPTS = {
  // Stability AI - Primary provider for avatar generation
  stability: {
    base: dedent`
      anime avatar portrait, {characterDescription}, masterpiece, best quality, ultra detailed,
      detailed character design, looking directly at viewer, professional anime art style,
      clean line art, vibrant colors, expressive eyes, detailed facial features, perfect anatomy,
      studio quality, sharp focus, professional digital art, anime character design, 
      detailed shading, soft lighting, beautiful composition, centered framing, upper body portrait,
      detailed clothing, character sheet quality, official art style, clean background
    `,
    suffix: ", anime style, manga style, detailed, professional art",
    negative: dedent`
      blurry, low quality, distorted, deformed, ugly, low resolution, pixelated, grainy, noisy,
      bad anatomy, bad proportions, extra limbs, missing limbs, malformed hands, malformed feet,
      extra fingers, missing fingers, fused fingers, long neck, bad hands, bad feet,
      multiple heads, multiple faces, double exposure, out of focus, motion blur,
      watermark, text, signature, jpeg artifacts, compression artifacts,
      realistic, photorealistic, 3d render, cgi, computer generated, artificial, fake,
      cartoon, western animation, disney style, pixar style,
      oversaturated, undersaturated, low contrast, high contrast, dark, too bright, overexposed, underexposed
    `,
  },

  // ComfyUI - Fallback for avatar generation
  comfyui: {
    base: dedent`
      {characterDescription}, masterpiece, best quality, ultra detailed,
      detailed character design, professional anime art style, clean line art, vibrant colors,
      expressive eyes, detailed facial features, perfect anatomy, studio quality, sharp focus,
      professional digital art, detailed shading, soft lighting, beautiful composition
    `,
    suffix: ", anime style, manga style, detailed, professional art",
    negative: dedent`
      blurry, low quality, distorted, deformed, ugly, low resolution, pixelated, grainy, noisy,
      bad anatomy, bad proportions, extra limbs, missing limbs, malformed hands, malformed feet,
      extra fingers, missing fingers, fused fingers, long neck, bad hands, bad feet,
      multiple heads, multiple faces, double exposure, out of focus, motion blur,
      watermark, text, signature, jpeg artifacts, compression artifacts,
      realistic, photorealistic, 3d render, cgi, computer generated, artificial, fake,
      cartoon, western animation, disney style, pixar style,
      oversaturated, undersaturated, low contrast, high contrast, dark, too bright, overexposed, underexposed
    `,
  },
};

// Legacy support for backward compatibility
export const BASE_PROMPT_TEMPLATE = PROVIDER_PROMPTS.stability.base;
export const PROMPT_SUFFIX = PROVIDER_PROMPTS.stability.suffix;
export const NEGATIVE_PROMPT = PROVIDER_PROMPTS.stability.negative;

// Default character description
export const DEFAULT_CHARACTER =
  process.env.AI_DEFAULT_CHARACTER || "a beautiful anime character";

// Character type enhancements for /avatar command
export const CHARACTER_TYPE_ENHANCEMENTS = {
  male: "handsome male character, masculine features, strong jawline, confident expression",
  female:
    "beautiful female character, elegant features, graceful expression, feminine charm",
  boy: "cute young male character, youthful appearance, energetic expression, boyish charm",
  girl: "cute young female character, adorable features, sweet expression, youthful innocence",
  character:
    "unique character design, distinctive features, memorable appearance, original design",
  person:
    "realistic anime person, human character, natural features, relatable appearance",
  avatar:
    "perfect avatar design, profile picture ready, social media friendly, clean composition",
};

// Style modifiers for /avatar command
export const STYLE_MODIFIERS = {
  art_styles: {
    manga:
      "manga style, black and white line art, traditional Japanese comics style, bold linework, dramatic shading",
    modern:
      "modern anime style, contemporary anime design, clean digital art, vibrant colors, detailed character design",
    retro:
      "retro anime style, 80s 90s vintage anime aesthetic, classic anime proportions, nostalgic color palette",
    realistic:
      "semi-realistic anime, detailed realistic features, lifelike proportions, photorealistic anime style",
    chibi:
      "chibi style, super deformed character design, cute chibi proportions, large head small body, adorable kawaii design",
    lofi: "lo-fi anime style, chill aesthetic, soft muted colors, dreamy atmosphere, nostalgic vibes, relaxed character design",
  },
  // Color and mood styles are automatically detected from prompt text
  colors: {
    vibrant:
      "vibrant colors, bold color palette, saturated colors, bright colors",
    pastel: "pastel colors, soft color palette, muted colors, gentle colors",
    monochrome: "monochrome, black and white, grayscale, single color",
    neon: "neon colors, glowing colors, electric colors, fluorescent colors",
    warm: "warm colors, warm color palette, orange red yellow tones",
    cool: "cool colors, cool color palette, blue green purple tones",
  },
  moods: {
    happy: "happy expression, cheerful, smiling, joyful, positive mood",
    serious: "serious expression, stern, focused, determined, intense mood",
    mysterious: "mysterious expression, enigmatic, secretive, intriguing mood",
    cute: "cute expression, adorable, sweet, kawaii, charming mood",
    cool: "cool expression, confident, stylish, composed, relaxed mood",
    elegant:
      "elegant expression, graceful, refined, sophisticated, classy mood",
  },
};

// ============================================================================
// IMAGINE COMMAND PROMPTS
// ============================================================================

/**
 * NSFW-specific negative prompt for adult content
 * Comprehensive exclusions for better quality NSFW generation
 */
export const NSFW_NEGATIVE_PROMPT = dedent`
  (worst quality, low quality:1.4), (bad anatomy, bad hands:1.3), (missing fingers, extra fingers, fused fingers:1.2), 
  (poorly drawn hands, poorly drawn face:1.2), (deformed, ugly, blurry:1.2), (bad proportions, extra limbs, missing limbs:1.2), 
  (long neck, mutation, mutilated:1.1), (out of frame, cropped:1.1), (jpeg artifacts, watermark, signature, username, text:1.2), 
  (monochrome, grayscale:1.1), (bad feet, bad legs:1.1), (asymmetrical eyes, cross-eyed:1.1), (duplicate, clone:1.1)
`;

/**
 * Comprehensive negative prompt for /imagine command (safe content)
 * Focuses on technical quality issues and prevents NSFW content
 */
export const IMAGINE_NEGATIVE_PROMPT = dedent`
  (worst_quality, low_quality:1.4), (bad_anatomy, bad_hands:1.3), (missing_fingers, extra_fingers, fused_fingers:1.2), 
  (poorly_drawn_hands, poorly_drawn_face:1.2), (deformed, ugly, blurry:1.2), (bad_proportions, extra_limbs, missing_limbs:1.2), 
  (long_neck, mutation, mutilated:1.1), (out_of_frame, cropped:1.1), (jpeg_artifacts, watermark, signature, username, text:1.2), 
  (monochrome, grayscale:1.1), (bad_feet, bad_legs:1.1), (asymmetrical_eyes, cross_eyed:1.1), (duplicate, clone:1.1),
  nsfw, nude, naked, topless, bottomless, underwear, lingerie, bikini, swimsuit, revealing_clothing,
  sexual, erotic, adult_content, inappropriate, explicit, suggestive, seductive, provocative,
  breast, breasts, cleavage, nipple, nipples, genitals, private_parts, intimate, sensual
`;

/**
 * Get the appropriate negative prompt for the content type
 * @param {boolean} isNSFW - Whether this is NSFW content
 * @param {string} _provider - Provider name (unused, kept for compatibility)
 * @returns {string} Appropriate negative prompt
 */
export function getImagineNegativePrompt(isNSFW = false, _provider = null) {
  return isNSFW ? NSFW_NEGATIVE_PROMPT : IMAGINE_NEGATIVE_PROMPT;
}

/**
 * Enhanced prompt function for /imagine command
 * Now handled by the intelligent prompt enhancement system
 * This function is kept for compatibility but returns the prompt unchanged
 * @param {string} userPrompt - Original user prompt
 * @param {boolean} _isNSFW - Whether this is NSFW content (unused)
 * @returns {string} Unmodified prompt (enhancement handled by promptIntelligence.js)
 */
export function enhanceImaginePrompt(userPrompt, _isNSFW = false) {
  if (!userPrompt || typeof userPrompt !== "string") {
    return userPrompt;
  }

  // Return original prompt - enhancement is now handled by promptIntelligence.js
  return userPrompt.trim();
}
