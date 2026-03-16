# Testing Documentation

This directory contains comprehensive tests for the Role Reactor Bot, covering unit tests, integration tests, and end-to-end workflows.

## 📁 Test Structure

```
tests/
├── README.md                 # This file
├── setup.js                  # Vitest setup and global mocks
├── unit/                     # Unit tests for individual modules
│   ├── commands/             # Command-specific tests
│   │   ├── admin/            # Admin command tests
│   │   │   ├── welcome.test.js
│   │   │   ├── goodbye.test.js
│   │   │   ├── moderation.test.js
│   │   │   ├── role-reactions.test.js
│   │   │   ├── temp-roles.test.js
│   │   │   ├── schedule-role.test.js
│   │   │   └── xp.test.js
│   │   ├── developer/        # Developer command tests
│   │   │   ├── core-management.test.js
│   │   │   ├── health.test.js
│   │   │   └── performance.test.js
│   │   └── general/          # General command tests
│   │       ├── help.test.js
│   │       ├── level.test.js
│   │       ├── leaderboard.test.js
│   │       ├── poll.test.js
│   │       ├── serverinfo.test.js
│   │       └── userinfo.test.js
│   ├── events/               # Event handler tests
│   │   ├── guildMemberUpdate.test.js
│   │   └── voiceStateUpdate.test.js
│   ├── utils/                # Utility tests
│   │   ├── core/             # Core utility tests
│   │   │   ├── commandHandler.test.js
│   │   │   └── eventHandler.test.js
│   │   ├── discord/          # Discord utility tests
│   │   │   └── roleManagerParseRoleString.test.js
│   │   ├── storage/          # Storage utility tests
│   │   │   └── storage.test.js
│   │   └── ai/               # AI utility tests
│   │       └── conversationManager.test.js
│   └── features/             # Feature-specific tests
│       └── databaseReconnection.test.js
├── integration/              # Integration tests for API interactions
│   ├── discord-api.test.js
│   ├── database.test.js
│   └── setup-roles.test.js
└── e2e/                      # End-to-end workflow tests
    └── role-management.test.js
```

## 🧪 Test Types

### Unit Tests (`tests/unit/`)

- **Purpose**: Test individual functions and modules in isolation
- **Coverage**: Command handlers, utilities, managers
- **Mocking**: Heavy use of mocks to isolate units
- **Speed**: Fast execution, no external dependencies

### Integration Tests (`tests/integration/`)

- **Purpose**: Test interactions with external APIs (Discord API)
- **Coverage**: API calls, authentication, error handling
- **Mocking**: Mock external services while testing real logic
- **Speed**: Medium execution time

### End-to-End Tests (`tests/e2e/`)

- **Purpose**: Test complete user workflows and scenarios
- **Coverage**: Full user journeys from setup to cleanup
- **Mocking**: Minimal mocking, focus on real interactions
- **Speed**: Slower execution, comprehensive testing

## 🚀 Running Tests

### All Tests

```bash
pnpm test
```

### Specific Test Types

```bash
# Run specific test categories
pnpm test tests/unit/
pnpm test tests/integration/
pnpm test tests/e2e/

# Run specific test subdirectories
pnpm test tests/unit/commands/
pnpm test tests/unit/events/
pnpm test tests/unit/utils/
pnpm test tests/unit/features/

# Run specific command category tests
pnpm test tests/unit/commands/admin/
pnpm test tests/unit/commands/developer/
pnpm test tests/unit/commands/general/
```

### Development Mode

```bash
# Watch mode for development
pnpm test:watch

# Coverage report
pnpm test:coverage

# CI mode (no watch, with coverage)
pnpm test:ci
```

## 📊 Current Test Coverage

### ✅ Covered (41 test files, 744 tests)

**Unit Tests:**
- ✅ Admin Commands: welcome, goodbye, moderation, role-reactions, temp-roles, schedule-role, voice-roles, xp, **ticket**
- ✅ General Commands: help, level, leaderboard, poll, serverinfo, userinfo, rps, 8ball
- ✅ Events: guildMemberUpdate, voiceStateUpdate, **eventHandlers (file structure)**
- ✅ Utils: commandHandler, eventHandler, roleParser, **rateLimiter**
- ✅ Features: databaseReconnection

**Integration Tests:**
- ✅ Discord API integration
- ✅ Database operations
- ✅ Setup roles command
- ✅ Payment system

**E2E Tests:**
- ✅ Role management workflows

