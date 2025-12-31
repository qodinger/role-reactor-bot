# AI Utilities

This directory contains reusable AI services for various AI-powered features in the Role Reactor Bot.

## Architecture

The AI utilities are designed with a modular, reusable architecture:

### Core Services

- **`multiProviderAIService.js`** - Multi-provider AI service supporting OpenRouter, OpenAI, Stability AI, and self-hosted providers with enabled/disabled provider configuration
- **`chatService.js`** - AI-powered chat service for conversational interactions with bot and server context awareness
- **`avatarService.js`** - Specialized service for AI avatar generation
- **`concurrencyManager.js`** - Request concurrency management and rate limiting

### Supporting Modules

- **`conversationManager.js`** - Manages conversation history and long-term memory (MongoDB)
- **`responseValidator.js`** - Validates and sanitizes AI responses for data accuracy and security
- **`systemPromptBuilder.js`** - Builds system prompts with server context, command information, and user-specific data
- **`commandDiscoverer.js`** - Discovers and formats bot commands for AI system prompts
- **`serverInfoGatherer.js`** - Gathers server and bot information for AI context
- **`commandExecutor.js`** - Executes bot commands programmatically from AI actions
- **`actionRegistry.js`** - Centralized registry for all AI actions with validation and metadata
- **`constants.js`** - Shared constants for all AI modules

### Chat Service Modules (`chat/`)

Focused modules for chat service functionality:

- **`actionHandler.js`** - Action processing, re-query logic, and non-fetch action handling
- **`responseGenerator.js`** - Response generation, processing, finalization, and queue status callbacks
- **`responseProcessor.js`** - Response parsing, validation, sanitization, and credit deduction
- **`preparationHelpers.js`** - System context preparation, member fetching, and action detection
- **`streamingHelpers.js`** - Streaming callbacks, generation, and response processing
- **`conversationBuilder.js`** - Message array building and conversation context preparation

### Memory Management (`memory/`)

Hierarchical memory system for long-term conversation context:

- **`memoryManager.js`** - Hierarchical memory management with summarization support
- **`summarizer.js`** - Conversation summarization for reducing token usage in long conversations
- **`summaryStorage.js`** - Summary storage (file or MongoDB) for persistent memory

### Extracted Modules (Internal)

- **`jsonParser.js`** - Parses JSON responses from AI, handling markdown code blocks
- **`dataFetcher.js`** - Fetches Discord data (members, roles, channels) for AI context
- **`actionExecutor.js`** - Validates and executes AI actions
- **`modelOptimizer.js`** - Provides optimized parameters (maxTokens, temperature) for different AI models
- **`commandExecutor/`** - Command discovery, validation, and mock interaction creation
- **`promptSections/`** - Modular prompt sections (identity, context, response format)
- **`providers/`** - Provider-specific implementations (OpenRouter, OpenAI, Stability, Self-hosted)

### Exports

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
  type: "text", // "text" for chat/completions, "image" for image generation
  prompt: "Your prompt here",
  config: {
    // Model-specific configuration
  },
  provider: null, // null = auto-select first enabled provider, or specify "openrouter", "openai", "stability", "selfhosted"
});
```

## Chat Service

The `ChatService` provides AI-powered conversational interactions with full server and bot context:

```javascript
import { chatService } from "./utils/ai/chatService.js";

// Generate AI response with server context
const response = await chatService.generateResponse(
  "Who are the moderators in this server?",
  guild, // Discord guild object
  client, // Discord client
  {
    userId: interaction.user.id,
    coreUserData: userData,
    user: interaction.user,
    channel: interaction.channel,
    locale: interaction.locale || "en-US",
  },
);

// Response includes:
// - text: The AI's response message
// - commandResponses: Array of command execution results (if any commands were executed)
```

**Features:**

- **Server Context Awareness**: AI knows about server members, roles, channels, and bot commands
- **Command Execution**: AI can execute bot commands on behalf of users
- **Action Execution**: AI can perform Discord actions (add roles, send messages, etc.)
- **Conversation History**: Maintains conversation context across multiple interactions
- **Long-term Memory**: Stores conversations in MongoDB for persistence
- **Data Validation**: Validates AI responses to ensure accuracy
- **Response Sanitization**: Removes sensitive data from responses

**Used By:**

- `/ask` command - Allows users to ask questions about the bot and server
- `messageCreate` event - Responds when the bot is mentioned in messages

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
    userId: "user-id",
    coreUserData: userData,
  },
);
```

