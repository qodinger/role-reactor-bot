# Testing Guide

This guide covers testing practices and procedures for Role Reactor Bot.

## 🧪 Testing Framework

The project uses **Vitest** as the primary testing framework, providing:
- Fast test execution
- ES modules support
- Built-in TypeScript support
- Coverage reporting
- Watch mode for development

## 📁 Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── commands/           # Command tests
│   │   ├── admin/         # Admin command tests
│   │   ├── general/       # General command tests
│   │   └── developer/     # Developer command tests
│   ├── utils/             # Utility function tests
│   └── features/          # Feature-specific tests
├── integration/            # Integration tests (future)
├── e2e/                   # End-to-end tests (future)
└── utils/
    └── testHelpers.js     # Test utilities and helpers
```

## 🚀 Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI (browser interface)
npm run test:ui

# Run tests for CI (with coverage)
npm run test:ci
```

### Specific Test Commands

```bash
# Run specific test file
npm test -- tests/unit/commands/admin/voice-roles.test.js

# Run tests matching pattern
npm test -- --grep "voice roles"

# Run tests in specific directory
npm test -- tests/unit/commands/admin/
```

## 📝 Writing Tests

### Test File Naming

- **Unit tests**: `*.test.js`
- **Integration tests**: `*.integration.test.js`
- **End-to-end tests**: `*.e2e.test.js`

### Test Structure

```javascript
import { describe, test, expect, vi, beforeEach } from "vitest";

describe("Feature Name", () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  describe("Specific Functionality", () => {
    test("should do something specific", () => {
      // Arrange
      const input = "test input";
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe("expected output");
    });
  });
});
```

### Mocking Guidelines

#### Discord.js Mocking

```javascript
// Use test helpers for consistent mocks
import { createMockInteraction, createMockGuild } from "../utils/testHelpers.js";

const mockInteraction = createMockInteraction({
  guild: createMockGuild({ id: "test-guild" }),
  options: {
    getString: vi.fn().mockReturnValue("test-value"),
  },
});
```

#### Database Mocking

```javascript
// Mock MongoDB at the top level
vi.mock("mongodb", () => {
  const mockCollection = {
    find: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
    findOne: vi.fn().mockResolvedValue(null),
    insertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
  };
  
  return {
    MongoClient: vi.fn(() => ({
      db: vi.fn(() => ({
        collection: vi.fn(() => mockCollection),
      })),
    })),
  };
});
```

#### Storage Manager Mocking

```javascript
const mockStorageManager = {
  get: vi.fn().mockResolvedValue({}),
  save: vi.fn().mockResolvedValue(true),
  delete: vi.fn().mockResolvedValue(true),
};

vi.mock("../../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue(mockStorageManager),
}));
```

## 🎯 Testing Best Practices

### 1. Test Organization

- **Group related tests** using `describe` blocks
- **Use descriptive test names** that explain what is being tested
- **Follow AAA pattern**: Arrange, Act, Assert
- **Keep tests focused** on single functionality

### 2. Mocking Strategy

- **Mock external dependencies** (Discord API, database, file system)
- **Don't mock the code under test**
- **Use consistent mock patterns** across tests
- **Clear mocks between tests** using `vi.clearAllMocks()`

### 3. Test Coverage

- **Aim for high coverage** but focus on quality over quantity
- **Test happy paths** and error conditions
- **Test edge cases** and boundary conditions
- **Test user-facing functionality** thoroughly

### 4. Test Data

- **Use realistic test data** that represents actual usage
- **Create reusable test fixtures** for common scenarios
- **Avoid hardcoded values** where possible
- **Use factories** for creating test objects

## 📊 Current Test Coverage

### Completed Test Suites

✅ **Voice Roles Command** (33 tests)
- Role validation and permissions
- Channel validation
- Voice operations (disconnect, mute, deafen, move)
- Storage manager integration
- Error handling and edge cases

### Test Coverage Goals

- **Commands**: All admin, general, and developer commands
- **Utilities**: Core utility functions and helpers
- **Features**: Major features like temporary roles, XP system
- **Integration**: Database operations and external API calls

## 🔧 Test Configuration

### Vitest Configuration

The project uses `vitest.config.js` for test configuration:

```javascript
export default {
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'scripts/',
        'docs/',
      ],
    },
  },
};
```

### Environment Variables

Tests use environment variables for configuration:
- `NODE_ENV=test` - Set automatically during testing
- `LOG_LEVEL=ERROR` - Reduce log noise during tests
- Mock values for Discord tokens and API keys

## 🐛 Debugging Tests

### Common Issues

#### 1. Import Errors
```bash
# Error: Cannot resolve module
# Solution: Check import paths and file extensions
```

#### 2. Mock Issues
```bash
# Error: Mock not working
# Solution: Ensure mocks are defined before imports
```

#### 3. Async Test Issues
```bash
# Error: Test timeout
# Solution: Ensure async operations are properly awaited
```

### Debugging Commands

```bash
# Run single test with debug output
npm test -- --reporter=verbose tests/specific-test.js

# Run tests with Node.js debugging
node --inspect-brk node_modules/.bin/vitest run

# Check test coverage for specific file
npm run test:coverage -- tests/specific-test.js
```

## 📈 Test Metrics

### Quality Metrics

- **Test Coverage**: Aim for >80% line coverage
- **Test Speed**: Tests should run in <30 seconds
- **Test Reliability**: Tests should pass consistently
- **Test Maintainability**: Tests should be easy to update

### Performance Guidelines

- **Fast Tests**: Unit tests should run in milliseconds
- **Isolated Tests**: Each test should be independent
- **Minimal Mocking**: Only mock what's necessary
- **Efficient Setup**: Use `beforeEach` for common setup

## 🔄 Continuous Integration

### GitHub Actions (Future)

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

### Pre-commit Hooks

Tests are run automatically before commits using Husky:

```bash
# .husky/pre-commit
npm test
```

## 📚 Additional Resources

- **[Vitest Documentation](https://vitest.dev/)** - Testing framework
- **[Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)** - General testing guidelines
- **[Discord.js Testing](https://discordjs.guide/additional-info/testing.html)** - Discord bot testing patterns

## 🆘 Getting Help

- **Check existing tests** for patterns and examples
- **Review test helpers** in `tests/utils/testHelpers.js`
- **Ask in discussions** for testing-specific questions
- **Create issues** for testing framework problems

---

**Remember**: Good tests make refactoring safe and catch bugs early. Invest time in writing quality tests!