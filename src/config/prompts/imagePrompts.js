/**
 * Image Generation Prompts
 * Provider-specific prompt templates and style modifiers for AI image generation
 *
 * IMPORTANT: PROVIDER_PROMPTS are ONLY used by the /avatar command.
 * The /imagine command uses IMAGINE_PROMPTS (see below) for quality enhancements.
 * See useAvatarPrompts flag in provider configs to control this behavior.
 */

import dedent from "dedent";

// Provider-specific base prompt templates
export const PROVIDER_PROMPTS = {
  // Stability AI (SD3.5-flash) - Optimized for detailed, technical prompts
  stability: {
    base: dedent`
      anime avatar portrait, {characterDescription}, masterpiece, best quality, ultra detailed,
      detailed character design, looking directly at viewer, professional anime art style,
      clean line art, vibrant colors, expressive eyes, detailed facial features, perfect anatomy,
      studio quality, trending on pixiv, popular on artstation, sharp focus,
      professional digital art, anime character design, kawaii aesthetic, modern anime style,
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

  // OpenRouter (Gemini 2.5 Flash Image Preview) - Optimized for conversational, natural language
  openrouter: {
    base: dedent`
      Create an anime avatar portrait of {characterDescription}, masterpiece quality, best quality, ultra detailed.
      The image should feature a detailed character design with the character looking directly at the viewer.
      Use a professional anime art style with clean line art and vibrant colors. Include expressive eyes,
      detailed facial features, and perfect anatomy. The artwork should be studio quality with detailed shading,
      soft lighting, and beautiful composition. Frame it as an upper body portrait with detailed clothing
      and a clean background in official art style.
    `,
    suffix: "Make it anime style, manga style, detailed, professional art.",
    negative: dedent`
      Avoid blurry, low quality, distorted, deformed, ugly, low resolution, pixelated, grainy, noisy,
      bad anatomy, bad proportions, extra limbs, missing limbs, malformed hands, malformed feet,
      extra fingers, missing fingers, fused fingers, long neck, bad hands, bad feet,
      multiple heads, multiple faces, double exposure, out of focus, motion blur,
      watermark, text, signature, jpeg artifacts, compression artifacts,
      realistic, photorealistic, 3d render, cgi, computer generated, artificial, fake,
      cartoon, western animation, disney style, pixar style,
      oversaturated, undersaturated, low contrast, high contrast, dark, too bright, overexposed, underexposed
    `,
  },

  // OpenAI (DALL-E 3) - Optimized for descriptive, artistic prompts
  openai: {
    base: dedent`
      A beautiful anime avatar portrait of {characterDescription}, masterpiece quality, best quality, ultra detailed.
      The artwork should be a detailed character design with the character looking directly at the viewer.
      Use a professional anime art style with clean line art and vibrant colors. Include expressive eyes,
      detailed facial features, and perfect anatomy. The artwork should be studio quality with detailed shading,
      soft lighting, and beautiful composition. Frame it as an upper body portrait with detailed clothing
      and a clean background in official art style.
    `,
    suffix: "Anime style, manga style, detailed, professional art.",
    negative: dedent`
      blurry, low quality, distorted, deformed, ugly, bad anatomy, bad proportions, extra limbs, missing limbs,
      watermark, text, signature, realistic, photorealistic, 3d render, cgi, computer generated, artificial, fake,
      cartoon, western animation, disney style, pixar style, low resolution, pixelated, grainy, noisy,
      oversaturated, undersaturated, low contrast, high contrast, dark, too bright, overexposed, underexposed,
      out of focus, motion blur, double exposure, multiple heads, multiple faces, malformed hands, malformed feet,
      extra fingers, missing fingers, fused fingers, long neck, bad hands, bad feet
    `,
  },

  // ComfyUI/ComfyICU - Optimized for unrestricted generation (no content blocking)
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

  // Self-Hosted - Optimized for self-hosted Stable Diffusion
  selfhosted: {
    base: dedent`
      anime avatar portrait, {characterDescription}, masterpiece, best quality, ultra detailed,
      detailed character design, looking directly at viewer, professional anime art style,
      clean line art, vibrant colors, expressive eyes, detailed facial features, perfect anatomy,
      studio quality, trending on pixiv, popular on artstation, sharp focus,
      professional digital art, anime character design, kawaii aesthetic, modern anime style,
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
};

// Legacy support - use stability as default for backward compatibility
export const BASE_PROMPT_TEMPLATE = PROVIDER_PROMPTS.stability.base;

// Legacy support - use stability as default for backward compatibility
export const PROMPT_SUFFIX = PROVIDER_PROMPTS.stability.suffix;
export const NEGATIVE_PROMPT = PROVIDER_PROMPTS.stability.negative;

// Default character description
export const DEFAULT_CHARACTER =
  process.env.AI_DEFAULT_CHARACTER || "a beautiful anime character";

// Character type enhancements
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

// Style modifiers
export const STYLE_MODIFIERS = {
  colors: {
    vibrant: dedent`
      VIBRANT COLOR PALETTE, bright saturated colors, high contrast, colorful design, vivid tones,
      bright palette, saturated colors, eye-catching colors, bold color scheme
    `,
    pastel: dedent`
      PASTEL COLOR PALETTE, soft gentle colors, dreamy pastel tones, light muted colors,
      soft color scheme, gentle palette, dreamy colors, soft pastel aesthetic
    `,
    monochrome: dedent`
      MONOCHROME STYLE, grayscale color scheme, black and white, classic monochrome,
      grayscale palette, black and white design, classic look, monochrome aesthetic
    `,
    neon: dedent`
      NEON COLOR PALETTE, cyberpunk colors, glowing neon effects, futuristic colors,
      bright neon tones, cyberpunk aesthetic, glowing effects, electric colors
    `,
    warm: dedent`
      WARM COLOR PALETTE, golden warm tones, cozy warm colors, inviting warm atmosphere,
      warm color scheme, golden palette, warm cozy colors, inviting tones
    `,
    cool: dedent`
      COOL COLOR PALETTE, blue cool tones, refreshing cool colors, calm cool atmosphere,
      cool color scheme, blue palette, refreshing cool tones, calm colors
    `,
  },
  moods: {
    happy: dedent`
      HAPPY EXPRESSION, cheerful bright smile, joyful mood, positive energy,
      happy facial expression, bright cheerful look, joyful character, positive vibes
    `,
    serious: dedent`
      SERIOUS EXPRESSION, focused determined look, professional mood,
      serious facial expression, focused determined character, professional appearance, serious demeanor
    `,
    mysterious: dedent`
      MYSTERIOUS EXPRESSION, enigmatic intriguing look, secretive mood,
      mysterious facial expression, enigmatic character, intriguing mysterious vibe, secretive demeanor
    `,
    cute: dedent`
      CUTE EXPRESSION, adorable kawaii look, sweet lovable mood,
      cute facial expression, adorable character, kawaii cute vibe, sweet lovable appearance
    `,
    cool: dedent`
      COOL EXPRESSION, confident stylish look, trendy mood,
      cool facial expression, confident character, stylish cool vibe, trendy appearance
    `,
    elegant: dedent`
      ELEGANT EXPRESSION, refined sophisticated look, graceful mood,
      elegant facial expression, refined character, sophisticated elegant vibe, graceful appearance
    `,
  },
  art_styles: {
    studio: dedent`
      STUDIO GHIBLI STYLE, Hayao Miyazaki inspired art, detailed hand-drawn animation quality,
      soft watercolor-like colors, whimsical character design, nature-inspired elements,
      detailed backgrounds, traditional animation techniques
    `,
    manga: dedent`
      MANGA STYLE, black and white line art, traditional Japanese comics style,
      bold linework, dramatic shading, expressive character design, classic manga proportions, ink wash techniques
    `,
    modern: dedent`
      MODERN ANIME STYLE, contemporary anime design, current 2020s trends,
      clean digital art, vibrant colors, detailed character design, popular anime aesthetic, high-quality illustration
    `,
    retro: dedent`
      RETRO ANIME STYLE, 80s 90s vintage anime aesthetic, classic anime proportions,
      nostalgic color palette, traditional cel animation look, old-school anime character design, vintage anime art style
    `,
    realistic: dedent`
      SEMI-REALISTIC ANIME, detailed realistic features, lifelike proportions,
      photorealistic anime style, detailed facial features, realistic anatomy, high-detail character design, realistic anime art
    `,
    chibi: dedent`
      CHIBI STYLE, super deformed character design, cute chibi proportions,
      large head small body, adorable kawaii design, chibi anime style, super cute character,
      deformed cute proportions, chibi art style
    `,
    lofi: dedent`
      LO-FI ANIME STYLE, chill aesthetic, soft muted colors, dreamy atmosphere,
      nostalgic vibes, relaxed character design, cozy warm tones, study music aesthetic,
      vintage filter effects, soft gradients, minimalist backgrounds, peaceful mood,
      low contrast, gentle lighting, zen-like composition, calming anime art style
    `,
  },
};

// ============================================================================
// IMAGINE COMMAND PROMPTS
// ============================================================================
// Quality enhancements and negative prompts for /imagine command
// These are general-purpose and don't force specific styles (unlike avatar prompts)

/**
 * Quality enhancement suffix to append to user prompts
 * Adds universal quality tags without forcing any specific style
 * Works for any image type: realistic, anime, fantasy, sci-fi, etc.
 * Style-agnostic: preserves user's artistic intent
 * Based on research: detailed quality tags significantly improve output quality
 */
export const IMAGINE_QUALITY_ENHANCEMENT =
  ", masterpiece, best quality, ultra detailed, highly detailed, 8k resolution, sharp focus, professional, detailed, perfect composition, beautiful, high quality, perfect anatomy, correct anatomy, natural anatomy, anatomically correct, proper body proportions, realistic proportions, natural body structure, correct body structure, natural lighting, well lit, good lighting, proper proportions, realistic proportions";

/**
 * Comprehensive negative prompt for /imagine command
 * Focuses on technical quality issues, not content/style restrictions
 * Organized by category: Quality → Anatomy → Composition → Technical → Style
 * Based on research: comprehensive negative prompts significantly reduce artifacts
 */
export const IMAGINE_NEGATIVE_PROMPT = dedent`
  blurry, low quality, distorted, deformed, ugly, low resolution, pixelated, grainy, noisy, bad quality, worst quality,
  bad anatomy, bad proportions, incorrect anatomy, wrong anatomy, malformed anatomy, distorted anatomy,
  extra limbs, missing limbs, malformed hands, malformed feet, malformed body, malformed torso, malformed legs, malformed arms,
  extra fingers, missing fingers, fused fingers, too many fingers, missing arms, extra arms, missing legs, extra legs,
  long neck, short neck, bad hands, bad feet, bad eyes, bad ears, bad mouth, bad teeth, bad hair,
  twisted body, broken spine, unnatural joints, dislocated joints, asymmetrical body, asymmetrical face, asymmetrical limbs,
  incorrect proportions, wrong proportions, disproportionate, disproportional, unnatural proportions,
  malformed genitals, distorted genitals, incorrect genitals, wrong genitals,
  multiple heads, multiple faces, double exposure, out of focus, motion blur, depth of field,
  bad composition, bad perspective, bad angle, awkward pose, unnatural pose, impossible pose,
  watermark, text, signature, username, jpeg artifacts, compression artifacts, artifacts, glitch,
  oversaturated, undersaturated, low contrast, high contrast, dark, too bright, overexposed, underexposed,
  bad lighting, bad shadows, harsh shadows, flat lighting, unnatural lighting,
  duplicate, mutation, mutated, cloned, clone, cloned face, floating limbs, disconnected limbs
`;

/**
 * Provider-specific negative prompts for /imagine command (if needed)
 * Can override the default for specific providers
 */
export const IMAGINE_PROVIDER_NEGATIVE_PROMPTS = {
  comfyui: IMAGINE_NEGATIVE_PROMPT,
  stability: IMAGINE_NEGATIVE_PROMPT,
  selfhosted: IMAGINE_NEGATIVE_PROMPT,
  openrouter: IMAGINE_NEGATIVE_PROMPT, // OpenRouter doesn't use negative prompts, but kept for consistency
  openai: IMAGINE_NEGATIVE_PROMPT, // OpenAI doesn't use negative prompts, but kept for consistency
};

/**
 * Enhance a user prompt with quality improvements for /imagine command
 * Preserves user intent while adding universal quality tags
 * Style-agnostic: works for any image type (realistic, anime, fantasy, etc.)
 * @param {string} userPrompt - Original user prompt
 * @returns {string} Enhanced prompt
 */
export function enhanceImaginePrompt(userPrompt) {
  if (!userPrompt || typeof userPrompt !== "string") {
    return userPrompt;
  }

  const trimmed = userPrompt.trim();

  // Don't enhance if prompt already contains quality tags (avoid duplication)
  const qualityKeywords = [
    "masterpiece",
    "best quality",
    "ultra detailed",
    "highly detailed",
    "high quality",
    "professional",
    "8k",
    "4k",
    "sharp focus",
    "detailed",
    "perfect",
  ];

  const lowerPrompt = trimmed.toLowerCase();
  const hasQualityTags = qualityKeywords.some(keyword =>
    lowerPrompt.includes(keyword),
  );

  // Count how many quality keywords are present
  const qualityKeywordCount = qualityKeywords.filter(keyword =>
    lowerPrompt.includes(keyword),
  ).length;

  // Only skip enhancement if user has 3+ quality keywords (very detailed prompt)
  // This allows enhancement for prompts with 1-2 quality keywords
  if (hasQualityTags && qualityKeywordCount >= 3) {
    return trimmed;
  }

  // Append universal quality enhancement (style-agnostic)
  // Even if some quality keywords exist, adding more can help
  return `${trimmed}${IMAGINE_QUALITY_ENHANCEMENT}`;
}
