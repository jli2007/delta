# 3D Modeling Rendering Service

A production-ready 3D rendering service built with Blender and Modal, featuring GPU acceleration, web endpoints, and parallel processing.

## Features

- 🎬 **Single Frame Rendering** - Render individual frames from Blender files via HTTP API
- 🎞️ **Video Rendering** - Render multiple frames in parallel and combine into MP4 videos
- ⚡ **GPU Acceleration** - Uses L40S GPUs for 10x+ faster rendering
- 📈 **Auto-Scaling** - Automatically scales to handle multiple concurrent requests
- 🔄 **Lifecycle Management** - Cached rendering service for faster repeated renders
- 📚 **Interactive Docs** - Built-in FastAPI documentation at `/docs`

## Quick Start

### 1. Install Dependencies

```bash
# Install Modal and pydantic (pydantic is needed for local parsing)
pip install modal pydantic
# Or if you need to use --break-system-packages:
pip install --break-system-packages modal pydantic

# Authenticate with Modal
modal token new
```

### 2. Serve the Service

```bash
modal modal/3d_rendering_service.py
```

This will start a development server with auto-reload. You'll see URLs for:
- `/render_frame` - Single frame rendering endpoint
- `/render_video` - Video rendering endpoint
- `/render_cached_frame` - Cached rendering service
- `/docs` - Interactive API documentation

### 3. Deploy Permanently

```bash
modal deploy 15_3d_modeling_service/3d_rendering_service.py
```

This deploys the service permanently - it will stay running even when you close your terminal.

## API Usage

### Render a Single Frame

```python
import requests
import base64

# Read your .blend file
with open("my_scene.blend", "rb") as f:
    blend_data = base64.b64encode(f.read()).decode("utf-8")

# Call the API
response = requests.post(
    "https://your-workspace--render-frame.modal.run",
    json={
        "blend_file_base64": blend_data,
        "frame_number": 1,
        "resolution_x": 1920,
        "resolution_y": 1080,
        "samples": 128
    }
)

result = response.json()
if result["success"]:
    # Decode the PNG image
    image_data = base64.b64decode(result["output_base64"])
    with open("rendered_frame.png", "wb") as f:
        f.write(image_data)
```

### Render a Video

```python
import requests
import base64

with open("my_scene.blend", "rb") as f:
    blend_data = base64.b64encode(f.read()).decode("utf-8")

response = requests.post(
    "https://your-workspace--render-video.modal.run",
    json={
        "blend_file_base64": blend_data,
        "start_frame": 1,
        "end_frame": 250,
        "frame_skip": 1,
        "fps": 24,
        "resolution_x": 1920,
        "resolution_y": 1080,
        "samples": 128
    }
)

result = response.json()
if result["success"]:
    # Decode the MP4 video
    video_data = base64.b64decode(result["output_base64"])
    with open("rendered_video.mp4", "wb") as f:
        f.write(video_data)
    print(f"✅ Rendered {result['frame_count']} frames")
```

### Using cURL

```bash
# Encode blend file
BLEND_B64=$(base64 -i my_scene.blend | tr -d '\n')

# Render frame
curl -X POST "https://your-workspace--render-frame.modal.run" \
  -H "Content-Type: application/json" \
  -d "{
    \"blend_file_base64\": \"$BLEND_B64\",
    \"frame_number\": 1,
    \"resolution_x\": 1920,
    \"resolution_y\": 1080
  }" | jq -r '.output_base64' | base64 -d > output.png
```

## Configuration

### GPU Settings

Edit `3d_rendering_service.py` to change GPU configuration:

```python
USE_GPU = True  # Set to False to use CPUs (can scale to 100+ containers)
GPU_TYPE = "L40S"  # Options: "L40S", "A10G", "H100", "T4", etc.
```

### Rendering Quality

Adjust quality vs speed trade-offs:

- **Samples**: Higher = better quality, slower (default: 128)
  - Low quality: 32-64 samples
  - Medium: 128-256 samples  
  - High: 512-1024 samples
- **Resolution**: Default 1920x1080, increase for 4K rendering

### Scaling Limits

- **With GPU**: Max 10 concurrent containers (default)
- **Without GPU**: Max 100 concurrent containers

## Performance Tips

1. **Use GPU for faster renders** - GPUs render 10x+ faster per frame
2. **Use cached service for repeated renders** - `/render_cached_frame` avoids reloading blend files
3. **Adjust frame_skip for videos** - Render every 2nd or 3rd frame for faster previews
4. **Lower samples for previews** - Use 32-64 samples for quick previews, higher for final renders
5. **Parallel frame rendering** - Video rendering automatically parallelizes across containers

## Architecture

The service consists of:

1. **Rendering Functions** - Core Blender rendering logic with GPU support
2. **Web Endpoints** - FastAPI endpoints for HTTP access
3. **Video Combination** - FFmpeg-based frame-to-video conversion
4. **Cached Service** - Lifecycle-managed class for faster repeated renders

## Example: Render a Blender Animation

If you have the example Blender file from the original examples:

```bash
# Test local rendering
modal run 15_3d_modeling_service/3d_rendering_service.py::test_render_local \
  --blend-file-path 06_gpu_and_ml/blender/IceModal.blend \
  --frame 10
```

## Cost Considerations

- **GPU rendering**: Faster but more expensive per hour
- **CPU rendering**: Slower but can scale to 100+ containers in parallel
- **Auto-scaling**: Containers scale down after inactivity (default: 5 minutes)

## Troubleshooting

### "Blend file not found" errors
- Ensure blend files are base64-encoded correctly
- Check file size limits (Modal has generous limits, but very large files may timeout)

### Slow rendering
- Enable GPU acceleration (`USE_GPU = True`)
- Reduce sample count for previews
- Lower resolution for faster renders
- Use `frame_skip` for video previews

### Authentication errors
- Use proxy authentication for protected endpoints
- See Modal docs for setting up auth tokens

## Related Examples

- `06_gpu_and_ml/blender/blender_video.py` - Original Blender rendering example
- `07_web_endpoints/basic_web.py` - Basic web endpoint patterns
- `01_getting_started/inference_endpoint.py` - GPU-powered inference endpoint

## License

MIT License - See main repository LICENSE file