### ❌ Missing Tests (Priority Order)

**High Priority:**
- ❌ **Event Handler Functionality** - Need functional tests for:
  - guildMemberAdd (welcome messages)
  - guildMemberRemove (goodbye messages)
  - messageReactionAdd/Remove (role reactions)
  - interactionCreate (command routing)
  - messageCreate (XP tracking)

**Medium Priority:**
- ❌ **Feature Modules**
  - features/experience/ (XP system core)
  - features/premium/ (Pro Engine)
  - features/scheduledRoles/
  - features/temporaryRoles/
  - features/analytics/

**Low Priority:**
- ❌ **Utility Modules**
  - utils/ai/ (29 files, only 1 tested)
  - utils/cache/
  - utils/payments/
  - utils/validation/


## 🛠️ Test Utilities

### Global Test Utilities (`tests/setup.js`)

The setup file provides global utilities for creating mock objects:

```javascript
// Create mock Discord interaction
const interaction = testUtils.createMockInteraction({
  commandName: "role-reactions",
  userId: "123456789012345678",
  guild: mockGuild,
});

// Create mock Discord guild
const guild = testUtils.createMockGuild({
  id: "guild123",
  name: "Test Guild",
  roles: [["role1", { id: "role1", name: "Developer" }]],
});

// Create mock Discord member
const member = testUtils.createMockMember({
  id: "member123",
  username: "TestUser",
  hasPermission: true,
});
```

### Available Mock Utilities

- `createMockInteraction()` - Discord slash command interactions
- `createMockGuild()` - Discord guild objects
- `createMockMember()` - Discord member objects
- `createMockMessage()` - Discord message objects
- `createMockReaction()` - Discord reaction objects
- `createMockClient()` - Discord.js client
- `wait(ms)` - Async wait utility

**Note**: These utilities create mock objects that simulate Discord.js behavior for testing purposes.

## 📝 Writing Tests

### Test File Structure

```javascript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("ModuleName", () => {
  let mockDependency;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("FunctionName", () => {
    test("should handle success case", async () => {
      const input = "test input";
      const result = await functionUnderTest(input);
      expect(result).toBe("expected output");
    });

    test("should handle error case", async () => {
      const input = "invalid input";
      await expect(functionUnderTest(input)).rejects.toThrow("Error message");
    });
  });
});
```

### Best Practices

1. **Descriptive Test Names**: Use clear, descriptive test names that explain the scenario
2. **Arrange-Act-Assert**: Structure tests with clear sections
3. **Isolation**: Each test should be independent and not rely on other tests
4. **Mocking**: Mock external dependencies to isolate the unit under test
5. **Error Testing**: Always test both success and error scenarios
6. **Async Testing**: Use proper async/await patterns for asynchronous code

### Mocking Guidelines

```javascript
// Mock modules (adjust path depth based on test location)
// For tests in tests/unit/commands/*/: use ../../../../src/
// For tests in tests/unit/utils/*/: use ../../../src/
vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock functions
const mockFunction = vi.fn().mockResolvedValue("result");

// Mock Discord objects
const mockInteraction = {
  commandName: "test-command",
  reply: vi.fn(),
  options: {
    getString: vi.fn().mockReturnValue("test"),
  },
};
```

## 🔧 Configuration

### Vitest Configuration (`vitest.config.js`)

- **Environment**: Node.js
- **Coverage**: Enabled with thresholds
- **Timeout**: 10 seconds per test
- **ES Modules**: Full support for ES modules
- **Mocking**: Automatic mock clearing between tests

### Environment Variables

Test environment variables are set in `tests/setup.js`:

```javascript
process.env.NODE_ENV = "test";
process.env.DISCORD_TOKEN = "test-token";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";
process.env.PORT = "3001";
```

## 🐛 Debugging Tests

### Running Specific Tests

```bash
# Run tests matching a pattern
pnpm test --testNamePattern="should handle error"

# Run tests in a specific file
pnpm test tests/unit/utils/core/commandHandler.test.js

# Run tests with verbose output
pnpm test --verbose
```

### Debug Mode

```bash
# Run tests with Node.js debugger
node --inspect-brk node_modules/.bin/vitest --run

# Run specific test with debugging
NODE_OPTIONS='--inspect-brk' pnpm test tests/unit/commandHandler.test.js
```

### Coverage Analysis

```bash
# Generate detailed coverage report
pnpm test:coverage
```
