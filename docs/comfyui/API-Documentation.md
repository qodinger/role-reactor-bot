# ComfyUI API Documentation

## Overview

ComfyUI provides a comprehensive REST API and WebSocket interface for programmatic workflow execution and system management. The server runs on port **8188** by default and offers both HTTP endpoints for stateless operations and WebSocket connections for real-time execution monitoring.

## API Architecture

- **Base URL**: `http://localhost:8188` (default)
- **WebSocket URL**: `ws://localhost:8188/ws`
- **Content Type**: `application/json`
- **Built on**: aiohttp web framework with asyncio event loop

## Core Workflow Endpoints

### 1. Submit Workflow
**`POST /prompt`**

Submit a workflow for execution to the queue.

**Request Body:**
```json
{
  "prompt": {
    "node_id": {
      "inputs": {...},
      "class_type": "NodeClassName"
    }
  },
  "client_id": "unique-client-id"
}
```

**Response:**
```json
{
  "prompt_id": "uuid",
  "number": 1
}
```

**Error Response:**
```json
{
  "error": "validation error message",
  "node_errors": {...}
}
```

### 2. Queue Management
**`GET /queue`**

Retrieve current execution queue status.

**Response:**
```json
{
  "queue_running": [...],
  "queue_pending": [...]
}
```

**`POST /queue`**

Manage queue operations.

**Request Body:**
```json
{
  "delete": ["prompt_id1", "prompt_id2"],
  "clear": true
}
```

### 3. Execution History
**`GET /history`**

Retrieve complete execution history.

**`GET /history/{prompt_id}`**

Get results for a specific prompt execution.

**Response:**
```json
{
  "prompt_id": {
    "prompt": [...],
    "outputs": {
      "node_id": {
        "images": [
          {
            "filename": "image.png",
            "subfolder": "",
            "type": "output"
          }
        ]
      }
    }
  }
}
```

**`POST /history`**

Clear history or delete specific items.

## Real-Time Communication

### 4. WebSocket Connection
**`WS /ws?clientId={client_id}`**

Establish WebSocket connection for real-time updates.

**Message Types:**
- `progress`: Execution progress updates
- `executing`: Currently executing node
- `executed`: Node execution completed
- `execution_cached`: Cached execution results

**Example Messages:**
```json
{
  "type": "progress",
  "data": {
    "value": 5,
    "max": 20,
    "prompt_id": "uuid"
  }
}

{
  "type": "executing",
  "data": {
    "node": "node_id",
    "prompt_id": "uuid"
  }
}

{
  "type": "executed",
  "data": {
    "node": "node_id",
    "prompt_id": "uuid",
    "output": {...}
  }
}
```

## System Information Endpoints

### 5. Node Information
**`GET /object_info`**

Get complete catalog of available node types with schemas.

**`GET /object_info/{node_class}`**

Get detailed information for a specific node type.

**Response:**
```json
{
  "NodeClassName": {
    "input": {
      "required": {
        "parameter_name": ["TYPE", {"default": value, "min": 0, "max": 100}]
      },
      "optional": {...}
    },
    "output": ["OUTPUT_TYPE"],
    "output_name": ["output_name"],
    "description": "Node description",
    "category": "node_category"
  }
}
```

### 6. System Statistics
**`GET /system_stats`**

Retrieve system information and resource usage.

**Response:**
```json
{
  "system": {
    "python_version": "3.x.x",
    "pytorch_version": "x.x.x",
    "embedded_python": true
  },
  "devices": [...],
  "vram": {
    "total": 8589934592,
    "free": 7516192768
  }
}
```

### 7. Models Management
**`GET /models`**

List available model types/folders.

**`GET /models/{folder}`**

List models in a specific folder.

**Response:**
```json
[
  "model1.safetensors",
  "model2.ckpt"
]
```

### 8. Embeddings
**`GET /embeddings`**

List available embeddings.

## File Management Endpoints

### 9. Image Upload
**`POST /upload/image`**

Upload an image file.

**Form Data:**
- `image`: Image file
- `type`: "input" | "output" | "temp"
- `overwrite`: boolean

### 10. Mask Upload
**`POST /upload/mask`**

Upload a mask file.

**Form Data:**
- `image`: Mask file
- `type`: "input" | "output" | "temp"
- `overwrite`: boolean

### 11. View/Download Images
**`GET /view`**

View or download generated images.

**Query Parameters:**
- `filename`: Image filename
- `subfolder`: Subfolder path
- `type`: "input" | "output" | "temp"

### 12. User Data Management
**`GET /userdata`**

List user data files in specified directory.

**`GET /v2/userdata`**

Enhanced version with structured file/directory listing.

**`GET /userdata/{file}`**

Retrieve specific user data file.

**`POST /userdata/{file}`**

Upload or update user data file.

**`DELETE /userdata/{file}`**

Delete specific user data file.

**`POST /userdata/{file}/move/{dest}`**

Move or rename user data file.

## Control Endpoints

