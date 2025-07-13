# Contributing to RoleReactor Bot 🤝

Thank you for your interest in contributing to RoleReactor Bot! This document provides guidelines and information for contributors.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)
- [Reporting Issues](#reporting-issues)
- [Feature Requests](#feature-requests)

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. We are committed to providing a welcoming and inspiring community for all.

### Our Standards

- **Be respectful** - Treat everyone with respect
- **Be collaborative** - Work together to achieve common goals
- **Be constructive** - Provide constructive feedback and suggestions
- **Be professional** - Maintain professional behavior in all interactions

## 🚀 Getting Started

### Prerequisites

- Node.js 16.0.0 or higher
- npm or pnpm package manager
- Git
- Discord Bot Token (for testing)

### Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/role-reactor-bot.git
   cd role-reactor-bot
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your Discord bot token and other settings
   ```

4. **Deploy commands (development)**
   ```bash
   pnpm run deploy-commands
   ```

5. **Start the bot**
   ```bash
   pnpm run dev
   ```

## 📝 Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

- **🐛 Bug Fixes** - Fix issues and improve stability
- **✨ New Features** - Add new functionality
- **📚 Documentation** - Improve docs and examples
- **🧪 Tests** - Add or improve test coverage
- **🔧 Improvements** - Enhance existing features
- **🌐 Localization** - Add language support

### Before You Start

1. **Check existing issues** - Avoid duplicate work
2. **Discuss major changes** - Open an issue first for significant features
3. **Follow the coding standards** - Maintain code quality
4. **Test your changes** - Ensure everything works correctly

## 🔄 Pull Request Process

### Creating a Pull Request

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the code style guidelines
   - Add tests if applicable
   - Update documentation

3. **Test your changes**
   ```bash
   pnpm run lint
   pnpm test
   pnpm run dev  # Test the bot locally
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub
   ```

### Pull Request Guidelines

- **Use descriptive titles** - Clear, concise titles
- **Provide detailed descriptions** - Explain what and why
- **Include screenshots** - For UI changes
- **Link related issues** - Reference any related issues
- **Follow the template** - Use the provided PR template

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes
- `refactor` - Code refactoring
- `test` - Test changes
- `chore` - Maintenance tasks

**Examples:**
```
feat(commands): add new help command
fix(permissions): resolve role hierarchy issue
docs(readme): update installation instructions
```

## 🎨 Code Style

### JavaScript Guidelines

- **Use ES6+ features** - Prefer modern JavaScript
- **Follow ESLint rules** - Run `pnpm run lint` before committing
- **Use meaningful names** - Clear variable and function names
- **Add comments** - Explain complex logic
- **Handle errors properly** - Use try-catch blocks

### Discord.js Best Practices

- **Use proper intents** - Only request necessary intents
- **Handle partials correctly** - For reaction events
- **Use embeds for responses** - Professional appearance
- **Implement proper permissions** - Check user and bot permissions
- **Rate limiting** - Respect Discord API limits

### File Structure

```
src/
├── commands/          # Command handlers
│   ├── admin/        # Admin commands
│   └── general/      # General commands
├── events/           # Event listeners
├── utils/            # Utility functions
├── config/           # Configuration files
└── index.js          # Main entry point
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run linting
pnpm run lint

# Fix linting issues
pnpm run lint:fix
```

### Writing Tests

- **Test new features** - Add tests for new functionality
- **Test edge cases** - Cover error scenarios
- **Mock external dependencies** - Use mocks for Discord API calls
- **Test permissions** - Verify permission checks work correctly

### Test Structure

```javascript
describe('Command: setup-roles', () => {
  it('should create role-reaction message successfully', async () => {
    // Test implementation
  });

  it('should handle invalid permissions', async () => {
    // Test error handling
  });
});
```

## 🐛 Reporting Issues

### Before Reporting

1. **Check existing issues** - Search for similar problems
2. **Try to reproduce** - Ensure the issue is reproducible
3. **Check documentation** - Verify it's not a configuration issue
4. **Test in isolation** - Remove other factors

### Issue Template

Use the provided issue template and include:

- **Clear title** - Descriptive issue title
- **Detailed description** - What happened vs expected
- **Steps to reproduce** - Step-by-step instructions
- **Environment info** - Node.js version, OS, etc.
- **Screenshots/logs** - Visual evidence if applicable
- **Additional context** - Any relevant information

### Bug Report Example

```markdown
## Bug Description
The bot fails to assign roles when users react to messages.

## Steps to Reproduce
1. Use `/setup-roles` to create a role message
2. React to the message with the correct emoji
3. Role is not assigned

## Expected Behavior
User should receive the role when reacting.

## Actual Behavior
No role is assigned, no error message shown.

## Environment
- Node.js: 16.15.0
- Discord.js: 14.14.1
- OS: macOS 12.0
```

## 💡 Feature Requests

### Before Requesting

1. **Check existing features** - Ensure it's not already implemented
2. **Search issues** - Look for similar requests
3. **Consider impact** - Think about how it affects the project
4. **Provide use cases** - Explain why it's needed

### Feature Request Template

```markdown
## Feature Description
Brief description of the requested feature.

## Use Cases
- How would this feature be used?
- What problems does it solve?

## Proposed Implementation
Optional: How you think it could be implemented.

## Alternatives Considered
What other approaches were considered?

## Additional Context
Any other relevant information.
```

## 📚 Documentation

### Contributing to Documentation

- **Keep docs updated** - Update docs when changing features
- **Use clear language** - Write for different skill levels
- **Include examples** - Provide practical examples
- **Add screenshots** - Visual aids for complex topics

### Documentation Standards

- **Use markdown** - Follow markdown best practices
- **Include code examples** - Show how to use features
- **Update README** - Keep main README current
- **Add inline comments** - Document complex code

## 🏆 Recognition

Contributors will be recognized in:

- **README.md** - List of contributors
- **Release notes** - Credit for significant contributions
- **Discord server** - Special contributor role
- **GitHub profile** - Public recognition

## 📞 Getting Help

If you need help contributing:

- **Discord Server** - Join our community
- **GitHub Issues** - Ask questions in issues
- **Documentation** - Check the wiki
- **Code Reviews** - Learn from feedback

## 🎉 Thank You

Thank you for contributing to RoleReactor Bot! Your contributions help make Discord servers better for everyone.

---

**Happy coding! 🚀** 