## Available Models

The AI service supports both text generation and image generation through multiple providers:

### Text Generation Models

#### OpenRouter Models

- `openai/gpt-4o-mini` (Default - Cost-effective, high quality)
- `openai/gpt-3.5-turbo` (Faster, lower cost)
- `anthropic/claude-3-haiku` (Fast, efficient)
- `google/gemini-pro` (Google's advanced model)

#### Self-Hosted Models

- `llama3.2` (Default for self-hosted)
- Any model supported by your self-hosted API (Ollama, etc.)

#### OpenAI Models

- `gpt-3.5-turbo` (Standard)
- `gpt-4` (Higher quality, higher cost)

### Image Generation Models

#### OpenRouter Models

- `google/gemini-3-pro-image-preview` (Default - High quality)
- `google/gemini-2.5-flash-image-preview` (Faster, lower cost)
- `stability-ai/stable-diffusion-xl-base-1.0`
- `google/imagen-3`

#### OpenAI Models

- `dall-e-3` (High quality image generation)

#### Stability AI Models (Stable Diffusion 3.5)

- `sd3.5-flash` (Fastest, 2.5 credits) - Recommended for cost efficiency
- `sd3.5-medium` (Balanced, 3.5 credits) - Good quality/speed balance
- `sd3.5-large-turbo` (Quality + Speed, 4 credits) - High quality, fast
- `sd3.5-large` (Highest quality, 6.5 credits) - Best quality results

## Module Organization

### Conversation Management

The `conversationManager` handles conversation history and long-term memory:

```javascript
import { conversationManager } from "./utils/ai/conversationManager.js";

// Get conversation history (separated by server)
const guildId = guild?.id || null; // null for DMs
const history = await conversationManager.getConversationHistory(
  userId,
  guildId,
);

// Add message to history
await conversationManager.addToHistory(userId, guildId, {
  role: "user",
  content: "Hello!",
});

// Clear conversation history for a specific server
await conversationManager.clearHistory(userId, guildId);

// Note: Conversations are now separated by user AND server
// - Server conversations: userId_guildId
// - DM conversations: dm_userId
// This prevents context leakage between different Discord servers
```

### Response Validation

The `responseValidator` ensures AI responses are accurate and safe:

```javascript
import { responseValidator } from "./utils/ai/responseValidator.js";

// Validate response data
const validation = responseValidator.validateResponseData(response, guild);
if (!validation.valid) {
  // Handle validation warnings
}

// Sanitize sensitive data
const sanitized = responseValidator.sanitizeData(response);
```

### System Prompt Building

The `systemPromptBuilder` creates comprehensive system prompts:

```javascript
import { systemPromptBuilder } from "./utils/ai/systemPromptBuilder.js";

// Build system context with server information
const systemMessage = await systemPromptBuilder.buildSystemContext(
  guild,
  client,
  userMessage,
  "en-US", // locale
);
```

### Command Discovery

The `commandDiscoverer` provides command information for AI:

```javascript
import { commandDiscoverer } from "./utils/ai/commandDiscoverer.js";

// Get all bot commands
const commands = commandDiscoverer.getBotCommands(client);

// Detect mentioned commands in user message
const mentioned = commandDiscoverer.detectMentionedCommands(
  "How do I use the /avatar command?",
  commands,
);
```

### Server Info Gathering

The `serverInfoGatherer` collects server and bot information:

```javascript
import { serverInfoGatherer } from "./utils/ai/serverInfoGatherer.js";

// Get server information
const serverInfo = await serverInfoGatherer.getServerInfo(guild, client);

// Get bot information
const botInfo = serverInfoGatherer.getBotInfo(client);
```

## Concurrency Management

All AI services include built-in concurrency management:

- **Maximum 3 concurrent requests per user**
- Automatic request queuing
- Prevents API rate limit issues
- Configurable limits via concurrency manager
- Priority queuing for users with Core credits

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
- Response validation failures
- Data accuracy issues

## Usage Examples

### Using Chat Service

```javascript
import { chatService } from "./utils/ai/chatService.js";

export async function execute(interaction) {
  const question = interaction.options.getString("question");

  try {
    const response = await chatService.generateResponse(
      question,
      interaction.guild,
      interaction.client,
      {
        userId: interaction.user.id,
        coreUserData: userData,
        user: interaction.user,
        channel: interaction.channel,
        locale: interaction.locale || "en-US",
      },
    );

    await interaction.reply({ content: response.text });
  } catch (error) {
    await interaction.reply({
      content: "Sorry, I couldn't process your request.",
      ephemeral: true,
    });
  }
}
```

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
      type: "image", // or "text"
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
      text: {
        primary: "openai/gpt-4o-mini",
        // Add new text models here
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
      text: {
        primary: "gpt-3.5-turbo",
        // Add new text models here
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

# Self-Hosted Configuration (Optional)
SELF_HOSTED_API_URL=http://127.0.0.1:11434
SELF_HOSTED_API_KEY=your_api_key
SELF_HOSTED_TEXT_MODEL=llama3.2

# Conversation Management (Optional)
AI_USE_LONG_TERM_MEMORY=true
AI_CONVERSATION_HISTORY_LENGTH=20
AI_CONVERSATION_TIMEOUT=604800000
AI_MAX_CONVERSATIONS=1000

# Bot Information
BOT_NAME=Role Reactor Bot
BOT_WEBSITE_URL=https://rolereactor.app
```

## Provider Configuration

Provider selection is configured in `src/config/config.js` using the `enabled` flag:

- Set `enabled: true` to enable a provider
- Set `enabled: false` to disable a provider
- Providers are checked in order (as they appear in config)
- The first enabled provider is used automatically
- If a provider is disabled, the system automatically falls back to the next enabled provider
- **If all providers are disabled, AI features are completely disabled** - commands like `/avatar`, `/ask`, and `/imagine` will show an error message

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
  selfhosted: {
    enabled: false, // Disabled by default
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
  selfhosted: {
    enabled: false,
    // ... config
  },
}
```

When all providers are disabled, AI commands will return user-friendly error messages indicating that AI features are disabled.

## Module Responsibilities

### chatService.js

- Main orchestrator for AI chat interactions
- Integrates all supporting modules
- Handles response generation and action execution
- Manages conversation flow
- Core logic organized in `chat/` subdirectory modules

### conversationManager.js

- Conversation history management
- Long-term memory (MongoDB) integration
- Conversation cleanup and expiration
- History retrieval and storage
- **Server isolation**: Conversations are separated by user AND server (composite key: `userId_guildId`)
- **DM support**: Direct messages use `dm_userId` format
- **Backward compatibility**: Automatically handles legacy `userId`-only format

### Memory Management (`memory/`)

- **`memoryManager.js`** - Hierarchical memory system that combines recent messages with summarized older conversations
- **`summarizer.js`** - Creates concise summaries of conversation history to reduce token usage
- **`summaryStorage.js`** - Persistent storage for conversation summaries (file or MongoDB)

### responseValidator.js

- Validates AI responses for data accuracy
- Checks for placeholder usage
- Sanitizes sensitive data
- Ensures response quality

### systemPromptBuilder.js

- Builds comprehensive system prompts
- Includes server context and bot information
- Formats command and action information
- Manages system message caching

### commandDiscoverer.js

- Discovers and formats bot commands
- Detects mentioned commands in user messages
- Provides command details for AI context
- Formats command options and subcommands

### serverInfoGatherer.js

- Gathers server information (members, roles, channels)
- Collects bot information
- Formats data for AI consumption
- Handles member fetching and caching

### commandExecutor.js

- Executes bot commands programmatically
- Handles command validation
- Manages command responses
- Provides command discovery utilities

### constants.js

- Shared constants for all AI modules
- Conversation management constants
- Member fetching constants
- Response length constants
- JSON parsing patterns

## Future Enhancements

The AI utilities are designed to be easily extensible:

- **New AI providers** - Add support for other AI APIs (Anthropic, Cohere, etc.)
- **New content types** - Add video, audio, or other media generation
- **Advanced features** - Enhanced conversation memory, context awareness, etc.
- **Analytics** - Add usage tracking and analytics
- **Provider fallback** - Automatic fallback to next enabled provider on failure (✅ Already implemented)
- **Response streaming** - Stream responses for better user experience (✅ Already implemented)

## Best Practices

1. **Always use specialized services** for specific features rather than the core AI service directly
2. **Implement proper error handling** in your command handlers
3. **Use rate limiting** to prevent abuse
4. **Enhance prompts** with domain-specific knowledge
5. **Test with different models** to find the best fit for your use case
6. **Monitor costs** and usage patterns
7. **Keep prompts concise** but descriptive for better results
8. **Use conversation history** for context-aware responses
9. **Validate AI responses** to ensure data accuracy
10. **Sanitize sensitive data** before displaying to users
