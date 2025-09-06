# 8ball Command

An intelligent magic 8-ball command that provides context-aware responses to user questions using advanced sentiment analysis and smart weighting.

## Structure

- `index.js` - Main command definition and exports
- `handlers.js` - Core command logic, smart analysis, and response generation
- `embeds.js` - Discord embed creation and mystical styling
- `utils.js` - Helper functions for randomization
- `README.md` - This documentation file

## Features

- **Smart Analysis**: Analyzes question sentiment, type, and context
- **Intelligent Responses**: 5 response categories with weighted selection
- **Context Awareness**: Personal, urgent, and emotional question detection
- **Mystical Design**: Modern embed design with category-specific themes
- **Rich Formatting**: Emojis, colors, and proper Discord embed styling

## Smart Response System

### 5 Response Categories with Intelligent Weighting

#### Very Positive Responses ✨ (15% base weight)

- "It is absolutely certain!" ✨
- "The stars have aligned perfectly!" 🌟
- "This is written in the stars!" 🔮
- "All signs point to spectacular success!" 🚀

#### Positive Responses 🌟 (25% base weight)

- "It is certain." ✨
- "It is decidedly so." 🌟
- "Without a doubt." 💫
- "Yes - definitely." ✅

#### Neutral Responses 🌫️ (30% base weight)

- "Reply hazy, try again." 🌫️
- "Ask again later." ⏰
- "The mists of fate are thick today." 🌫️
- "Time will reveal the truth." ⏳

#### Negative Responses 💔 (20% base weight)

- "Don't count on it." 💔
- "My reply is no." ❌
- "The signs are not favorable." 🌧️
- "This path may be challenging." ⛰️

#### Very Negative Responses ⚠️ (10% base weight)

- "Absolutely not - avoid this path!" 💔
- "The cosmic forces strongly warn against this!" ❌
- "This would be a grave mistake!" 📰
- "This path leads to certain failure!" ⛰️

## Smart Analysis Features

### Question Type Detection

- **Yes/No Questions**: "Will I succeed?", "Should I do this?"
- **When Questions**: "When will this happen?", "How long until..."
- **How Questions**: "How should I proceed?", "What way..."
- **Why Questions**: "Why did this happen?", "What reason..."
- **What Questions**: "What should I do?", "Which option..."

### Sentiment Analysis

- **Positive Keywords**: good, great, excellent, amazing, love, happy, success, win, achieve, dream, hope
- **Negative Keywords**: bad, terrible, awful, hate, sad, fail, lose, problem, trouble, worry, fear
- **Urgent Keywords**: urgent, emergency, critical, important, now, immediately, asap, quickly
- **Personal Keywords**: i, me, my, myself, personal, life, future, career, relationship, family

### Smart Weighting System

- **Personal Questions**: +10% positive responses, -5% negative
- **Positive Sentiment**: +20% very positive, +15% positive
- **Negative Sentiment**: +20% very negative, +15% negative
- **Urgent Questions**: +15% neutral (more realistic), -10% extreme responses

## Usage Examples

```
/8ball question: "Will I succeed in my career?"
/8ball question: "Should I take this job offer?"
/8ball question: "Is this a bad idea?"
/8ball question: "What should I do about my relationship?"
/8ball question: "This is urgent, should I proceed?"
```

## Visual Design

### Embed Features

- **Mystical Theme**: "🔮 Mystical Oracle" author with mystical descriptions
- **Category Colors**: Theme-based colors (success, info, warning, error, primary)
- **Smart Descriptions**: Category-specific mystical descriptions
- **Clean Layout**: Emoji-based visual elements, no broken images
- **User Integration**: User avatar in footer with "Asked by username"

### Response Categories

- **Exceptional Fortune** (Very Positive): "The universe is absolutely on your side!"
- **Positive Fortune** (Positive): "The stars align in your favor!"
- **Uncertain Future** (Neutral): "The mists of fate are unclear..."
- **Challenging Path** (Negative): "The road ahead may be difficult..."
- **Dangerous Path** (Very Negative): "The cosmic forces strongly warn against this..."

## Technical Details

- **Smart Analysis**: Advanced question parsing and sentiment detection
- **Weighted Selection**: Dynamic probability adjustment based on context
- **Error Handling**: Graceful error management with mystical error messages
- **Performance**: Efficient keyword matching and analysis algorithms
- **Logging**: Command usage tracking for analytics and debugging
- **Modular Design**: Clean separation of concerns with dedicated handlers
- **Theme Integration**: Uses centralized theme colors for consistency
