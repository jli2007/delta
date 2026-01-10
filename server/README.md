# TRELLIS 3D Generation Server (Hugging Face)

This FastAPI server provides image-to-3D mesh generation using Microsoft's TRELLIS via **Hugging Face Spaces** (free!).

## Features

✅ **Free** - Uses Hugging Face's free tier
✅ **No GPU needed locally** - Runs on HF's cloud GPUs
✅ **Production-quality** - Microsoft TRELLIS model
✅ **Easy setup** - Just install dependencies

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/jamesli/Documents/Code4/mapbox-delta/server
pip install -r requirements.txt
```

### 2. Run the Server

```bash
python server.py
```

Server will start on `http://localhost:8000`

### 3. Test It

Visit `http://localhost:8000/docs` for interactive API docs.

Or test with curl:
```bash
curl -X POST "http://localhost:8000/generate-mesh" \
  -F "file=@your-image.jpg"
```

## How It Works

```
User uploads image
    ↓
Your FastAPI Server (localhost:8000)
    ↓
Hugging Face Spaces (JeffreyXiang/TRELLIS-Demo)
    ↓
TRELLIS generates 3D mesh on HF's GPU (free!)
    ↓
GLB file returned to user
```

## Endpoints

### `GET /`
Health check and server info

### `GET /health`
Health check endpoint

### `POST /generate-mesh`
Upload an image, get a 3D mesh (.glb file)

**Input:**
- `file`: Image file (JPG, PNG, etc.)

**Output:**
```json
{
  "status": "success",
  "message": "Mesh generation completed via Hugging Face",
  "input_file": "building.jpg",
  "output_file": "building.glb",
  "download_url": "/download/building.glb",
  "format": "glb"
}
```

### `GET /download/{filename}`
Download generated mesh file

## Performance

**First request**: 30-60 seconds (HF Space needs to load)
**Subsequent requests**: 15-30 seconds per mesh

⚠️ **HF Spaces can timeout** if many people are using it. If this happens:
- Try again (it usually works on retry)
- Or upgrade to fal.ai ($0.25/mesh) or Modal (needs setup)

## Output Format

TRELLIS outputs **GLB files**, which include:
- 3D geometry
- PBR materials (roughness, metallic)
- Can be viewed in:
  - Blender
  - three.js (web)
  - Any 3D viewer

## Limitations

❌ **Shared resources** - HF Spaces is free but shared
❌ **Can timeout** - If server is busy
❌ **Slower than paid options** - But free!
✅ **Good quality** - Same model as fal.ai

## Input Requirements

Works best with:
- **Single objects** (buildings, furniture, products)
- **Clear images** with good lighting
- **Simple backgrounds** (auto-removed)

## Cost

**$0** - Completely free!

## Troubleshooting

### "Connection timeout"
HF Space is overloaded. Wait and try again.

### "Space is building"
First request after idle. Wait 30-60 seconds.

### "Model not found"
The HF Space might be down. Check: https://huggingface.co/spaces/JeffreyXiang/TRELLIS-Demo

### GLB file won't open
Try viewing in:
- Blender (free)
- https://gltf-viewer.donmccurdy.com/
- three.js viewer online

## Upgrading

If HF Spaces is too slow or unreliable:

**Option 1: fal.ai** ($0.25/mesh)
- Same model
- Faster, more reliable
- Requires API key and payment

**Option 2: Modal** (DIY, ~$0.01/mesh)
- Deploy your own instance
- Full control
- More complex setup

## Next Steps

1. Test with your building images
2. If quality is good but too slow → Consider fal.ai
3. If quality not good for buildings → Try photogrammetry instead

## Support

- Hugging Face Space: https://huggingface.co/spaces/JeffreyXiang/TRELLIS-Demo
- TRELLIS repo: https://github.com/microsoft/TRELLIS.2
