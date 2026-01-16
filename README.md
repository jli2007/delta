# Mapbox Delta - 3D Generation Platform

> Built for DeltaHacks 12


A full-stack application for generating 3D meshes from images using TripoSR, powered by Modal's GPU infrastructure.

## Architecture

```
┌─────────────────┐
│  Next.js        │  (localhost:3000)
│  Frontend       │  - Image upload UI
└────────┬────────┘  - 3D model preview
         │
         ↓
┌─────────────────┐
│  FastAPI        │  (localhost:8000)
│  Server         │  - File handling
└────────┬────────┘  - API proxy
         │
         ↓
┌─────────────────┐
│  Modal          │  (Cloud GPU)
│  TripoSR        │  - A10G GPU
└─────────────────┘  - 3D generation
                     - Auto-scaling
```

## Project Structure

```
mapbox-delta/
├── client/              # Next.js frontend
│   ├── app/            # Next.js 13+ app directory
│   ├── public/         # Static assets
│   └── package.json    # Node dependencies
│
├── server/              # FastAPI backend (lightweight proxy)
│   ├── server.py       # Main API server
│   ├── requirements.txt # Python dependencies (minimal)
│   ├── venv/           # Python virtual environment
│   └── README.md       # Server setup guide
│
└── modal/               # GPU-powered 3D generation service
    ├── triposr_service.py      # Modal deployment
    ├── TRIPOSR_README.md       # Modal setup guide
    ├── 3d_rendering_service.py # (example: Blender rendering)
    └── example_client.py       # (example client code)
```

## Quick Start

### 1. Frontend (Next.js)

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:3000`

### 2. Backend Server (FastAPI)

```bash
cd server

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
python server.py
```

Runs on `http://localhost:8000`

### 3. Modal Service (GPU Backend)

```bash
# Install Modal
pip install modal

# Authenticate
modal token new

# Deploy service
cd modal
modal serve triposr_service.py
```

Copy the Modal endpoint URL and set it:

```bash
export MODAL_ENDPOINT="https://your-modal-url-here"
```

Or edit `server/server.py` and update the `MODAL_ENDPOINT` variable.

## Features

- ✅ **Image-to-3D Generation** - Convert single images to 3D meshes
- ✅ **GPU Acceleration** - Fast generation on Modal's A10G GPUs
- ✅ **Auto-scaling** - Scales to 0 when idle, scales up on demand
- ✅ **Background Removal** - Automatic background removal for clean meshes
- ✅ **Multiple Formats** - Export as .obj or .glb files
- ✅ **Pay-per-use** - Only pay for compute time (~$0.001-0.003 per mesh)

## Technology Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling

### Backend
- **FastAPI** - Modern Python web framework
- **Python 3.14.2** - Latest Python version
- **Minimal dependencies** - No GPU or ML libraries needed locally

### ML/GPU Service
- **Modal** - Serverless GPU infrastructure
- **TripoSR** - State-of-the-art image-to-3D model
- **PyTorch** - Deep learning framework
- **A10G GPU** - GPU acceleration

## System Requirements

### Local Development
- **Node.js 18+** - For Next.js frontend
- **Python 3.10+** - For FastAPI backend (tested on 3.14.2)
- **No GPU needed** - Modal handles GPU compute

### Modal Account (Free Tier Available)
- Sign up at [modal.com](https://modal.com)
- Free credits included for testing
- Pay-as-you-go for production

## Environment Variables

### Server (.env or export)
```bash
MODAL_ENDPOINT="https://your-modal-url-here"
```

### Client (.env.local)
```bash
NEXT_PUBLIC_API_URL="http://localhost:8000"
```

## API Endpoints

### FastAPI Server (localhost:8000)

- `GET /` - Server info and health
- `GET /health` - Health check
- `POST /upload` - Upload image file
- `POST /generate-mesh` - Generate 3D mesh (proxies to Modal)
- `GET /download/{filename}` - Download generated mesh
- `DELETE /cleanup` - Clean up files

Interactive docs: `http://localhost:8000/docs`

### Modal Service (Cloud)

- `POST /generate_mesh` - Generate mesh from base64 image
- `GET /health` - Health check

Interactive docs: `https://your-modal-url/docs`

## Development Workflow

1. **Start frontend**: `cd client && npm run dev`
2. **Start backend**: `cd server && source venv/bin/activate && python server.py`
3. **Deploy Modal**: `cd modal && modal serve triposr_service.py`
4. **Upload image** via frontend at localhost:3000
5. **Download mesh** when generation completes

## Cost Breakdown

### Local Development: **Free**
- Next.js frontend: Free
- FastAPI server: Free (no GPU needed)

### Modal Production: **~$0.001-0.003 per mesh**
- A10G GPU: ~$1.10/hour
- Average generation: 5-10 seconds
- Idle time: Free (auto-scales to 0)

### Example Monthly Costs:
- 100 meshes: ~$0.15-0.30
- 1,000 meshes: ~$1.50-3.00
- 10,000 meshes: ~$15-30

## Deployment

### Frontend
Deploy to Vercel, Netlify, or any Node.js host:
```bash
cd client
npm run build
```

### Backend
Deploy to Railway, Render, or any Python host:
```bash
cd server
# Set MODAL_ENDPOINT environment variable
# Deploy with your platform's CLI
```

### Modal Service
Already deployed to Modal's cloud:
```bash
cd modal
modal deploy triposr_service.py
```

## Troubleshooting

### "Connection refused" errors
- Ensure all three services are running (frontend, backend, Modal)
- Check that MODAL_ENDPOINT is set correctly
- Verify Modal service: `modal app list`

### "Module not found" errors
- Activate virtual environment: `source venv/bin/activate`
- Install dependencies: `pip install -r requirements.txt`
- For Node: `npm install`

### Modal cold starts
- First request after idle takes 5-10 seconds (container startup)
- Subsequent requests are fast (<10 seconds)

### Low quality meshes
- Use clear, well-lit images
- Single objects work best (not complex scenes)
- Clean backgrounds help (or let rembg remove it)

## Documentation

- [Server Setup](./server/README.md) - FastAPI backend setup
- [Modal Setup](./modal/TRIPOSR_README.md) - GPU service deployment
- [TripoSR GitHub](https://github.com/VAST-AI-Research/TripoSR) - TripoSR model
- [Modal Docs](https://modal.com/docs) - Modal platform documentation

## License

MIT

---

**Built with ❤️ for DeltaHacks 12 using Next.js, FastAPI, and Modal**
