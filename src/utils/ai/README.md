# AI Utilities

This directory contains reusable AI services for various AI-powered features in the Role Reactor Bot.

## Architecture

The AI utilities are designed with a modular, reusable architecture:

- **`multiProviderAIService.js`** - Multi-provider AI service supporting OpenRouter, OpenAI, and Stability AI with enabled/disabled provider configuration
- **`avatarService.js`** - Specialized service for AI avatar generation
- **`concurrencyManager.js`** - Request concurrency management
- **`index.js`** - Central export file for easy imports

**Provider Management:**

- Providers are configured in `src/config/config.js` with `enabled: true/false` flags
- Providers are checked in priority order (as they appear in config)
- First enabled provider is used automatically
- If all providers are disabled, AI features are completely disabled

## Multi-Provider AI Service

The `MultiProviderAIService` class provides the foundation for all AI operations:

```javascript
import { multiProviderAIService } from "./utils/ai/multiProviderAIService.js";

// Check if AI features are enabled
if (!multiProviderAIService.isEnabled()) {
  // Handle disabled AI features
  return;
}

// Get the primary (first enabled) provider
const primaryProvider = multiProviderAIService.getPrimaryProvider();

// Generate AI content using the configured provider
// Automatically uses the first enabled provider, or a specific provider if specified
const result = await multiProviderAIService.generate({
  type: "image", // Only image generation is supported
  prompt: "Your prompt here",
  config: {
    size: "1024x1024",
    quality: "standard",
  },
  provider: null, // null = auto-select first enabled provider, or specify "openrouter", "openai", "stability"
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

- `google/gemini-3-pro-image-preview` (Default - High quality)
- `google/gemini-2.5-flash-image-preview` (Faster, lower cost)
- `stability-ai/stable-diffusion-xl-base-1.0`
- `google/imagen-3`

### OpenAI Models

- `dall-e-3` (High quality image generation)

### Stability AI Models (Stable Diffusion 3.5)

- `sd3.5-flash` (Fastest, 2.5 credits) - Recommended for cost efficiency
- `sd3.5-medium` (Balanced, 3.5 credits) - Good quality/speed balance
- `sd3.5-large-turbo` (Quality + Speed, 4 credits) - High quality, fast
- `sd3.5-large` (Highest quality, 6.5 credits) - Best quality results

## Concurrency Management

All AI services include built-in concurrency management:

- **Maximum 3 concurrent requests per user**
- Automatic request queuing
- Prevents API rate limit issues
- Configurable limits via concurrency manager

## Error Handling

Comprehensive error handling for common scenarios:

- **AI features disabled** - All providers are disabled in config
- API key not configured
- Payment required (402)
- Rate limit exceeded (429)
- Invalid API key (401)
- Network errors
- Invalid responses
- Provider disabled - Attempted to use a provider that is disabled

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
    enabled: true, // Set to false to disable this provider
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: process.env.OPENROUTER_API_KEY,
    models: {
      image: {
        primary: "google/gemini-3-pro-image-preview",
        // Add new models here
      },
    },
  },
  openai: {
    enabled: false, // Set to true to enable this provider
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
    models: {
      image: {
        primary: "dall-e-3",
        // Add new models here
      },
    },
  },
}
```

**Important:** Remember to set `enabled: true` for the provider you want to use, and ensure the API key is configured in your `.env` file.

## Environment Variables

Required environment variables:

```env
# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_api_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Stability AI Configuration (Stable Diffusion 3.5)
STABILITY_API_KEY=your_stability_api_key

# Bot Information
BOT_NAME=Role Reactor Bot
BOT_WEBSITE_URL=https://github.com/rolereactor
```

## Provider Configuration

Provider selection is configured in `src/config/config.js` using the `enabled` flag:

- Set `enabled: true` to enable a provider
- Set `enabled: false` to disable a provider
- Providers are checked in order (as they appear in config)
- The first enabled provider is used automatically
- If a provider is disabled, the system automatically falls back to the next enabled provider
- **If all providers are disabled, AI features are completely disabled** - commands like `/avatar` and `/imagine` will show an error message

Example configuration:

```javascript
providers: {
  openrouter: {
    enabled: true,  // This will be used first
    // ... config
  },
  openai: {
    enabled: false, // Skipped if openrouter is enabled
    // ... config
  },
  stability: {
    enabled: true,  // Used as fallback if openrouter fails
    // ... config
  },
}
```

**Disabling AI Features:**

To completely disable AI features, set all providers to `enabled: false`:

```javascript
providers: {
  openrouter: {
    enabled: false,  // AI features disabled
    // ... config
  },
  openai: {
    enabled: false,
    // ... config
  },
  stability: {
    enabled: false,
    // ... config
  },
}
```

When all providers are disabled, AI commands will return user-friendly error messages indicating that AI features are disabled.

## Future Enhancements

The AI utilities are designed to be easily extensible:

- **New AI providers** - Add support for other AI APIs (Anthropic, Cohere, etc.)
- **New content types** - Add video, audio, or other media generation
- **Advanced features** - Add conversation memory, context awareness, etc.
- **Analytics** - Add usage tracking and analytics
- **Text generation** - Re-add text generation capabilities if needed
- **Provider fallback** - Automatic fallback to next enabled provider on failure

## Best Practices

1. **Always use specialized services** for specific features rather than the core AI service directly
2. **Implement proper error handling** in your command handlers
3. **Use rate limiting** to prevent abuse
4. **Enhance prompts** with domain-specific knowledge
5. **Test with different models** to find the best fit for your use case
6. **Monitor costs** and usage patterns
7. **Keep prompts concise** but descriptive for better results
