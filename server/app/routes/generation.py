import time
import uuid
from fastapi import APIRouter, HTTPException, BackgroundTasks

from ..services import OpenAIService, FalService
from ..schemas import (
    PromptCleanRequest,
    PromptCleanResponse,
    ImageGenerateRequest,
    ImageGenerateResponse,
    TrellisRequest,
    TrellisResponse,
    PipelineRequest,
    PipelineResponse,
    JobStatus,
    PreviewRequest,
    PreviewResponse,
    Start3DRequest,
    ThreeDJobStatus,
    ActiveJob,
    ActiveJobsResponse,
)

router = APIRouter(tags=["Generation"])

# In-memory job storage (use Redis for production)
jobs: dict[str, JobStatus] = {}
three_d_jobs: dict[str, ThreeDJobStatus] = {}
image_jobs: dict[str, dict] = {}  # Tracks image generation jobs


# =============================================================================
# Individual Stage Endpoints
# =============================================================================

@router.post("/clean-prompt", response_model=PromptCleanResponse)
async def clean_prompt(request: PromptCleanRequest):
    """
    Clean and enhance user prompt for architectural 3D generation.
    Uses GPT-4 to create optimized prompts for DALL-E.
    """
    openai_svc = OpenAIService()
    if not openai_svc.is_configured:
        raise HTTPException(status_code=503, detail="OpenAI not configured. Set OPENAI_API_KEY.")

    try:
        return await openai_svc.clean_prompt(request.prompt, request.style)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt cleaning failed: {e}")


