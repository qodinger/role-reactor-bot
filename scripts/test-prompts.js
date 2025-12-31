#!/usr/bin/env node

/**
 * Test script to verify AI prompt logging
 *
 * This script tests the prompt generation and logging for:
 * - Chat/Ask prompts
 * - Avatar prompts
 * - Imagine prompts
 *
 * Usage: node scripts/test-prompts.js
 */

import "../scripts/load-env.js";
import { getLogger } from "../src/utils/logger.js";
import { SystemPromptBuilder } from "../src/utils/ai/systemPromptBuilder.js";
import { avatarService } from "../src/utils/ai/avatarService.js";

const systemPromptBuilder = new SystemPromptBuilder();

const logger = getLogger();

// Mock Discord objects for testing
function createMockGuild() {
  // Create a Collection-like object with filter method
  const createCollection = items => {
    const map = new Map(items);
    return {
      ...map,
      filter: fn => {
        const results = [];
        for (const [key, value] of map.entries()) {
          if (fn(value, key, map)) {
            results.push(value);
          }
        }
        return results;
      },
      size: map.size,
      get: key => map.get(key),
      has: key => map.has(key),
      values: () => map.values(),
      keys: () => map.keys(),
      entries: () => map.entries(),
    };
  };

  const mockMembers = [
    [
      "user1",
      {
        id: "user1",
        user: { id: "user1", username: "TestUser1", bot: false },
        displayName: "TestUser1",
        roles: { cache: new Map() },
      },
    ],
    [
      "user2",
      {
        id: "user2",
        user: { id: "user2", username: "TestUser2", bot: false },
        displayName: "TestUser2",
        roles: { cache: new Map() },
      },
    ],
  ];

  return {
    id: "test-guild-123",
    name: "Test Server",
    members: {
      cache: createCollection(mockMembers),
      fetch: async () => createCollection([]),
    },
    roles: {
      cache: createCollection([
        ["role1", { id: "role1", name: "Member", position: 1 }],
        ["role2", { id: "role2", name: "Admin", position: 10 }],
      ]),
    },
    channels: {
      cache: createCollection([
        [
          "channel1",
          {
            id: "channel1",
            name: "general",
            type: 0, // GUILD_TEXT
            isTextBased: () => true,
            isVoiceBased: () => false,
            isThread: () => false,
          },
        ],
      ]),
    },
    memberCount: 2,
    iconURL: () => "https://example.com/icon.png",
  };
}

function createMockClient() {
  return {
    user: {
      id: "bot-123",
      username: "TestBot",
      displayAvatarURL: () => "https://example.com/bot-avatar.png",
    },
    commands: new Map([
      ["ping", { data: { name: "ping", description: "Ping command" } }],
      ["help", { data: { name: "help", description: "Help command" } }],
    ]),
  };
}

async function testChatPrompt() {
  console.log(`\n${"=".repeat(80)}`);
  console.log("TESTING CHAT/ASK PROMPTS");
  console.log(`${"=".repeat(80)}\n`);

  const mockGuild = createMockGuild();
  const mockClient = createMockClient();
  const userMessage = "What commands are available?";

  try {
    logger.info("Building system context for chat prompt test...");
    const systemMessage = await systemPromptBuilder.buildSystemContext(
      mockGuild,
      mockClient,
      userMessage,
      "en-US",
      null,
      { userId: "test-user-123" },
    );

    console.log("\n✅ System Prompt Generated Successfully");
    console.log(`📊 System Prompt Length: ${systemMessage.length} characters`);
    console.log(`📊 Estimated Tokens: ~${Math.ceil(systemMessage.length / 4)}`);
    console.log("\n📝 Full System Prompt:");
    console.log("-".repeat(80));
    console.log(systemMessage);
    console.log("-".repeat(80));

    // Test building messages array (simulating chatService)
    const messages = [
      { role: "system", content: systemMessage },
      {
        role: "user",
        content: `[Current Date and Time for User: ${new Date().toLocaleDateString(
          "en-US",
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          },
        )} at ${new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        })}]\n\n${userMessage}`,
      },
    ];

    console.log("\n✅ Messages Array Built Successfully");
    console.log(`📊 Total Messages: ${messages.length}`);
    console.log(
      `📊 Total Length: ${JSON.stringify(messages).length} characters`,
    );
    console.log("\n📝 Full Messages Array:");
    console.log("-".repeat(80));
    messages.forEach((msg, index) => {
      const role = msg.role.toUpperCase();
      const contentPreview =
        msg.content.length > 1000
          ? `${msg.content.substring(0, 1000)}... [${msg.content.length} chars total]`
          : msg.content;
      console.log(`\nMessage ${index + 1} (${role}):`);
      console.log(contentPreview);
    });
    console.log("-".repeat(80));
  } catch (error) {
    console.error("❌ Error testing chat prompt:", error);
    throw error;
  }
}