### 13. Interrupt Execution
**`POST /interrupt`**

Stop current workflow execution.

### 14. Free Memory
**`POST /free`**

Free memory by unloading specified models.

**Request Body:**
```json
{
  "unload_models": true,
  "free_memory": true
}
```

## Additional Endpoints

### 15. Extensions
**`GET /extensions`**

List registered extensions with web directories.

### 16. Workflow Templates
**`GET /workflow_templates`**

Get map of custom node modules and associated template workflows.

### 17. Model Metadata
**`GET /view_metadata`**

Retrieve metadata for models.

### 18. User Management
**`GET /users`**

Get user information (multi-user mode).

**`POST /users`**

Create new user (multi-user mode only).

## Registry API (Node Management)

### Node Registry Endpoints

**`GET /api-reference/registry/retrieve-all-nodes`**

List all available custom nodes.

**`GET /api-reference/registry/list-all-node-versions-given-some-filters`**

Filter node versions with specific criteria.

**`POST /api-reference/registry/create-a-new-custom-node`**

Create a new custom node.

**`PUT /api-reference/registry/update-a-specific-node`**

Update existing node.

**`GET /api-reference/registry/retrieve-a-specific-node-by-id`**

Get specific node by ID.

**`POST /api-reference/registry/add-review-to-a-specific-version-of-a-node`**

Add review to node version.

## File Formats

### workflow.json
Complete workflow definition including UI layout, node positions, and visual elements.

```json
{
  "nodes": [
    {
      "id": 1,
      "type": "NodeType",
      "pos": [x, y],
      "size": [width, height],
      "inputs": [...],
      "outputs": [...],
      "properties": {...},
      "widgets_values": [...]
    }
  ],
  "links": [...],
  "groups": [...]
}
```

### workflow_api.json
Streamlined API version without UI elements, optimized for programmatic use.

```json
{
  "node_id": {
    "inputs": {
      "parameter": "value",
      "connection": ["source_node_id", output_index]
    },
    "class_type": "NodeClassName",
    "_meta": {
      "title": "Node Title"
    }
  }
}
```

### object_info.json
Complete node schema catalog with input/output specifications.

```json
{
  "NodeClassName": {
    "input": {
      "required": {...},
      "optional": {...}
    },
    "output": [...],
    "description": "...",
    "category": "..."
  }
}
```

## Usage Examples

### Basic Workflow Execution

```python
import requests
import websocket
import json
import uuid

# 1. Establish WebSocket connection
client_id = str(uuid.uuid4())
ws = websocket.WebSocket()
ws.connect(f"ws://127.0.0.1:8188/ws?clientId={client_id}")

# 2. Submit workflow
workflow = {...}  # Your workflow_api.json content
response = requests.post(
    "http://127.0.0.1:8188/prompt",
    json={"prompt": workflow, "client_id": client_id}
)
prompt_id = response.json()["prompt_id"]

# 3. Monitor progress
while True:
    message = json.loads(ws.recv())
    if message["type"] == "executed" and message["data"]["prompt_id"] == prompt_id:
        break

# 4. Get results
history = requests.get(f"http://127.0.0.1:8188/history/{prompt_id}")
outputs = history.json()[prompt_id]["outputs"]

# 5. Download images
for node_id, node_output in outputs.items():
    if "images" in node_output:
        for image in node_output["images"]:
            image_data = requests.get(
                "http://127.0.0.1:8188/view",
                params={
                    "filename": image["filename"],
                    "subfolder": image["subfolder"],
                    "type": image["type"]
                }
            )
```

### Upload Image

```python
def upload_image(file_path, filename, server_address="127.0.0.1:8188"):
    with open(file_path, 'rb') as file:
        files = {"image": (filename, file, 'image/png')}
        data = {"type": "input", "overwrite": "false"}
        response = requests.post(
            f"http://{server_address}/upload/image",
            files=files,
            data=data
        )
    return response
```

## Error Handling

### Common HTTP Status Codes
- `200`: Success
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `500`: Internal Server Error

### Error Response Format
```json
{
  "error": "Error description",
  "node_errors": {
    "node_id": "Specific node error"
  }
}
```

## Best Practices

1. **Use WebSocket for Long-Running Workflows**: Monitor progress in real-time
2. **Validate Workflows**: Use `/object_info` to validate node inputs before submission
3. **Handle Queue Management**: Check queue status before submitting multiple workflows
4. **Error Handling**: Always check for validation errors in prompt submission
5. **Resource Management**: Use `/free` endpoint to manage memory usage
6. **File Organization**: Use appropriate subfolders for input/output organization

## Rate Limits and Considerations

- No explicit rate limits documented
- Queue system handles multiple concurrent requests
- WebSocket connections should be properly closed
- Large file uploads may have timeout considerations
- Memory management important for resource-intensive workflows

---

*This documentation is based on ComfyUI's official API as documented at https://docs.comfy.org/ and community resources. API endpoints may vary based on ComfyUI version and installed custom nodes.*