# ComfyUI API Service

REST API endpoints for managing ComfyUI workflows and models dynamically.

## Base URL

```
http://localhost:3030/api/v1/comfyui
```

## Endpoints

### Workflows

#### List All Workflows

```http
GET /workflows
```

**Response:**

```json
{
  "status": "success",
  "workflows": [
    {
      "name": "anime-avatar-generation",
      "metadata": {
        "nodeCount": 9,
        "hasKSampler": true,
        "hasControlNet": false,
        "hasLoRA": false,
        "estimatedSteps": 15,
        "estimatedCFG": 7,
        "supportedSizes": ["832x832"],
        "requiredModels": ["AnythingXL_xl.safetensors"],
        "nodeTypes": ["CheckpointLoaderSimple", "CLIPTextEncode", ...]
      }
    }
  ],
  "count": 3
}
```

#### Get Workflow Details

```http
GET /workflows/:name
```

**Example:**

```bash
curl http://localhost:3030/api/v1/comfyui/workflows/anime-avatar-generation
```

#### Set Active Workflow

```http
POST /workflows/active
Content-Type: application/json

{
  "workflowName": "anime-avatar-generation"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Active workflow set to 'anime-avatar-generation'",
  "workflow": {
    "name": "anime-avatar-generation",
    "metadata": { ... }
  }
}
```

#### Reload Workflows from Disk

```http
POST /workflows/reload
```

Reloads all workflow files from the filesystem.

### Models

#### List All Models

```http
GET /models
```

**Query Parameters:**

- `flags` (optional): Comma-separated list of flags to filter by (e.g., `?flags=anime,nsfw`)

**Response:**

```json
{
  "status": "success",
  "models": [
    {
      "filename": "AnythingXL_xl.safetensors",
      "name": "Anything XL",
      "type": "anime",
      "style": "anime",
      "nsfw": true,
      "quality": "high",
      "speed": "medium",
      "flags": ["anime", "manga", "2d", "stylized", "nsfw"],
      "description": "High-quality anime/manga style model",
      "defaultSettings": {
        "steps": 25,
        "cfg": 8,
        "sampler": "dpmpp_2m"
      }
    }
  ],
  "count": 4,
  "availableFlags": ["anime", "realistic", "nsfw"]
}
```

#### Get Model Details

```http
GET /models/:filename
```

**Example:**

```bash
curl http://localhost:3030/api/v1/comfyui/models/AnythingXL_xl.safetensors
```

#### Set Active Model

```http
POST /models/active
Content-Type: application/json

{
  "modelFilename": "realismEngineSDXL_v30VAE.safetensors"
}
```

### Status & Health

#### Get ComfyUI Status

```http
GET /status
```

Returns detailed status of all ComfyUI managers (config, models, workflows, deployments).

#### Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "service": "comfyui",
  "version": "v1",
  "timestamp": "2026-01-06T20:30:05.114Z"
}
```

### Image Generation (Testing)

#### Generate Image

```http
POST /generate
Content-Type: application/json

{
  "prompt": "a cute anime girl",
  "model": "AnythingXL_xl.safetensors",
  "workflow": "nsfw-image-generation-api",
  "steps": 20,
  "cfg": 7,
  "width": 1024,
  "height": 1024,
  "negativePrompt": "bad quality, blurry"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Image generated successfully",
  "result": {
    "imageUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "model": "AnythingXL_xl.safetensors",
    "provider": "comfyui",
    "prompt": "a cute anime girl",
    "config": { ... }
  }
}
```

## Usage Examples

### Change Workflow and Model via API

```bash
# Set workflow to anime avatar generation
curl -X POST http://localhost:3030/api/v1/comfyui/workflows/active \
  -H "Content-Type: application/json" \
  -d '{"workflowName": "anime-avatar-generation"}'

# Set model to realistic engine
curl -X POST http://localhost:3030/api/v1/comfyui/models/active \
  -H "Content-Type: application/json" \
  -d '{"modelFilename": "realismEngineSDXL_v30VAE.safetensors"}'

# Check status
curl http://localhost:3030/api/v1/comfyui/status
```

### Filter Models by Flags

```bash
# Get only anime models
curl "http://localhost:3030/api/v1/comfyui/models?flags=anime"

# Get realistic models
curl "http://localhost:3030/api/v1/comfyui/models?flags=realistic"
```

### Generate Test Image

```bash
curl -X POST http://localhost:3030/api/v1/comfyui/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a beautiful landscape",
    "model": "realismEngineSDXL_v30VAE.safetensors",
    "workflow": "nsfw-image-generation-api",
    "steps": 25,
    "cfg": 8,
    "width": 1024,
    "height": 1024
  }'
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "status": "error",
  "message": "Error description",
  "timestamp": "2026-01-06T20:30:05.114Z"
}
```

Common HTTP status codes:

- `400` - Bad Request (missing required parameters)
- `404` - Not Found (workflow/model doesn't exist)
- `500` - Internal Server Error (ComfyUI connection issues, etc.)

## Integration with Discord Bot

The API allows external applications to:

1. **Change workflows** before Discord users generate images
2. **Switch models** based on user preferences or content type
3. **Monitor status** of the ComfyUI system
4. **Reload workflows** when new ones are added
5. **Generate images** programmatically for testing

This enables dynamic configuration without restarting the Discord bot!
