# Avatar Command

A command to display user avatars with interactive download buttons and detailed information.

## Structure

- `index.js` - Main command definition and exports
- `handlers.js` - Core command logic and user interaction handling
- `embeds.js` - Discord embed creation and styling
- `components.js` - Interactive button components
- `utils.js` - Helper functions for avatar processing
- `README.md` - This documentation file

## Features

- **User Avatar Display**: Shows high-quality user avatars
- **Multiple Formats**: Download buttons for PNG, JPG, and WebP formats
- **Server vs Global**: Detects and displays server-specific avatars
- **Rich Information**: Shows avatar details, format, and quality
- **Interactive Buttons**: Direct download links for different formats

## Usage

```
/avatar [user]
```

- `user` (optional): The user whose avatar you want to see
- If no user is specified, shows your own avatar

## Avatar Information Displayed

- **Username and Tag**: Full Discord user identification
- **Avatar Type**: Custom or default Discord avatar
- **Format Detection**: Animated GIF or static image
- **Quality**: High definition display
- **Server Avatar**: Indicates if user has custom server avatar

## Download Options

- **PNG**: High-quality PNG format
- **JPG**: Compressed JPG format
- **WebP**: Modern WebP format

## Technical Details

- Uses Discord.js SlashCommandBuilder
- Implements proper error handling
- Logs command usage for analytics
- Follows the modular command structure pattern
- Supports both global and server-specific avatars
