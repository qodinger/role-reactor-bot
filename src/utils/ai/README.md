# AI Utilities

This directory contains reusable AI services for various AI-powered features in the Role Reactor Bot.

## Architecture

The AI utilities are designed with a modular, reusable architecture:

- **`aiService.js`** - Core AI service with generic methods for any AI task
- **`avatarService.js`** - Specialized service for AI avatar generation
- **`textService.js`** - Specialized service for AI text generation
- **`index.js`** - Central export file for easy imports

## Core AI Service

The `AIService` class provides the foundation for all AI operations:

```javascript
import { aiService } from "./utils/ai/aiService.js";

// Generate any type of AI content
const result = await aiService.generate({
  model: "google/gemini-2.5-flash",
  prompt: "Your prompt here",
  type: "text", // or "image"
  config: {
    /* additional options */
  },
});

// Or use convenience methods
const image = await aiService.generateImage("A beautiful landscape");
const text = await aiService.generateText("Explain quantum computing");
```

## Specialized Services

### Avatar Service

For AI-generated anime avatars:

```javascript
import { generateAvatar } from "./utils/ai/avatarService.js";

const avatar = await generateAvatar(
  "A cute anime girl with blue hair",
  "modern", // style
  "happy", // mood
);
```

### Text Service

For AI-generated text content:

```javascript
import {
  generateCreativeWriting,
  generateCodeExplanation,
} from "./utils/ai/textService.js";

// Creative writing
const story = await generateCreativeWriting(
  "A story about a robot learning to love",
  "creative", // style
  500, // target length
);

// Code explanation
const explanation = await generateCodeExplanation(
  "function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }",
  "javascript",
);
```

## Available Models

The AI service supports various models through OpenRouter:

### Image Generation

- `google/gemini-2.5-flash-image-preview` (Recommended)
- `stability-ai/stable-diffusion-xl-base-1.0`
- `google/imagen-3`

### Text Generation

- `google/gemini-2.5-flash` (Recommended)
- `openai/gpt-4o`
- `anthropic/claude-3.5-sonnet`

## Rate Limiting

All AI services include built-in rate limiting:

- **5 requests per hour per user**
- Automatic cleanup of old rate limit data
- Configurable limits via environment variables

## Error Handling

Comprehensive error handling for common scenarios:

- API key not configured
- Payment required (402)
- Rate limit exceeded (429)
- Invalid API key (401)
- Network errors
- Invalid responses

## Usage Examples

### Creating a New AI Feature

1. **Create a specialized service:**

```javascript
// src/utils/ai/myFeatureService.js
import { aiService } from "./aiService.js";

export class MyFeatureService {
  constructor() {
    this.aiService = aiService;
  }

  async generateMyContent(prompt, options = {}) {
    return await this.aiService.generate({
      model: "google/gemini-2.5-flash",
      prompt: this.enhancePrompt(prompt, options),
      type: "text",
      config: options,
    });
  }

  enhancePrompt(prompt, options) {
    // Add your specialized prompt enhancement logic
    return `Enhanced: ${prompt}`;
  }
}

export const myFeatureService = new MyFeatureService();
```

2. **Use in your command:**

```javascript
// src/commands/general/my-feature/handlers.js
import { myFeatureService } from "../../../utils/ai/myFeatureService.js";

export async function execute(interaction) {
  const result = await myFeatureService.generateMyContent(
    interaction.options.getString("prompt"),
  );

  // Handle the result...
}
```

### Adding New Models

To add support for new models, update the `getAvailableModels()` method in `aiService.js`:

```javascript
getAvailableModels() {
  return {
    image: [
      "google/gemini-2.5-flash-image-preview",
      "your-new-image-model",
    ],
    text: [
      "google/gemini-2.5-flash",
      "your-new-text-model",
    ],
  };
}
```

## Environment Variables

Required environment variables:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
BOT_NAME=Role Reactor Bot
BOT_WEBSITE_URL=https://github.com/rolereactor
```

## Future Enhancements

The AI utilities are designed to be easily extensible:

- **New AI providers** - Add support for other AI APIs
- **New content types** - Add video, audio, or other media generation
- **Advanced features** - Add conversation memory, context awareness, etc.
- **Caching** - Add intelligent caching for repeated requests
- **Analytics** - Add usage tracking and analytics

## Best Practices

1. **Always use specialized services** for specific features rather than the core AI service directly
2. **Implement proper error handling** in your command handlers
3. **Use rate limiting** to prevent abuse
4. **Enhance prompts** with domain-specific knowledge
5. **Test with different models** to find the best fit for your use case
6. **Monitor costs** and usage patterns
7. **Keep prompts concise** but descriptive for better results
