/**
 * Image Generation Prompts
 * Provider-specific prompt templates and style modifiers for AI image generation
 */

import dedent from "dedent";

// Provider-specific base prompt templates
export const PROVIDER_PROMPTS = {
  // Stability AI (SD3.5-flash) - Optimized for detailed, technical prompts
  stability: {
    base: dedent`
      anime avatar portrait, {characterDescription}, detailed character design, looking directly at viewer,
      professional anime art style, high quality anime illustration, clean line art, vibrant colors,
      expressive eyes, detailed facial features, perfect anatomy, studio quality, trending on pixiv,
      popular on artstation, masterpiece, best quality, ultra detailed, 8k resolution, sharp focus,
      professional digital art, anime character design, kawaii aesthetic, modern anime style,
      detailed shading, soft lighting, beautiful composition, centered framing, upper body portrait,
      detailed clothing, character sheet quality, official art style, clean background, professional illustration
    `,
    suffix:
      ", anime style, manga style, detailed, high quality, professional art",
    negative: dedent`
      blurry, low quality, distorted, deformed, ugly, bad anatomy, bad proportions, extra limbs, missing limbs,
      watermark, text, signature, nsfw, explicit, adult content, realistic, photorealistic, 3d render, cgi,
      computer generated, artificial, fake, cartoon, western animation, disney style, pixar style, low resolution,
      pixelated, grainy, noisy, oversaturated, undersaturated, low contrast, high contrast, dark, too bright,
      overexposed, underexposed, out of focus, motion blur, double exposure, multiple heads, multiple faces,
      malformed hands, malformed feet, extra fingers, missing fingers, fused fingers, long neck, bad hands, bad feet
    `,
  },

  // OpenRouter (Gemini 2.5 Flash Image Preview) - Optimized for conversational, natural language
  openrouter: {
    base: dedent`
      Create an anime avatar portrait of {characterDescription}. The image should feature a detailed character design
      with the character looking directly at the viewer. Use a professional anime art style with high quality
      illustration, clean line art, and vibrant colors. Include expressive eyes, detailed facial features, and
      perfect anatomy. The artwork should be studio quality, masterpiece level, with detailed shading, soft lighting,
      and beautiful composition. Frame it as an upper body portrait with detailed clothing and a clean background
      in official art style.
    `,
    suffix:
      "Make it anime style, manga style, detailed, high quality, professional art.",
    negative: dedent`
      Avoid blurry, low quality, distorted, deformed, ugly, bad anatomy, bad proportions, extra limbs, missing limbs,
      watermark, text, signature, nsfw, explicit, adult content, realistic, photorealistic, 3d render, cgi,
      computer generated, artificial, fake, cartoon, western animation, disney style, pixar style, low resolution,
      pixelated, grainy, noisy, oversaturated, undersaturated, low contrast, high contrast, dark, too bright,
      overexposed, underexposed, out of focus, motion blur, double exposure, multiple heads, multiple faces,
      malformed hands, malformed feet, extra fingers, missing fingers, fused fingers, long neck, bad hands, bad feet
    `,
  },

  // OpenAI (DALL-E 3) - Optimized for descriptive, artistic prompts
  openai: {
    base: dedent`
      A beautiful anime avatar portrait of {characterDescription}. The artwork should be a detailed character design
      with the character looking directly at the viewer. Use a professional anime art style with high quality
      illustration, clean line art, and vibrant colors. Include expressive eyes, detailed facial features, and
      perfect anatomy. The artwork should be studio quality, masterpiece level, with detailed shading, soft lighting,
      and beautiful composition. Frame it as an upper body portrait with detailed clothing and a clean background
      in official art style.
    `,
    suffix:
      "Anime style, manga style, detailed, high quality, professional art.",
    negative: dedent`
      blurry, low quality, distorted, deformed, ugly, bad anatomy, bad proportions, extra limbs, missing limbs,
      watermark, text, signature, nsfw, explicit, adult content, realistic, photorealistic, 3d render, cgi,
      computer generated, artificial, fake, cartoon, western animation, disney style, pixar style, low resolution,
      pixelated, grainy, noisy, oversaturated, undersaturated, low contrast, high contrast, dark, too bright,
      overexposed, underexposed, out of focus, motion blur, double exposure, multiple heads, multiple faces,
      malformed hands, malformed feet, extra fingers, missing fingers, fused fingers, long neck, bad hands, bad feet
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
