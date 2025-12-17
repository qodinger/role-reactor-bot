# Would You Rather Command

## Overview

The `/wyr` command provides random "Would You Rather" questions to spark discussions and engagement in your server. Users can vote on their preferred option and see real-time vote statistics.

## File Structure

```
wyr/
├── index.js      # Command definition
├── handlers.js   # Command execution logic and button handlers
├── embeds.js     # Discord embed creation with vote statistics
├── utils.js      # Question database and utilities
└── README.md     # This documentation
```

## Architecture

Following the modular pattern established by other general commands:

- **`index.js`**: Command definition and exports
- **`handlers.js`**: Core command logic, vote tracking, and button interaction handling
- **`embeds.js`**: Discord embed creation with vote visualization
- **`utils.js`**: Question database organized by categories and utility functions

## Usage Examples

```
/wyr
```

Returns a random "Would You Rather" question with interactive voting buttons.

## Permissions Required

- `Send Messages` permission
- `Embed Links` permission
- `Use External Emojis` permission (for button emojis)

## Key Features

### Interactive Voting

- **Vote Buttons**: Users can click 1️⃣ or 2️⃣ to vote for their preferred option
- **Real-time Statistics**: See vote counts and percentages with visual progress bars
- **Toggle Voting**: Click the same button again to remove your vote
- **New Question Button**: Get a fresh question without using the command again

### Question Database

- **100+ Questions**: Extensive curated database of engaging questions
- **6 Categories**: Questions organized by theme:
  - **Funny**: Lighthearted and humorous dilemmas
  - **Superhero**: Powers and abilities scenarios
  - **Life Choices**: Real-world decision making
  - **Philosophical**: Thought-provoking questions
  - **Challenging**: Complex and difficult choices
  - **Pop Culture**: References to movies, books, games, and more
- **Random Selection**: Each command returns a different question
- **Category Support**: Questions can be filtered by category (future enhancement)

### Visual Design

- **Progress Bars**: Visual representation of vote distribution
- **Vote Counts**: See how many people voted for each option
- **Clean Interface**: Modern embed design with emojis and formatting
- **Statistics Display**: Total votes and percentages shown clearly

## How It Works

1. User runs `/wyr` command
2. Bot displays a random question with two options
3. Users click 1️⃣ or 2️⃣ to vote for their preferred option
4. Vote counts update in real-time with progress bars
5. Users can click "New Question" to get another random question
6. Votes are stored in memory and expire after 24 hours

## Technical Details

### Vote Tracking

- Votes are stored in-memory using a Map structure
- Each message has its own vote data
- Votes automatically expire after 24 hours
- Users can toggle their votes by clicking the same button again

### Question Parsing

- Questions are automatically parsed to extract the two options
- Options are displayed separately in the embed
- Fallback handling for edge cases

### Button Interactions

- Button handlers are registered in the button router
- Supports vote buttons (1️⃣ and 2️⃣) and new question button
- Proper error handling and user feedback
