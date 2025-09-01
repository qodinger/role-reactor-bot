# 8ball Command

A fun magic 8-ball command that provides random responses to user questions.

## Structure

- `index.js` - Main command definition and exports
- `handlers.js` - Core command logic and response generation
- `embeds.js` - Discord embed creation and styling
- `utils.js` - Helper functions for randomization
- `README.md` - This documentation file

## Features

- **Random Responses**: Provides unpredictable answers from three categories
- **Categorized Answers**: Positive, neutral, and negative responses
- **Visual Feedback**: Color-coded embeds based on response type
- **Rich Formatting**: Uses emojis and proper Discord embed styling

## Response Categories

### Positive Responses ✨

- "It is certain." ✨
- "It is decidedly so." 🌟
- "Without a doubt." 💫
- "Yes - definitely." ✅
- And more...

### Neutral Responses 🤔

- "Reply hazy, try again." 🌫️
- "Ask again later." ⏰
- "Better not tell you now." 🤐
- And more...

### Negative Responses 💭

- "Don't count on it." 💔
- "My reply is no." ❌
- "Very doubtful." 🤨
- And more...

## Usage

```
/8ball question: Your question here
```

## Technical Details

- Uses Discord.js SlashCommandBuilder
- Implements proper error handling
- Logs command usage for analytics
- Follows the modular command structure pattern