@router.post("/generate-image", response_model=ImageGenerateResponse)
async def generate_image(request: ImageGenerateRequest):
    """
    Generate architectural 2D images using DALL-E 3.
    Can generate multiple views for multi-image Trellis mode.
    """
    openai_svc = OpenAIService()
    if not openai_svc.is_configured:
        raise HTTPException(status_code=503, detail="OpenAI not configured. Set OPENAI_API_KEY.")

    try:
        return await openai_svc.generate_images(
            prompt=request.prompt,
            num_images=request.num_images,
            size=request.size,
            quality=request.quality,
            style=request.style
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {e}")


@router.post("/generate-3d", response_model=TrellisResponse)
async def generate_3d(request: TrellisRequest):
    """
    Generate 3D model from image(s) using fal.ai Trellis.
    Outputs GLB format with PBR textures.
    """
    fal_svc = FalService()
    if not fal_svc.is_configured:
        raise HTTPException(status_code=503, detail="fal.ai not configured. Set FAL_KEY.")

    if not request.image_url and not request.image_urls:
        raise HTTPException(status_code=400, detail="Must provide image_url or image_urls")

    try:
        return await fal_svc.generate_3d(
            image_url=request.image_url,
            image_urls=request.image_urls,
            use_multi=request.use_multi,
            seed=request.seed,
            texture_size=request.texture_size,
            mesh_simplify=request.mesh_simplify,
            ss_guidance_strength=request.ss_guidance_strength,
            slat_guidance_strength=request.slat_guidance_strength
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"3D generation failed: {e}")


# =============================================================================
# Full Pipeline
# =============================================================================

@router.post("/generate-architecture", response_model=PipelineResponse)
async def generate_architecture(request: PipelineRequest):
    """
    Full pipeline: Text prompt → Clean → DALL-E 2D → Trellis 3D GLB

    This is the main endpoint for architecture generation.
    For better quality, use num_views=2-4 with high_quality=True.
    """
    openai_svc = OpenAIService()
    fal_svc = FalService()

    if not openai_svc.is_configured:
        raise HTTPException(status_code=503, detail="OpenAI not configured")
    if not fal_svc.is_configured:
        raise HTTPException(status_code=503, detail="fal.ai not configured")

    job_id = uuid.uuid4().hex
    start_time = time.time()
    stages = {}

    try:
        # Stage 1: Clean prompt
        stage_start = time.time()
        clean_result = await openai_svc.clean_prompt(request.prompt, request.style)
        stages["prompt_cleaning"] = time.time() - stage_start

        # Stage 2: Generate images
        stage_start = time.time()
        image_result = await openai_svc.generate_images(
            prompt=clean_result.dalle_prompt,
            num_images=request.num_views,
            quality="hd" if request.high_quality else "standard"
        )
        stages["image_generation"] = time.time() - stage_start

        # Stage 3: Generate 3D
        stage_start = time.time()
        use_multi = request.num_views > 1 and len(image_result.images) > 1

        trellis_result = await fal_svc.generate_3d(
            image_url=image_result.images[0] if not use_multi else None,
            image_urls=image_result.images if use_multi else None,
            use_multi=use_multi,
            texture_size=request.texture_size
        )
        stages["3d_generation"] = time.time() - stage_start

        return PipelineResponse(
            job_id=job_id,
            status="completed",
            original_prompt=request.prompt,
            cleaned_prompt=clean_result.cleaned_prompt,
            dalle_prompt=clean_result.dalle_prompt,
            image_urls=image_result.images,
            model_url=trellis_result.model_url,
            model_file=trellis_result.file_name,
            download_url=f"/download/{trellis_result.file_name}",
            total_time=time.time() - start_time,
            stages=stages
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {e}")


# =============================================================================
# Async Pipeline
# =============================================================================

async def _run_pipeline_async(job_id: str, request: PipelineRequest):
    """Background task for async pipeline execution."""
    openai_svc = OpenAIService()
    fal_svc = FalService()

    jobs[job_id] = JobStatus(
        job_id=job_id,
        status="pending",
        progress=0,
        message="Starting pipeline..."
    )

    try:
        # Stage 1
        jobs[job_id].status = "cleaning_prompt"
        jobs[job_id].progress = 10
        jobs[job_id].message = "Cleaning prompt with AI..."

        clean_result = await openai_svc.clean_prompt(request.prompt, request.style)

        # Stage 2
        jobs[job_id].status = "generating_images"
        jobs[job_id].progress = 30
        jobs[job_id].message = "Generating 2D images with DALL-E..."

        image_result = await openai_svc.generate_images(
            prompt=clean_result.dalle_prompt,
            num_images=request.num_views,
            quality="hd" if request.high_quality else "standard"
        )

        # Stage 3
        jobs[job_id].status = "generating_3d"
        jobs[job_id].progress = 60
        jobs[job_id].message = "Generating 3D model with Trellis..."

        use_multi = request.num_views > 1 and len(image_result.images) > 1

        trellis_result = await fal_svc.generate_3d(
            image_url=image_result.images[0] if not use_multi else None,
            image_urls=image_result.images if use_multi else None,
            use_multi=use_multi,
            texture_size=request.texture_size
        )

        # Complete
        jobs[job_id].status = "completed"
        jobs[job_id].progress = 100
        jobs[job_id].message = "3D model ready!"
        jobs[job_id].result = PipelineResponse(
            job_id=job_id,
            status="completed",
            original_prompt=request.prompt,
            cleaned_prompt=clean_result.cleaned_prompt,
            dalle_prompt=clean_result.dalle_prompt,
            image_urls=image_result.images,
            model_url=trellis_result.model_url,
            model_file=trellis_result.file_name,
            download_url=f"/download/{trellis_result.file_name}",
            total_time=0,
            stages={}
        )

    except Exception as e:
        jobs[job_id].status = "failed"
        jobs[job_id].progress = 0
        jobs[job_id].message = f"Error: {e}"


@router.post("/generate-architecture-async")
async def generate_architecture_async(
    request: PipelineRequest,
    background_tasks: BackgroundTasks
):
    """
    Async version of the full pipeline.
    Returns immediately with a job_id to poll for status.
    """
    openai_svc = OpenAIService()
    fal_svc = FalService()

    if not openai_svc.is_configured:
        raise HTTPException(status_code=503, detail="OpenAI not configured")
    if not fal_svc.is_configured:
        raise HTTPException(status_code=503, detail="fal.ai not configured")

    job_id = uuid.uuid4().hex
    background_tasks.add_task(_run_pipeline_async, job_id, request)

    return {
        "job_id": job_id,
        "status": "started",
        "poll_url": f"/job/{job_id}"
    }


@router.get("/job/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get status of an async generation job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


# =============================================================================
# Preview Workflow (2D first, then 3D in background)
# =============================================================================

@router.post("/generate-preview", response_model=PreviewResponse)
async def generate_preview(request: PreviewRequest):
    """
    Generate 2D images immediately and return them.
    Does NOT start 3D generation - call /start-3d separately.
    
    This enables the workflow:
    1. User enters prompt → sees 2D images immediately
    2. User can refine prompt and regenerate images
    3. When satisfied, user starts 3D generation
    """
    openai_svc = OpenAIService()
    
    if not openai_svc.is_configured:
        raise HTTPException(status_code=503, detail="OpenAI not configured")
    
    job_id = uuid.uuid4().hex
    
    # Track image generation job
    image_jobs[job_id] = {
        "job_id": job_id,
        "status": "generating",
        "progress": 10,
        "message": "Cleaning prompt..."
    }
    
    try:
        # Stage 1: Clean prompt
        clean_result = await openai_svc.clean_prompt(request.prompt, request.style)
        
        # Stage 2: Generate images
        image_jobs[job_id]["progress"] = 30
        image_jobs[job_id]["message"] = f"Generating {request.num_views} image(s) with DALL-E..."
        
        image_result = await openai_svc.generate_images(
            prompt=clean_result.dalle_prompt,
            num_images=request.num_views,
            quality="hd" if request.high_quality else "standard"
        )
        
        # Remove from active jobs when complete
        del image_jobs[job_id]
        
        return PreviewResponse(
            job_id=job_id,
            status="images_ready",
            original_prompt=request.prompt,
            cleaned_prompt=clean_result.cleaned_prompt,
            dalle_prompt=clean_result.dalle_prompt,
            image_urls=image_result.images,
            message="2D images ready! Click Finish to generate 3D model."
        )
        
    except Exception as e:
        # Remove from active jobs on error
        if job_id in image_jobs:
            del image_jobs[job_id]
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {e}")


async def _run_3d_generation(job_id: str, image_urls: list[str], texture_size: int, use_multi: bool):
    """Background task for 3D generation."""
    import time
    fal_svc = FalService()
    
    three_d_jobs[job_id] = ThreeDJobStatus(
        job_id=job_id,
        status="generating",
        progress=10,
        message="Starting 3D model generation..."
    )
    
    try:
        start_time = time.time()
        
        # Update progress
        three_d_jobs[job_id].progress = 30
        three_d_jobs[job_id].message = "Processing images with Trellis..."
        
        result = await fal_svc.generate_3d(
            image_url=image_urls[0] if not use_multi else None,
            image_urls=image_urls if use_multi else None,
            use_multi=use_multi,
            texture_size=texture_size
        )
        
        generation_time = time.time() - start_time
        
        three_d_jobs[job_id].status = "completed"
        three_d_jobs[job_id].progress = 100
        three_d_jobs[job_id].message = "3D model ready!"
        three_d_jobs[job_id].model_url = result.model_url
        three_d_jobs[job_id].model_file = result.file_name
        three_d_jobs[job_id].download_url = f"/download/{result.file_name}"
        three_d_jobs[job_id].generation_time = generation_time
        
    except Exception as e:
        three_d_jobs[job_id].status = "failed"
        three_d_jobs[job_id].progress = 0
        three_d_jobs[job_id].message = f"Error: {e}"


@router.post("/start-3d")
async def start_3d_generation(
    request: Start3DRequest,
    background_tasks: BackgroundTasks
):
    """
    Start 3D generation in background from existing images.
    Returns immediately with job_id to poll for status.
    """
    fal_svc = FalService()
    
    if not fal_svc.is_configured:
        raise HTTPException(status_code=503, detail="fal.ai not configured")
    
    if not request.image_urls:
        raise HTTPException(status_code=400, detail="No images provided")
    
    # Initialize job status
    three_d_jobs[request.job_id] = ThreeDJobStatus(
        job_id=request.job_id,
        status="pending",
        progress=0,
        message="Queued for 3D generation..."
    )
    
    # Determine if multi-view
    use_multi = request.use_multi and len(request.image_urls) > 1
    
    # Start background task
    background_tasks.add_task(
        _run_3d_generation,
        request.job_id,
        request.image_urls,
        request.texture_size,
        use_multi
    )
    
    return {
        "job_id": request.job_id,
        "status": "started",
        "poll_url": f"/3d-job/{request.job_id}"
    }


@router.get("/3d-job/{job_id}", response_model=ThreeDJobStatus)
async def get_3d_job_status(job_id: str):
    """Get status of a 3D generation job."""
    if job_id not in three_d_jobs:
        raise HTTPException(status_code=404, detail="3D job not found")
    return three_d_jobs[job_id]


@router.get("/jobs", response_model=ActiveJobsResponse)
async def list_active_jobs():
    """
    List all currently active jobs (image generation, 3D generation, pipelines).
    Only shows jobs that are in progress, not completed or failed.
    """
    active_jobs: list[ActiveJob] = []
    
    # Collect active image generation jobs
    for job_id, job in image_jobs.items():
        active_jobs.append(ActiveJob(
            job_id=job_id,
            type="image",
            status=job["status"],
            progress=job["progress"],
            message=job["message"]
        ))
    
    # Collect active 3D generation jobs
    for job_id, job in three_d_jobs.items():
        if job.status in ("pending", "generating"):
            active_jobs.append(ActiveJob(
                job_id=job_id,
                type="3d",
                status=job.status,
                progress=job.progress,
                message=job.message
            ))
    
    # Collect active pipeline jobs
    for job_id, job in jobs.items():
        if job.status not in ("completed", "failed"):
            active_jobs.append(ActiveJob(
                job_id=job_id,
                type="pipeline",
                status=job.status,
                progress=job.progress,
                message=job.message
            ))
    
    # Count by type
    image_count = sum(1 for j in active_jobs if j.type == "image")
    three_d_count = sum(1 for j in active_jobs if j.type == "3d")
    pipeline_count = sum(1 for j in active_jobs if j.type == "pipeline")
    
    # Sort by progress (lower progress = earlier in pipeline)
    active_jobs.sort(key=lambda j: j.progress)
    
    return ActiveJobsResponse(
        total_active=len(active_jobs),
        image_jobs=image_count,
        three_d_jobs=three_d_count,
        pipeline_jobs=pipeline_count,
        jobs=active_jobs
    )


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """
    Cancel a running job. Marks it as cancelled and removes from active tracking.
    Works for 3D jobs, image jobs, and pipeline jobs.
    """
    cancelled = False
    job_type = None
    
    # Check and cancel 3D job
    if job_id in three_d_jobs:
        job = three_d_jobs[job_id]
        if job.status in ("pending", "generating"):
            three_d_jobs[job_id].status = "cancelled"
            three_d_jobs[job_id].message = "Job cancelled by user"
            del three_d_jobs[job_id]
            cancelled = True
            job_type = "3d"
    
    # Check and cancel image job
    if job_id in image_jobs:
        del image_jobs[job_id]
        cancelled = True
        job_type = "image"
    
    # Check and cancel pipeline job
    if job_id in jobs:
        job = jobs[job_id]
        if job.status not in ("completed", "failed"):
            jobs[job_id].status = "cancelled"
            jobs[job_id].message = "Job cancelled by user"
            del jobs[job_id]
            cancelled = True
            job_type = "pipeline"
    
    if not cancelled:
        raise HTTPException(status_code=404, detail="Active job not found")
    
    return {"status": "cancelled", "job_id": job_id, "type": job_type}


@router.delete("/jobs/cleanup")
async def cleanup_finished_jobs():
    """
    Clean up completed and failed jobs from memory.
    Useful for freeing up memory after jobs are done.
    """
    # Clean up completed/failed 3D jobs
    three_d_to_delete = [
        job_id for job_id, job in three_d_jobs.items() 
        if job.status in ("completed", "failed")
    ]
    for job_id in three_d_to_delete:
        del three_d_jobs[job_id]
    
    # Clean up completed/failed pipeline jobs
    pipeline_to_delete = [
        job_id for job_id, job in jobs.items() 
        if job.status in ("completed", "failed")
    ]
    for job_id in pipeline_to_delete:
        del jobs[job_id]
    
    return {
        "status": "cleaned",
        "three_d_jobs_removed": len(three_d_to_delete),
        "pipeline_jobs_removed": len(pipeline_to_delete)
    }
