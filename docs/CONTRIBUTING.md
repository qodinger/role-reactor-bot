# Contributing Guidelines

Thank you for your interest in contributing to Role Reactor Bot! This document provides guidelines for contributing to the project.

## 🤝 How to Contribute

### Reporting Issues

1. **Check existing issues** before creating a new one
2. **Use the issue template** and provide all requested information
3. **Include logs** if reporting a bug
4. **Be specific** about the problem and steps to reproduce

### Suggesting Features

1. **Check existing feature requests** first
2. **Explain the use case** and why it's needed
3. **Provide examples** of how it would work
4. **Consider implementation complexity**

### Code Contributions

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** following the coding standards
4. **Test your changes** thoroughly
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to your branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

## 🛠️ Development Setup

### Prerequisites

- Node.js 16.0.0 or higher
- pnpm package manager
- MongoDB (local or Docker)
- Discord Bot Token

### Local Development

```bash
# Clone the repository
git clone https://github.com/tyecode-bots/role-reactor-bot.git
cd role-reactor-bot

# Install dependencies
pnpm install

# Copy environment file
cp env.example .env

# Edit .env with your Discord bot token
# DISCORD_TOKEN=your_bot_token_here
# CLIENT_ID=your_client_id_here

# Start development mode
pnpm dev
```

### Testing

```bash
# Run linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Check formatting
pnpm format:check
```

## 📝 Coding Standards

### JavaScript/Node.js

- **ESLint**: Follow the project's ESLint configuration
- **Prettier**: Use Prettier for code formatting
- **ES6+**: Use modern JavaScript features
- **Async/Await**: Prefer async/await over Promises
- **Error Handling**: Always handle errors properly

### Code Style

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **Trailing commas**: Use trailing commas in objects/arrays
- **Line length**: Keep lines under 100 characters

### File Organization

- **Commands**: Place in `src/commands/` with appropriate subdirectories
  - `admin/` - Server management commands
  - `developer/` - Developer-only commands
  - `general/` - General user commands
- **Events**: Place in `src/events/`
- **Utilities**: Place in `src/utils/` with subdirectories
  - `core/` - Core utility functions
  - `discord/` - Discord-specific utilities
  - `monitoring/` - Health and performance monitoring
  - `storage/` - Database and storage management
- **Configuration**: Place in `src/config/`
- **Features**: Place in `src/features/` for complex features

### Naming Conventions

- **Files**: Use kebab-case (e.g., `setup-roles.js`)
- **Functions**: Use camelCase (e.g., `setupRoles`)
- **Constants**: Use UPPER_SNAKE_CASE (e.g., `THEME_COLOR`)
- **Classes**: Use PascalCase (e.g., `RoleExpirationScheduler`)

## 🧪 Testing Guidelines

### Manual Testing

1. **Test all commands** with different permission levels
2. **Test error scenarios** (invalid inputs, missing permissions)
3. **Test edge cases** (empty inputs, very long inputs)
4. **Test performance** with multiple users/roles

### Code Quality

1. **Run linting** before committing
2. **Check for console logs** (use structured logging)
3. **Verify error handling** is comprehensive
4. **Test database operations** work correctly

## 📋 Pull Request Guidelines

### Before Submitting

1. **Test your changes** thoroughly
2. **Run linting**: `pnpm lint`
3. **Format code**: `pnpm format`
4. **Update documentation** if needed
5. **Add tests** for new features

### Pull Request Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring

## Testing

- [ ] Manual testing completed
- [ ] Linting passes
- [ ] No console.log statements added

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes
```

## 🚫 What Not to Do

- **Don't commit** `.env` files or sensitive data
- **Don't add** `console.log` statements (use structured logging)
- **Don't break** existing functionality
- **Don't ignore** linting errors
- **Don't commit** without testing

## 🎯 Areas for Contribution

### High Priority

- **Bug fixes** and error handling improvements
- **Performance optimizations**
- **Security enhancements**
- **Documentation improvements**

### Medium Priority

- **New features** (discuss in issues first)
- **Code refactoring**
- **Test coverage improvements**
- **Logging enhancements**

### Low Priority

- **Cosmetic changes**
- **Minor UI improvements**
- **Additional examples**

## 📞 Getting Help

- **GitHub Issues**: Create an issue for questions
- **Discussions**: Use GitHub Discussions for general questions
- **Code Review**: Ask for review on draft PRs

## 🙏 Recognition

Contributors will be recognized in:

- **README.md** contributors section
- **GitHub** contributors page
- **Release notes** for significant contributions

Thank you for contributing to Role Reactor Bot! 🎉
