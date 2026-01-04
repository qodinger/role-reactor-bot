# ComfyUI Integration Documentation

This directory contains all documentation related to ComfyUI integration with the Role Reactor Bot.

## 📚 Documentation Files

- **[API-Documentation.md](./API-Documentation.md)** - Complete ComfyUI API reference and usage guide
- **[Development-Roadmap.md](./Development-Roadmap.md)** - Development phases, progress tracking, and implementation roadmap
- **[Parameters.md](./Parameters.md)** - User guide for `/imagine` command parameters and ComfyUI optimization

## 🔧 Workflow Files

- **[workflows/](./workflows/)** - ComfyUI workflow JSON files
  - `nsfw-image-generation-api.json` - Main NSFW image generation workflow
  - `nsfw-image-generation.json` - Alternative NSFW workflow
  - `anime-avatar-generation.json` - Anime-style avatar generation workflow

## 🚀 Quick Start

1. **For Users**: Start with [Parameters.md](./Parameters.md) to learn how to use the `/imagine` command
2. **For Developers**: Check [API-Documentation.md](./API-Documentation.md) for technical details
3. **For Project Management**: See [Development-Roadmap.md](./Development-Roadmap.md) for current status

## 🔗 Related Files

- **Configuration**: `src/config/ai.js` - ComfyUI provider configuration
- **Implementation**: `src/utils/ai/providers/ComfyUIProvider.js` - Main provider implementation
- **Environment**: `env.example` - Environment variable examples (see ComfyUI section)

## 📋 Current Status

✅ **Phase 1 Complete** - Core integration and testing finished
🚀 **Ready for Production** - ComfyUI integration is fully functional

See [Development-Roadmap.md](./Development-Roadmap.md) for detailed progress and next steps.