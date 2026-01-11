from typing import Optional
from pydantic import BaseModel, Field


# =============================================================================
# Prompt Cleaning
# =============================================================================

class PromptCleanRequest(BaseModel):
    """Request to clean and enhance a prompt."""
    prompt: str
    style: str = Field(
        default="architectural",
        pattern="^(architectural|modern|classical|futuristic)$"
    )


class PromptCleanResponse(BaseModel):
    """Response with cleaned prompt."""
    original_prompt: str
    cleaned_prompt: str
    dalle_prompt: str
    style_tags: list[str]


# =============================================================================
# Image Generation
# =============================================================================

class ImageGenerateRequest(BaseModel):
    """Request to generate images with DALL-E."""
    prompt: str
    num_images: int = Field(default=1, ge=1, le=4)
    size: str = "1024x1024"
    quality: str = Field(default="hd", pattern="^(standard|hd)$")
    style: str = Field(default="natural", pattern="^(natural|vivid)$")


class ImageGenerateResponse(BaseModel):
    """Response with generated image URLs."""
    images: list[str]
    prompt_used: str


# =============================================================================
# 3D Generation
# =============================================================================

class TrellisRequest(BaseModel):
    """Request to generate 3D with fal.ai Trellis."""
    image_url: Optional[str] = None
    image_urls: Optional[list[str]] = None
    use_multi: bool = False
    seed: Optional[int] = None
    texture_size: int = Field(default=1024, ge=512, le=2048)
    mesh_simplify: float = Field(default=0.95, ge=0.9, le=0.98)
    ss_guidance_strength: float = Field(default=7.5, ge=0, le=10)
    slat_guidance_strength: float = Field(default=3.0, ge=0, le=10)


class TrellisResponse(BaseModel):
    """Response with generated 3D model."""
    model_url: str
    file_name: str
    format: str
    generation_time: float


# =============================================================================
# Full Pipeline
# =============================================================================

class PipelineRequest(BaseModel):
    """Request for full text-to-3D pipeline."""
    prompt: str
    style: str = Field(
        default="architectural",
        pattern="^(architectural|modern|classical|futuristic)$"
    )
    num_views: int = Field(default=1, ge=1, le=4)
    texture_size: int = Field(default=1024, ge=512, le=2048)
    high_quality: bool = True


class PipelineResponse(BaseModel):
    """Response from full pipeline."""
    job_id: str
    status: str
    original_prompt: str
    cleaned_prompt: str
    dalle_prompt: str
    image_urls: list[str]
    model_url: Optional[str] = None
    model_file: Optional[str] = None
    download_url: Optional[str] = None
    total_time: float
    stages: dict


# =============================================================================
# Job Status
# =============================================================================

class JobStatus(BaseModel):
    """Status of an async generation job."""
    job_id: str
    status: str  # pending, cleaning_prompt, generating_images, generating_3d, completed, failed
    progress: int = Field(ge=0, le=100)
    message: str
    result: Optional[PipelineResponse] = None


# =============================================================================
# Upload
# =============================================================================

class UploadResponse(BaseModel):
    """Response from image upload and 3D generation."""
    status: str
    input_file: str
    model_url: str
    model_file: str
    download_url: str
    format: str
    generation_time: float


# =============================================================================
# Preview Workflow (2D first, then 3D in background)
# =============================================================================

class PreviewRequest(BaseModel):
    """Request for 2D preview generation."""
    prompt: str
    style: str = Field(
        default="architectural",
        pattern="^(architectural|modern|classical|futuristic)$"
    )
    num_views: int = Field(default=1, ge=1, le=4)
    high_quality: bool = True


class PreviewResponse(BaseModel):
    """Response with 2D images and job_id for background 3D generation."""
    job_id: str
    status: str  # "images_ready" or "error"
    original_prompt: str
    cleaned_prompt: str
    dalle_prompt: str
    image_urls: list[str]
    message: str


class Start3DRequest(BaseModel):
    """Request to start 3D generation from existing images."""
    job_id: str
    image_urls: list[str]
    texture_size: int = Field(default=1024, ge=512, le=2048)
    use_multi: bool = False


class ThreeDJobStatus(BaseModel):
    """Status of a 3D generation job."""
    job_id: str
    status: str  # "pending", "generating", "completed", "failed"
    progress: int = Field(ge=0, le=100)
    message: str
    model_url: Optional[str] = None
    model_file: Optional[str] = None
    download_url: Optional[str] = None
    generation_time: Optional[float] = None


class ActiveJob(BaseModel):
    """Unified active job representation."""
    job_id: str
    type: str  # "image", "3d", "pipeline"
    status: str
    progress: int = Field(ge=0, le=100)
    message: str


class ActiveJobsResponse(BaseModel):
    """Response listing active jobs only."""
    total_active: int
    image_jobs: int
    three_d_jobs: int
    pipeline_jobs: int
    jobs: list[ActiveJob]
