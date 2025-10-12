# AI Utilities

This directory contains reusable AI services for various AI-powered features in the Role Reactor Bot.

## Architecture

The AI utilities are designed with a modular, reusable architecture:

- **`multiProviderAIService.js`** - Multi-provider AI service supporting OpenRouter and OpenAI
- **`avatarService.js`** - Specialized service for AI avatar generation
- **`concurrencyManager.js`** - Request concurrency management
- **`index.js`** - Central export file for easy imports

## Multi-Provider AI Service

The `MultiProviderAIService` class provides the foundation for all AI operations:

```javascript
import { multiProviderAIService } from "./utils/ai/multiProviderAIService.js";

// Generate AI content using the configured provider
const result = await multiProviderAIService.generate({
  type: "image", // Only image generation is supported
  prompt: "Your prompt here",
  config: {
    size: "1024x1024",
    quality: "standard",
  },
});
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

### Concurrency Manager

For managing AI request concurrency and preventing rate limit issues:

```javascript
import { concurrencyManager } from "./utils/ai/concurrencyManager.js";

// Queue a request with concurrency control
const result = await concurrencyManager.queueRequest(
  "unique-request-id",
  async () => {
    // Your AI generation logic here
    return await multiProviderAIService.generate(options);
  },
  {
    /* request metadata */
  },
);
```

## Available Models

The AI service supports image generation through multiple providers:

### OpenRouter Models

- `google/gemini-2.5-flash-image-preview` (Recommended)
- `stability-ai/stable-diffusion-xl-base-1.0`
- `google/imagen-3`

### OpenAI Models

- `dall-e-3` (High quality image generation)

## Concurrency Management

All AI services include built-in concurrency management:

- **Maximum 3 concurrent requests per user**
- Automatic request queuing
- Prevents API rate limit issues
- Configurable limits via concurrency manager

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
import { multiProviderAIService } from "./multiProviderAIService.js";

export class MyFeatureService {
  constructor() {
    this.aiService = multiProviderAIService;
  }

  async generateMyContent(prompt, options = {}) {
    return await this.aiService.generate({
      type: "image",
      prompt: this.enhancePrompt(prompt, options),
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

To add support for new models, update the configuration in `config.js`:

```javascript
// In config.js aiModels getter
providers: {
  openrouter: {
    models: {
      image: {
        primary: "google/gemini-2.5-flash-image-preview",
        // Add new models here
      },
    },
  },
  openai: {
    models: {
      image: {
        primary: "dall-e-3",
        // Add new models here
      },
    },
  },
}
```

## Environment Variables

Required environment variables:

```env
# AI Provider Selection
AI_PRIMARY_PROVIDER=openrouter  # or "openai"

# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_api_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Bot Information
BOT_NAME=Role Reactor Bot
BOT_WEBSITE_URL=https://github.com/rolereactor
```

## Future Enhancements

The AI utilities are designed to be easily extensible:

- **New AI providers** - Add support for other AI APIs (Anthropic, Cohere, etc.)
- **New content types** - Add video, audio, or other media generation
- **Advanced features** - Add conversation memory, context awareness, etc.
- **Enhanced caching** - Add intelligent caching for repeated requests
- **Analytics** - Add usage tracking and analytics
- **Text generation** - Re-add text generation capabilities if needed

## Best Practices

1. **Always use specialized services** for specific features rather than the core AI service directly
2. **Implement proper error handling** in your command handlers
3. **Use rate limiting** to prevent abuse
4. **Enhance prompts** with domain-specific knowledge
5. **Test with different models** to find the best fit for your use case
6. **Monitor costs** and usage patterns
7. **Keep prompts concise** but descriptive for better results