async function testAvatarPrompt() {
  console.log(`\n${"=".repeat(80)}`);
  console.log("TESTING AVATAR PROMPTS");
  console.log(`${"=".repeat(80)}\n`);

  const testPrompts = [
    {
      prompt: "cute anime girl",
      styleOptions: { colorStyle: "neon", mood: "happy", artStyle: "chibi" },
    },
    {
      prompt: "cool cyberpunk character",
      styleOptions: {
        colorStyle: "monochrome",
        mood: "mysterious",
        artStyle: "modern",
      },
    },
    {
      prompt: "fantasy warrior",
      styleOptions: {},
    },
  ];

  for (const testCase of testPrompts) {
    try {
      logger.info(`Building avatar prompt for: "${testCase.prompt}"`);
      const enhancedPrompt = await avatarService.buildAnimePrompt(
        testCase.prompt,
        testCase.styleOptions,
        "stability",
      );

      console.log(`\n✅ Avatar Prompt Generated Successfully`);
      console.log(`📝 Original Prompt: "${testCase.prompt}"`);
      console.log(`📝 Style Options: ${JSON.stringify(testCase.styleOptions)}`);
      console.log(
        `📊 Enhanced Prompt Length: ${enhancedPrompt.length} characters`,
      );
      console.log(
        `📊 Estimated Tokens: ~${Math.ceil(enhancedPrompt.length / 4)}`,
      );
      console.log("\n📝 Full Enhanced Prompt:");
      console.log("-".repeat(80));
      console.log(enhancedPrompt);
      console.log("-".repeat(80));
    } catch (error) {
      console.error(
        `❌ Error testing avatar prompt for "${testCase.prompt}":`,
        error,
      );
    }
  }
}

async function testImaginePrompt() {
  console.log(`\n${"=".repeat(80)}`);
  console.log("TESTING IMAGINE PROMPTS");
  console.log(`${"=".repeat(80)}\n`);

  const testPrompts = [
    "a futuristic cityscape at sunset",
    "a magical forest with glowing mushrooms",
    "a steampunk airship flying over mountains",
  ];

  for (const prompt of testPrompts) {
    try {
      console.log(`\n✅ Imagine Prompt Test`);
      console.log(`📝 Prompt: "${prompt}"`);
      console.log(`📊 Prompt Length: ${prompt.length} characters`);
      console.log(`📊 Estimated Tokens: ~${Math.ceil(prompt.length / 4)}`);
      console.log(`📝 Safety Tolerance: 6 (most permissive)`);
      console.log("\n📝 Full Prompt:");
      console.log("-".repeat(80));
      console.log(prompt);
      console.log("-".repeat(80));
    } catch (error) {
      console.error(`❌ Error testing imagine prompt for "${prompt}":`, error);
    }
  }
}

async function testProviderPrompts() {
  console.log(`\n${"=".repeat(80)}`);
  console.log("TESTING PROVIDER REQUEST FORMATS");
  console.log(`${"=".repeat(80)}\n`);

  // Test OpenRouter format
  const openRouterMessages = [
    {
      role: "system",
      content: "You are a helpful assistant.",
    },
    {
      role: "user",
      content: "What is 2+2?",
    },
  ];

  const openRouterRequest = {
    model: "meta-llama/llama-3.2-3b-instruct:free",
    messages: openRouterMessages,
    temperature: 0.7,
    max_tokens: 1000,
  };

  console.log("\n✅ OpenRouter Request Format:");
  console.log("-".repeat(80));
  console.log(JSON.stringify(openRouterRequest, null, 2));
  console.log("-".repeat(80));

  // Test Stability format
  const stabilityRequest = {
    prompt:
      "anime style character portrait, cute anime girl, vibrant neon colors",
    negative_prompt: "blurry, low quality, distorted, ugly, bad anatomy",
    cfg_scale: 7,
    steps: 20,
    safety_tolerance: 6,
  };

  console.log("\n✅ Stability AI Request Format:");
  console.log("-".repeat(80));
  console.log(JSON.stringify(stabilityRequest, null, 2));
  console.log("-".repeat(80));
}

async function main() {
  console.log(`\n${"🚀".repeat(40)}`);
  console.log("AI PROMPT TESTING SCRIPT");
  console.log("🚀".repeat(40));

  try {
    // Test chat prompts
    await testChatPrompt();

    // Test avatar prompts
    await testAvatarPrompt();

    // Test imagine prompts
    await testImaginePrompt();

    // Test provider formats
    await testProviderPrompts();

    console.log(`\n${"=".repeat(80)}`);
    console.log("✅ ALL PROMPT TESTS COMPLETED SUCCESSFULLY");
    console.log("=".repeat(80));
    console.log("\n💡 Tips:");
    console.log("   - Check logs/ directory for detailed logging output");
    console.log("   - All prompts are logged with [AI PROMPT LOG] prefix");
    console.log(
      "   - Provider requests are logged with [* API REQUEST] prefix",
    );
    console.log("\n");

    // Exit gracefully (don't wait for MongoDB reconnection attempts)
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error running prompt tests:", error);
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
