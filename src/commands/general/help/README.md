# Help Command

## Overview

The Help command provides comprehensive command information and guidance for users. It features autocomplete support, dynamic content generation, and an interactive UI for easy navigation.

## File Structure

```
help/
├── index.js              # Main command entry point and routing
├── handlers.js           # Core command logic and interaction handlers
├── data.js               # Help data generation and command metadata
├── embeds.js             # Embed creation and formatting
├── components.js         # UI component creation
├── interactionHandler.js # Legacy interaction handler (now simplified)
├── utils.js              # Utility functions and helpers
└── README.md             # This documentation file
```

## Architecture

Following the modular pattern established by other general commands:

- **`index.js`**: Command definition, autocomplete support, and main execution flow
- **`handlers.js`**: Core business logic, error handling, and interaction routing
- **`data.js`**: Command metadata generation, category management, and smart tagging
- **`embeds.js`**: Discord embed creation and formatting
- **`components.js`**: Interactive UI components (buttons, menus)
- **`interactionHandler.js`**: Legacy interaction handler (maintains backward compatibility)
- **`utils.js`**: Helper functions for text processing and command analysis

## Usage Examples

```
/help
/help command:role-reactions
```

## Permissions Required

- None (public command)
- All users can access

## Key Features

- **Autocomplete Support**: Users can type partial command names for suggestions
- **Dynamic Content**: Help content is generated based on available commands
- **Permission-Based Display**: Users only see commands they can use
- **Interactive UI**: Dropdown menus and buttons for easy navigation
- **Comprehensive Help**: Detailed information for each command
- **Usage Analytics**: Tracks how users interact with help system
- **Category Organization**: Commands organized into logical groups
- **Smart Tagging**: Automatically generates relevant tags for commands

## Interaction Handling

The system automatically handles:

- Category selection via dropdown
- View switching (Overview/All Commands)
- Command detail navigation
- Back navigation

## Error Handling

- **Command Not Found**: Graceful handling of invalid command names
- **Permission Errors**: Clear messages when users lack required permissions
- **System Errors**: Fallback responses for unexpected issues
- **Validation**: Input validation for command names and parameters

## Performance Considerations

- **Lazy Loading**: Components and data are loaded as needed
- **Caching**: Command metadata is cached for better performance
- **Efficient Queries**: Minimal database/API calls during help generation
- **Optimized Rendering**: Efficient embed and component creation

## Dependencies

- Discord.js
- Theme configuration for colors and styling
- Command handler for command metadata
- Permission validation utilities
