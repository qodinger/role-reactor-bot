/**
 * AI Prompt Configuration
 * Provider-specific prompt templates optimized for Stability AI, OpenRouter, and OpenAI
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
      extra arms, extra legs, malformed hands, malformed feet, missing hands, missing feet, bad hands, bad feet,
      extra fingers, missing fingers, fused fingers, long neck, short neck, wide neck, thin neck, bad neck,
      extra neck, missing neck, bad shoulders, extra shoulders, missing shoulders, bad torso, extra torso,
      missing torso, bad waist, extra waist, missing waist, bad hips, extra hips, missing hips, bad legs,
      extra legs, missing legs, bad feet, extra feet, missing feet, bad toes, extra toes, missing toes,
      bad fingers, extra fingers, missing fingers, bad hands, extra hands, missing hands, bad arms, extra arms,
      missing arms, bad elbows, extra elbows, missing elbows, bad wrists, extra wrists, missing wrists,
      bad shoulders, extra shoulders, missing shoulders, bad neck, extra neck, missing neck, bad head,
      extra head, missing head, bad face, extra face, missing face, bad eyes, extra eyes, missing eyes,
      bad nose, extra nose, missing nose, bad mouth, extra mouth, missing mouth, bad ears, extra ears,
      missing ears, bad hair, extra hair, missing hair, bad eyebrows, extra eyebrows, missing eyebrows,
      bad eyelashes, extra eyelashes, missing eyelashes, bad teeth, extra teeth, missing teeth, bad tongue,
      extra tongue, missing tongue, bad chin, extra chin, missing chin, bad cheeks, extra cheeks, missing cheeks,
      bad forehead, extra forehead, missing forehead, bad jaw, extra jaw, missing jaw, bad lips, extra lips,
      missing lips, bad skin, extra skin, missing skin, bad clothing, extra clothing, missing clothing,
      bad accessories, extra accessories, missing accessories, bad background, extra background, missing background,
      bad lighting, extra lighting, missing lighting, bad shadows, extra shadows, missing shadows, bad reflections,
      extra reflections, missing reflections, bad colors, extra colors, missing colors, bad textures, extra textures,
      missing textures, bad materials, extra materials, missing materials, bad surfaces, extra surfaces, missing surfaces,
      bad edges, extra edges, missing edges, bad lines, extra lines, missing lines, bad shapes, extra shapes,
      missing shapes, bad forms, extra forms, missing forms, bad volumes, extra volumes, missing volumes, bad spaces,
      extra spaces, missing spaces, bad compositions, extra compositions, missing compositions, bad perspectives,
      extra perspectives, missing perspectives, bad angles, extra angles, missing angles, bad viewpoints,
      extra viewpoints, missing viewpoints, bad framing, extra framing, missing framing, bad cropping,
      extra cropping, missing cropping, bad scaling, extra scaling, missing scaling, bad rotation, extra rotation,
      missing rotation, bad translation, extra translation, missing translation, bad transformation, extra transformation,
      missing transformation, bad deformation, extra deformation, missing deformation, bad distortion, extra distortion,
      missing distortion, bad aberration, extra aberration, missing aberration, bad artifacts, extra artifacts,
      missing artifacts, bad noise, extra noise, missing noise, bad grain, extra grain, missing grain, bad compression,
      extra compression, missing compression, bad encoding, extra encoding, missing encoding, bad decoding,
      extra decoding, missing decoding, bad processing, extra processing, missing processing, bad filtering,
      extra filtering, missing filtering, bad enhancement, extra enhancement, missing enhancement, bad optimization,
      extra optimization, missing optimization, bad correction, extra correction, missing correction, bad adjustment,
      extra adjustment, missing adjustment, bad modification, extra modification, missing modification, bad alteration,
      extra alteration, missing alteration, bad change, extra change, missing change, bad variation, extra variation,
      missing variation, bad diversity, extra diversity, missing diversity, bad uniqueness, extra uniqueness,
      missing uniqueness, bad originality, extra originality, missing originality, bad creativity, extra creativity,
      missing creativity, bad innovation, extra innovation, missing innovation, bad invention, extra invention,
      missing invention, bad discovery, extra discovery, missing discovery, bad exploration, extra exploration,
      missing exploration, bad experimentation, extra experimentation, missing experimentation, bad testing,
      extra testing, missing testing, bad validation, extra validation, missing validation, bad verification,
      extra verification, missing verification, bad confirmation, extra confirmation, missing confirmation,
      bad approval, extra approval, missing approval, bad acceptance, extra acceptance, missing acceptance,
      bad endorsement, extra endorsement, missing endorsement, bad recommendation, extra recommendation,
      missing recommendation, bad suggestion, extra suggestion, missing suggestion, bad advice, extra advice,
      missing advice, bad guidance, extra guidance, missing guidance, bad direction, extra direction,
      missing direction, bad instruction, extra instruction, missing instruction, bad command, extra command,
      missing command, bad order, extra order, missing order, bad request, extra request, missing request,
      bad demand, extra demand, missing demand, bad requirement, extra requirement, missing requirement,
      bad specification, extra specification, missing specification, bad description, extra description,
      missing description, bad definition, extra definition, missing definition, bad explanation, extra explanation,
      missing explanation, bad clarification, extra clarification, missing clarification, bad detail, extra detail,
      missing detail, bad information, extra information, missing information, bad data, extra data, missing data,
      bad content, extra content, missing content, bad material, extra material, missing material, bad substance,
      extra substance, missing substance, bad matter, extra matter, missing matter, bad stuff, extra stuff,
      missing stuff, bad things, extra things, missing things, bad objects, extra objects, missing objects,
      bad items, extra items, missing items, bad elements, extra elements, missing elements, bad components,
      extra components, missing components, bad parts, extra parts, missing parts, bad pieces, extra pieces,
      missing pieces, bad fragments, extra fragments, missing fragments, bad segments, extra segments,
      missing segments, bad sections, extra sections, missing sections, bad divisions, extra divisions,
      missing divisions, bad portions, extra portions, missing portions, bad shares, extra shares, missing shares,
      bad parts, extra parts, missing parts, bad pieces, extra pieces, missing pieces, bad fragments,
      extra fragments, missing fragments, bad segments, extra segments, missing segments, bad sections,
      extra sections, missing sections, bad divisions, extra divisions, missing divisions, bad portions,
      extra portions, missing portions, bad shares, extra shares, missing shares
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
      extra arms, extra legs, malformed hands, malformed feet, missing hands, missing feet, bad hands, bad feet,
      extra fingers, missing fingers, fused fingers, long neck, short neck, wide neck, thin neck, bad neck,
      extra neck, missing neck, bad shoulders, extra shoulders, missing shoulders, bad torso, extra torso,
      missing torso, bad waist, extra waist, missing waist, bad hips, extra hips, missing hips, bad legs,
      extra legs, missing legs, bad feet, extra feet, missing feet, bad toes, extra toes, missing toes,
      bad fingers, extra fingers, missing fingers, bad hands, extra hands, missing hands, bad arms, extra arms,
      missing arms, bad elbows, extra elbows, missing elbows, bad wrists, extra wrists, missing wrists,
      bad shoulders, extra shoulders, missing shoulders, bad neck, extra neck, missing neck, bad head,
      extra head, missing head, bad face, extra face, missing face, bad eyes, extra eyes, missing eyes,
      bad nose, extra nose, missing nose, bad mouth, extra mouth, missing mouth, bad ears, extra ears,
      missing ears, bad hair, extra hair, missing hair, bad eyebrows, extra eyebrows, missing eyebrows,
      bad eyelashes, extra eyelashes, missing eyelashes, bad teeth, extra teeth, missing teeth, bad tongue,
      extra tongue, missing tongue, bad chin, extra chin, missing chin, bad cheeks, extra cheeks, missing cheeks,
      bad forehead, extra forehead, missing forehead, bad jaw, extra jaw, missing jaw, bad lips, extra lips,
      missing lips, bad skin, extra skin, missing skin, bad clothing, extra clothing, missing clothing,
      bad accessories, extra accessories, missing accessories, bad background, extra background, missing background,
      bad lighting, extra lighting, missing lighting, bad shadows, extra shadows, missing shadows, bad reflections,
      extra reflections, missing reflections, bad colors, extra colors, missing colors, bad textures, extra textures,
      missing textures, bad materials, extra materials, missing materials, bad surfaces, extra surfaces, missing surfaces,
      bad edges, extra edges, missing edges, bad lines, extra lines, missing lines, bad shapes, extra shapes,
      missing shapes, bad forms, extra forms, missing forms, bad volumes, extra volumes, missing volumes, bad spaces,
      extra spaces, missing spaces, bad compositions, extra compositions, missing compositions, bad perspectives,
      extra perspectives, missing perspectives, bad angles, extra angles, missing angles, bad viewpoints,
      extra viewpoints, missing viewpoints, bad framing, extra framing, missing framing, bad cropping,
      extra cropping, missing cropping, bad scaling, extra scaling, missing scaling, bad rotation, extra rotation,
      missing rotation, bad translation, extra translation, missing translation, bad transformation, extra transformation,
      missing transformation, bad deformation, extra deformation, missing deformation, bad distortion, extra distortion,
      missing distortion, bad aberration, extra aberration, missing aberration, bad artifacts, extra artifacts,
      missing artifacts, bad noise, extra noise, missing noise, bad grain, extra grain, missing grain, bad compression,
      extra compression, missing compression, bad encoding, extra encoding, missing encoding, bad decoding,
      extra decoding, missing decoding, bad processing, extra processing, missing processing, bad filtering,
      extra filtering, missing filtering, bad enhancement, extra enhancement, missing enhancement, bad optimization,
      extra optimization, missing optimization, bad correction, extra correction, missing correction, bad adjustment,
      extra adjustment, missing adjustment, bad modification, extra modification, missing modification, bad alteration,
      extra alteration, missing alteration, bad change, extra change, missing change, bad variation, extra variation,
      missing variation, bad diversity, extra diversity, missing diversity, bad uniqueness, extra uniqueness,
      missing uniqueness, bad originality, extra originality, missing originality, bad creativity, extra creativity,
      missing creativity, bad innovation, extra innovation, missing innovation, bad invention, extra invention,
      missing invention, bad discovery, extra discovery, missing discovery, bad exploration, extra exploration,
      missing exploration, bad experimentation, extra experimentation, missing experimentation, bad testing,
      extra testing, missing testing, bad validation, extra validation, missing validation, bad verification,
      extra verification, missing verification, bad confirmation, extra confirmation, missing confirmation,
      bad approval, extra approval, missing approval, bad acceptance, extra acceptance, missing acceptance,
      bad endorsement, extra endorsement, missing endorsement, bad recommendation, extra recommendation,
      missing recommendation, bad suggestion, extra suggestion, missing suggestion, bad advice, extra advice,
      missing advice, bad guidance, extra guidance, missing guidance, bad direction, extra direction,
      missing direction, bad instruction, extra instruction, missing instruction, bad command, extra command,
      missing command, bad order, extra order, missing order, bad request, extra request, missing request,
      bad demand, extra demand, missing demand, bad requirement, extra requirement, missing requirement,
      bad specification, extra specification, missing specification, bad description, extra description,
      missing description, bad definition, extra definition, missing definition, bad explanation, extra explanation,
      missing explanation, bad clarification, extra clarification, missing clarification, bad detail, extra detail,
      missing detail, bad information, extra information, missing information, bad data, extra data, missing data,
      bad content, extra content, missing content, bad material, extra material, missing material, bad substance,
      extra substance, missing substance, bad matter, extra matter, missing matter, bad stuff, extra stuff,
      missing stuff, bad things, extra things, missing things, bad objects, extra objects, missing objects,
      bad items, extra items, missing items, bad elements, extra elements, missing elements, bad components,
      extra components, missing components, bad parts, extra parts, missing parts, bad pieces, extra pieces,
      missing pieces, bad fragments, extra fragments, missing fragments, bad segments, extra segments,
      missing segments, bad sections, extra sections, missing sections, bad divisions, extra divisions,
      missing divisions, bad portions, extra portions, missing portions, bad shares, extra shares, missing shares,
      bad parts, extra parts, missing parts, bad pieces, extra pieces, missing pieces, bad fragments,
      extra fragments, missing fragments, bad segments, extra segments, missing segments, bad sections,
      extra sections, missing sections, bad divisions, extra divisions, missing divisions, bad portions,
      extra portions, missing portions, bad shares, extra shares, missing shares
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
      extra arms, extra legs, malformed hands, malformed feet, missing hands, missing feet, bad hands, bad feet,
      extra fingers, missing fingers, fused fingers, long neck, short neck, wide neck, thin neck, bad neck,
      extra neck, missing neck, bad shoulders, extra shoulders, missing shoulders, bad torso, extra torso,
      missing torso, bad waist, extra waist, missing waist, bad hips, extra hips, missing hips, bad legs,
      extra legs, missing legs, bad feet, extra feet, missing feet, bad toes, extra toes, missing toes,
      bad fingers, extra fingers, missing fingers, bad hands, extra hands, missing hands, bad arms, extra arms,
      missing arms, bad elbows, extra elbows, missing elbows, bad wrists, extra wrists, missing wrists,
      bad shoulders, extra shoulders, missing shoulders, bad neck, extra neck, missing neck, bad head,
      extra head, missing head, bad face, extra face, missing face, bad eyes, extra eyes, missing eyes,
      bad nose, extra nose, missing nose, bad mouth, extra mouth, missing mouth, bad ears, extra ears,
      missing ears, bad hair, extra hair, missing hair, bad eyebrows, extra eyebrows, missing eyebrows,
      bad eyelashes, extra eyelashes, missing eyelashes, bad teeth, extra teeth, missing teeth, bad tongue,
      extra tongue, missing tongue, bad chin, extra chin, missing chin, bad cheeks, extra cheeks, missing cheeks,
      bad forehead, extra forehead, missing forehead, bad jaw, extra jaw, missing jaw, bad lips, extra lips,
      missing lips, bad skin, extra skin, missing skin, bad clothing, extra clothing, missing clothing,
      bad accessories, extra accessories, missing accessories, bad background, extra background, missing background,
      bad lighting, extra lighting, missing lighting, bad shadows, extra shadows, missing shadows, bad reflections,
      extra reflections, missing reflections, bad colors, extra colors, missing colors, bad textures, extra textures,
      missing textures, bad materials, extra materials, missing materials, bad surfaces, extra surfaces, missing surfaces,
      bad edges, extra edges, missing edges, bad lines, extra lines, missing lines, bad shapes, extra shapes,
      missing shapes, bad forms, extra forms, missing forms, bad volumes, extra volumes, missing volumes, bad spaces,
      extra spaces, missing spaces, bad compositions, extra compositions, missing compositions, bad perspectives,
      extra perspectives, missing perspectives, bad angles, extra angles, missing angles, bad viewpoints,
      extra viewpoints, missing viewpoints, bad framing, extra framing, missing framing, bad cropping,
      extra cropping, missing cropping, bad scaling, extra scaling, missing scaling, bad rotation, extra rotation,
      missing rotation, bad translation, extra translation, missing translation, bad transformation, extra transformation,
      missing transformation, bad deformation, extra deformation, missing deformation, bad distortion, extra distortion,
      missing distortion, bad aberration, extra aberration, missing aberration, bad artifacts, extra artifacts,
      missing artifacts, bad noise, extra noise, missing noise, bad grain, extra grain, missing grain, bad compression,
      extra compression, missing compression, bad encoding, extra encoding, missing encoding, bad decoding,
      extra decoding, missing decoding, bad processing, extra processing, missing processing, bad filtering,
      extra filtering, missing filtering, bad enhancement, extra enhancement, missing enhancement, bad optimization,
      extra optimization, missing optimization, bad correction, extra correction, missing correction, bad adjustment,
      extra adjustment, missing adjustment, bad modification, extra modification, missing modification, bad alteration,
      extra alteration, missing alteration, bad change, extra change, missing change, bad variation, extra variation,
      missing variation, bad diversity, extra diversity, missing diversity, bad uniqueness, extra uniqueness,
      missing uniqueness, bad originality, extra originality, missing originality, bad creativity, extra creativity,
      missing creativity, bad innovation, extra innovation, missing innovation, bad invention, extra invention,
      missing invention, bad discovery, extra discovery, missing discovery, bad exploration, extra exploration,
      missing exploration, bad experimentation, extra experimentation, missing experimentation, bad testing,
      extra testing, missing testing, bad validation, extra validation, missing validation, bad verification,
      extra verification, missing verification, bad confirmation, extra confirmation, missing confirmation,
      bad approval, extra approval, missing approval, bad acceptance, extra acceptance, missing acceptance,
      bad endorsement, extra endorsement, missing endorsement, bad recommendation, extra recommendation,
      missing recommendation, bad suggestion, extra suggestion, missing suggestion, bad advice, extra advice,
      missing advice, bad guidance, extra guidance, missing guidance, bad direction, extra direction,
      missing direction, bad instruction, extra instruction, missing instruction, bad command, extra command,
      missing command, bad order, extra order, missing order, bad request, extra request, missing request,
      bad demand, extra demand, missing demand, bad requirement, extra requirement, missing requirement,
      bad specification, extra specification, missing specification, bad description, extra description,
      missing description, bad definition, extra definition, missing definition, bad explanation, extra explanation,
      missing explanation, bad clarification, extra clarification, missing clarification, bad detail, extra detail,
      missing detail, bad information, extra information, missing information, bad data, extra data, missing data,
      bad content, extra content, missing content, bad material, extra material, missing material, bad substance,
      extra substance, missing substance, bad matter, extra matter, missing matter, bad stuff, extra stuff,
      missing stuff, bad things, extra things, missing things, bad objects, extra objects, missing objects,
      bad items, extra items, missing items, bad elements, extra elements, missing elements, bad components,
      extra components, missing components, bad parts, extra parts, missing parts, bad pieces, extra pieces,
      missing pieces, bad fragments, extra fragments, missing fragments, bad segments, extra segments,
      missing segments, bad sections, extra sections, missing sections, bad divisions, extra divisions,
      missing divisions, bad portions, extra portions, missing portions, bad shares, extra shares, missing shares,
      bad parts, extra parts, missing parts, bad pieces, extra pieces, missing pieces, bad fragments,
      extra fragments, missing fragments, bad segments, extra segments, missing segments, bad sections,
      extra sections, missing sections, bad divisions, extra divisions, missing divisions, bad portions,
      extra portions, missing portions, bad shares, extra shares, missing shares
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
  },
};
