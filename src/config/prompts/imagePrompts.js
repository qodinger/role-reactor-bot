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
  bad anatomy, bad hands, bad fingers, missing fingers, extra fingers, fused fingers, too many fingers, 
  poorly drawn hands, poorly drawn face, deformed, ugly, blurry, bad proportions, extra limbs, missing limbs, 
  bad feet, long neck, mutation, mutilated, out of frame, worst quality, low quality, jpeg artifacts, 
  watermark, signature, username, text, bad breasts, bad nipples, extra breasts, missing breasts, 
  fused breasts, asymmetrical breasts, deformed breasts, malformed breasts, unnatural breasts, 
  bad genitals, deformed genitals, malformed genitals, extra genitals, missing genitals, fused genitals, 
  unnatural genitals, distorted genitals, three legs, three arms, four arms, four legs, six fingers, 
  seven fingers, eight fingers, multiple heads, multiple faces, extra heads, extra faces, bad skin, 
  plastic skin, shiny skin, oily skin, sweaty skin, dirty skin, bad lighting, harsh lighting, 
  flat lighting, overexposed, underexposed, dark shadows, bad shadows, censored, mosaic, bar censor, 
  black bar, pixelated, blocked, covered, hidden, amateur, snapshot, low resolution, grainy, noisy, 
  out of focus, motion blur, cartoon, anime (when realistic requested), 3d render (when 2d requested), 
  cgi, computer generated, artificial, fake, distorted face, melted face, warped face, stretched face, 
  compressed face, squished face, asymmetrical face, bad pose, awkward pose, unnatural pose, 
  impossible pose, twisted body, broken spine, dislocated joints
`;

/**
 * Comprehensive negative prompt for /imagine command (safe content)
 * Focuses on technical quality issues and prevents NSFW content
 */
export const IMAGINE_NEGATIVE_PROMPT = dedent`
  blurry, low quality, distorted, deformed, ugly, low resolution, pixelated, grainy, noisy, bad quality, worst quality,
  bad anatomy, bad proportions, incorrect anatomy, wrong anatomy, malformed anatomy, distorted anatomy, poor anatomy,
  extra limbs, missing limbs, malformed hands, malformed feet, malformed body, malformed torso, malformed legs, malformed arms,
  extra fingers, missing fingers, fused fingers, too many fingers, missing arms, extra arms, missing legs, extra legs,
  bad hands, bad fingers, bad feet, bad eyes, bad ears, bad mouth, bad teeth, bad hair, bad face, bad nose,
  long neck, short neck, twisted body, broken spine, unnatural joints, dislocated joints, 
  asymmetrical body, asymmetrical face, asymmetrical limbs, asymmetrical hands, asymmetrical eyes,
  incorrect proportions, wrong proportions, disproportionate, disproportional, unnatural proportions,
  poorly drawn hands, poorly drawn face, poorly drawn body, poorly drawn anatomy, poorly drawn features,
  multiple heads, multiple faces, double exposure, out of focus, motion blur, depth of field,
  bad composition, bad perspective, bad angle, awkward pose, unnatural pose, impossible pose,
  watermark, text, signature, username, jpeg artifacts, compression artifacts, artifacts, glitch,
  oversaturated, undersaturated, low contrast, high contrast, dark, too bright, overexposed, underexposed,
  bad lighting, bad shadows, harsh shadows, flat lighting, unnatural lighting, poor lighting,
  duplicate, mutation, mutated, cloned, clone, cloned face, floating limbs, disconnected limbs,
  three legs, three arms, four arms, four legs, six fingers, seven fingers, eight fingers,
  missing body parts, extra body parts, fused body parts, merged body parts, conjoined,
  distorted face, melted face, warped face, stretched face, compressed face, squished face,
  nsfw, nude, naked, topless, bottomless, underwear, lingerie, bikini, swimsuit, revealing clothing,
  sexual, erotic, adult content, inappropriate, explicit, suggestive, seductive, provocative,
  breast, breasts, cleavage, nipple, nipples, genitals, private parts, intimate, sensual
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
