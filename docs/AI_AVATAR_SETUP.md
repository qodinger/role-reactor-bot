# AI Avatar Generator Setup Guide

## Overview

The AI Avatar Generator feature is currently in **demo mode** with mock avatars. To enable real AI-powered avatar generation, you need to configure the OpenRouter API integration.

## Current Status

✅ **Working Features:**

- Command structure and UI
- Rate limiting (5 avatars per hour)
- Mock avatar generation with SVG placeholders
- Error handling and user feedback
- Theme integration

⚠️ **Demo Mode:**

- Currently generates SVG placeholder avatars
- Real AI generation requires API configuration

## Setup for Real AI Generation

### 1. Get OpenRouter API Key

1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Sign up for an account
3. Go to your dashboard and create an API key
4. Copy the API key for configuration

### 2. Configure Environment Variables

Add these to your `.env` file:

```env
# OpenRouter API Configuration
OPENROUTER_API_KEY=your_actual_api_key_here
BOT_WEBSITE_URL=https://github.com/your-repo/role-reactor-bot
BOT_NAME=Role Reactor Bot
```

### 3. Available Image Generation Models

OpenRouter supports several image generation models:

#### **Google Models (What you requested):**

- `google/imagen-3` - Google's latest image generation model
- `google/imagen-2` - Previous version of Google's model
- ⚠️ **Note**: Google models may not work with OpenRouter's chat completions API

#### **Recommended Working Models:**

- `stability-ai/stable-diffusion-xl-base-1.0` - High quality, good for anime
- `stability-ai/stable-diffusion-3-medium` - Latest model, excellent quality
- `midjourney/midjourney-v6` - Premium quality (higher cost)

#### **Anime-Specific Models:**

- `stability-ai/stable-diffusion-xl-base-1.0` with anime prompts
- `runwayml/stable-diffusion-v1-5` with anime fine-tuning

### 4. Update the AI Service

To use real image generation, update `src/commands/general/ai-avatar/aiService.js`:

```javascript
// Replace the mock implementation with real API calls
const completion = await openai.chat.completions.create({
  model: "stability-ai/stable-diffusion-xl-base-1.0", // or your preferred model
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: enhancedPrompt,
        },
      ],
    },
  ],
  max_tokens: 1000,
  temperature: 0.8,
});

// Handle the actual image response
const imageData = completion.choices[0]?.message?.content;
// Process imageData and convert to buffer
```

### 5. Cost Considerations

#### **OpenRouter Pricing (as of 2024):**

- **Stable Diffusion XL**: ~$0.01-0.05 per image
- **Midjourney v6**: ~$0.10-0.20 per image
- **Custom models**: Varies by provider

#### **Rate Limiting:**

- Current: 5 avatars per hour per user
- Adjust `MAX_REQUESTS_PER_HOUR` in `aiService.js` as needed
- Consider implementing daily limits for cost control

### 6. Testing the Setup

1. **Test API Connection:**

   ```bash
   # Test with a simple prompt
   /ai-avatar prompt: "a simple anime character"
   ```

2. **Check Logs:**

   ```bash
   # Look for these log messages:
   # ✅ "AI avatar generation completed successfully"
   # ❌ "No response from AI service"
   ```

3. **Verify Image Quality:**
   - Generated avatars should be 512x512 pixels
   - Should match the selected style and mood
   - Should be unique for each prompt

## Troubleshooting

### Common Issues

#### **"No response from AI service"**

- **Cause**: API key not configured or invalid
- **Solution**: Check `OPENROUTER_API_KEY` in `.env`
- **Fallback**: Bot will use mock avatars

#### **"Rate limit exceeded"**

- **Cause**: User has generated too many avatars
- **Solution**: Wait 1 hour or adjust rate limits
- **Configuration**: Modify `MAX_REQUESTS_PER_HOUR` in `aiService.js`

#### **"Avatar generation failed"**

- **Cause**: API service unavailable or prompt rejected
- **Solution**: Check OpenRouter status, try different prompt
- **Fallback**: Bot will show error message with suggestions

#### **Poor image quality**

- **Cause**: Wrong model or poor prompt
- **Solution**: Use better models, improve prompts
- **Configuration**: Switch to `stability-ai/stable-diffusion-3-medium`

### Debug Mode

Enable detailed logging:

```env
LOG_LEVEL=DEBUG
```

This will show:

- API request details
- Response processing
- Error details
- Performance metrics

## Advanced Configuration

### Custom Prompts

Modify `buildAnimePrompt()` in `aiService.js` to:

- Add more style variations
- Include specific anime references
- Add quality modifiers
- Include negative prompts

### Model Selection

Switch between models based on:

- **Quality**: Use latest models for best results
- **Cost**: Use cheaper models for high volume
- **Speed**: Use faster models for better UX
- **Style**: Use specialized models for anime

### Rate Limiting

Adjust limits in `aiService.js`:

```javascript
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 5; // Adjust as needed
```

### Error Handling

Customize error messages in `embeds.js`:

```javascript
const errorMessages = {
  general: "Your custom error message here",
  rateLimit: "Custom rate limit message",
  // ... more error types
};
```

## Production Deployment

### Environment Setup

1. **Production .env:**

   ```env
   NODE_ENV=production
   OPENROUTER_API_KEY=your_production_key
   LOG_LEVEL=INFO
   LOG_FILE=./logs/bot.log
   ```

2. **Monitoring:**
   - Set up log monitoring
   - Track API usage and costs
   - Monitor error rates
   - Set up alerts for failures

3. **Scaling:**
   - Consider implementing caching
   - Add database storage for generated avatars
   - Implement user preferences
   - Add avatar history

### Security Considerations

- **API Key Security**: Never commit API keys to version control
- **Rate Limiting**: Prevent abuse and control costs
- **Input Validation**: Sanitize user prompts
- **Error Handling**: Don't expose sensitive information

## Support

### Getting Help

1. **Check Logs**: Look for error messages and debug info
2. **Test API**: Verify OpenRouter API key works
3. **Check Documentation**: Review OpenRouter API docs
4. **Community**: Ask in Discord support server

### Common Solutions

- **API Key Issues**: Regenerate key, check permissions
- **Model Issues**: Try different models, check availability
- **Quality Issues**: Improve prompts, use better models
- **Cost Issues**: Adjust rate limits, use cheaper models

## Future Enhancements

### Planned Features

- **Avatar History**: Save and retrieve previous avatars
- **Custom Styles**: User-defined art styles
- **Batch Generation**: Generate multiple avatars at once
- **Avatar Variations**: Create variations of existing avatars
- **Integration**: Connect with user profiles and roles

### Technical Improvements

- **Caching**: Cache popular avatars for faster access
- **Background Processing**: Generate avatars asynchronously
- **Image Optimization**: Compress images for faster loading
- **Database Storage**: Store avatar metadata and history
- **API Fallbacks**: Multiple API providers for reliability

This setup guide will help you transition from demo mode to full AI-powered avatar generation! 🎨✨
