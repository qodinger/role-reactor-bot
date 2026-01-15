# ComfyUI Integration Documentation

This directory contains all documentation related to ComfyUI integration with the Role Reactor Bot.

## 📚 Documentation Files

- **[API Reference](./api.md)** - Complete ComfyUI API reference and usage guide
- **[Development Roadmap](./roadmap.md)** - Development phases, progress tracking, and implementation roadmap
- **[User Guide & Parameters](./parameters.md)** - Guide for `/imagine` command parameters and ComfyUI optimization

## 🔧 Workflow Files

Workflows are stored in the core application directory for direct access by the AI provider:
- **Location**: `src/utils/ai/providers/comfyui/workflows/`

Includes:
- Anime styles (Animagine, Anything)
- Fast and Quality variants
- HQ upscaling configurations

## 🚀 Quick Start

1. **For Users**: Start with [User Guide & Parameters](./parameters.md) to learn how to use the `/imagine` command
2. **For Developers**: Check the [API Reference](./api.md) for technical details
3. **For Strategy**: See the [Development Roadmap](./roadmap.md) for current status

## 🔗 Related Files

- **Configuration**: `src/config/ai.js` - ComfyUI provider configuration
- **Implementation**: `src/utils/ai/providers/ComfyUIProvider.js` - Main provider implementation
- **Environment**: `env.example` - Environment variable examples

---

*Last Updated: January 15, 2026*