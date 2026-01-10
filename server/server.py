from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
import os
from pathlib import Path
import base64
import requests

app = FastAPI(title="TripoSR 3D Generation Server (Modal)")

# Modal endpoint - Set this after deploying to Modal
# Get this URL by running: modal serve modal/triposr_service.py
MODAL_ENDPOINT = os.getenv(
    "MODAL_ENDPOINT",
    "http://localhost:8001"  # Fallback for local testing
)

# CORS middleware to allow requests from Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories for uploads and outputs
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


@app.get("/")
async def root():
    return {
        "message": "TripoSR 3D Generation API Server (Modal)",
        "status": "running",
        "version": "3.0.0",
        "model": "StabilityAI TripoSR",
        "backend": "Modal (GPU)",
        "modal_endpoint": MODAL_ENDPOINT
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload an image file for processing
    """
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        # Save uploaded file
        file_path = UPLOAD_DIR / file.filename
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        return {
            "filename": file.filename,
            "path": str(file_path),
            "size": len(content),
            "content_type": file.content_type
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-mesh")
async def generate_mesh(file: UploadFile = File(...)):
    """
    Generate 3D mesh from uploaded image using TripoSR via Modal
    """
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        print(f"Processing image: {file.filename}")
        print(f"Calling Modal endpoint: {MODAL_ENDPOINT}")

        # Read file content
        content = await file.read()

        # Encode image as base64
        image_base64 = base64.b64encode(content).decode('utf-8')

        # Call Modal endpoint
        response = requests.post(
            f"{MODAL_ENDPOINT}/generate_mesh",
            json={
                "image_base64": image_base64,
                "remove_background": True
            },
            timeout=300  # 5 minute timeout
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Modal API error: {response.text}"
            )

        result = response.json()

        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Mesh generation failed: {result.get('message', 'Unknown error')}"
            )

        # Decode and save the OBJ file (TripoSR outputs OBJ)
        obj_bytes = base64.b64decode(result["obj_base64"])
        output_filename = f"{Path(file.filename).stem}.obj"
        output_path = OUTPUT_DIR / output_filename
        output_path.write_bytes(obj_bytes)

        print(f"Mesh saved to: {output_path}")

        return {
            "status": "success",
            "message": "Mesh generation completed via Modal TripoSR",
            "input_file": file.filename,
            "output_file": output_filename,
            "output_path": str(output_path),
            "download_url": f"/download/{output_filename}",
            "format": "obj"
        }

    except requests.exceptions.RequestException as e:
        print(f"Error calling Modal API: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Modal API unavailable: {str(e)}")
    except Exception as e:
        print(f"Error generating mesh: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download/{filename}")
async def download_mesh(filename: str):
    """
    Download generated mesh file
    """
    file_path = OUTPUT_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(file_path),
        media_type="application/octet-stream",
        filename=filename
    )


@app.delete("/cleanup")
async def cleanup_files():
    """
    Clean up uploaded files and generated outputs
    """
    try:
        # Remove files from uploads directory
        for file in UPLOAD_DIR.glob("*"):
            if file.is_file():
                file.unlink()

        # Remove files from outputs directory
        for file in OUTPUT_DIR.glob("*"):
            if file.is_file():
                file.unlink()

        return {"status": "success", "message": "Files cleaned up"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
