# TripoSR on Modal - Complete Setup Guide

We're using **TripoSR** deployed on **Modal** for 3D mesh generation. TripoSR installs cleanly (unlike TRELLIS) and works well for most objects.

## Why TripoSR?

✅ **Works on Modal** - Installs properly (proper pip package)
✅ **Fast** - Generates meshes in 5-10 seconds on A10G GPU
✅ **Cheap** - ~$0.005 per mesh
✅ **Free to try** - Modal gives $30 credit to new users

❌ **Not ideal for buildings** - Edges can get soft (but better than nothing!)

## Step 1: Install Modal

```bash
pip install modal
```

## Step 2: Authenticate with Modal

```bash
modal token new
```

This opens your browser to authenticate. Takes 30 seconds.

## Step 3: Deploy TripoSR to Modal

```bash
cd /Users/jamesli/Documents/Code4/mapbox-delta
modal serve modal/triposr_service.py
```

**Wait 2-5 minutes** for the first build. You'll see:

```
Building image im-...
=> Step 0: FROM base
=> Step 1: RUN apt-get install ...
=> Step 2: RUN pip install triposr
...
✓ Created objects.
✓ Created TripoSRService.generate_mesh => https://yourname--triposr-service-triposrservice-generate-mesh.modal.run
```

**Copy that URL!** It looks like:
```
https://yourname--triposr-service-triposrservice-generate-mesh.modal.run
```

## Step 4: Update Your FastAPI Server

Set the Modal endpoint:

```bash
export MODAL_ENDPOINT="https://yourname--triposr-service-triposrservice-generate-mesh.modal.run"
```

Or edit `server/server.py` line 14-17:
```python
MODAL_ENDPOINT = os.getenv(
    "MODAL_ENDPOINT",
    "https://yourname--triposr-service-triposrservice-generate-mesh.modal.run"
)
```

## Step 5: Restart Your Server

```bash
cd /Users/jamesli/Documents/Code4/mapbox-delta/server
python3 server.py
```

## Step 6: Test It!

Visit **http://localhost:8000/docs**

1. Go to `POST /generate-mesh`
2. Click "Try it out"
3. Upload your image
4. Click "Execute"
5. Wait 10-20 seconds
6. Download your `.obj` file!

## Architecture

```
User uploads image
    ↓
FastAPI Server (localhost:8000) - Your Mac
    ↓
Modal TripoSR Service - A10G GPU in cloud
    ↓
Returns .obj file
    ↓
User downloads
```

## Cost

Modal A10G pricing:
- **~$1.10/hour** when running
- **$0** when idle (auto-scales to 0)
- **Typical generation**: 5-10 seconds

Example costs:
- **100 meshes**: ~$0.15-0.30
- **1000 meshes**: ~$1.50-3.00

Compare to:
- **fal.ai**: $0.25 per mesh = $25 for 100 meshes
- **HF Spaces**: Free but unreliable

## Quality for Buildings

TripoSR is trained on general objects, not specifically buildings:
- ✅ Works for toy buildings, miniatures
- ⚠️ **Edges get soft** on real buildings
- ⚠️ **Less detail** than TRELLIS would be
- ✅ Better than nothing!

**For production architectural work**, you'd want:
- Multi-view photogrammetry
- TRELLIS (but it doesn't install on Modal)
- Paid service like fal.ai with TRELLIS

## Deploy to Production

Once you're happy with testing:

```bash
modal deploy modal/triposr_service.py
```

This makes it permanent (stays running even when you close terminal).

## Monitoring

```bash
# View logs
modal app logs triposr-service

# List deployments
modal app list

# Stop deployment
modal app stop triposr-service
```

## Troubleshooting

### "Module not found" during build
Modal is still downloading dependencies. Wait 2-5 minutes for first build.

### Slow first request (cold start)
First request after idle loads the model (~10-20 seconds). Then fast.

### Out of memory
A10G has 24GB VRAM - should be plenty. If it fails, try A100.

### Modal endpoint not set
Update the `MODAL_ENDPOINT` in server/server.py or set environment variable.

## What's Running Where

**On Your Mac:**
- FastAPI server (server/server.py)
- Receives uploads from frontend
- Calls Modal API
- Returns results

**On Modal (Linux Cloud):**
- TripoSR model
- A10G GPU
- Auto-scales 0→∞
- Generates meshes

**You never run TripoSR locally!** Your Mac just calls the API.

## Next Steps

1. **Deploy to Modal**: `modal serve modal/triposr_service.py`
2. **Get the URL** from the output
3. **Set MODAL_ENDPOINT** in server
4. **Restart server**: `python3 server.py`
5. **Test**: Upload image at http://localhost:8000/docs
6. **Download**: Get your .obj file!

Good luck! 🚀
