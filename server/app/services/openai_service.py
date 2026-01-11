import json
import asyncio
from typing import Optional
import openai

from ..config import get_settings
from ..schemas import PromptCleanResponse, ImageGenerateResponse


class OpenAIService:
    """Service for OpenAI API interactions."""

    STYLE_CONTEXTS = {
        "architectural": "Focus on realistic architectural visualization with clean lines",
        "modern": "Emphasize contemporary design, glass, steel, minimalist aesthetics",
        "classical": "Include classical elements like columns, symmetry, ornate details",
        "futuristic": "Incorporate innovative shapes, sustainable tech, green architecture",
    }

    SYSTEM_PROMPT = """You are an expert architectural visualization prompt engineer.
Your job is to take a user's description of a building or architectural structure and create:
1. A cleaned, clear version of their prompt
2. An optimized DALL-E prompt for generating a photorealistic architectural rendering

For the DALL-E prompt:
- Always specify it's an architectural rendering/visualization
- Include lighting conditions (daylight, golden hour, etc.)
- Specify camera angle (eye-level, aerial, 3/4 view)
- Add material details (glass, steel, concrete, wood)
- Include environment context (urban, suburban, park, waterfront)
- Make it suitable for 3D model extraction (clean lines, visible structure)
- Keep the building as the clear subject with minimal background clutter

Respond in JSON format:
{
    "cleaned_prompt": "Clear description of the building",
    "dalle_prompt": "Full DALL-E optimized prompt",
    "style_tags": ["modern", "glass", "high-rise", etc.]
}"""

    def __init__(self):
        settings = get_settings()
        if not settings.openai_api_key:
            self._client = None
        else:
            self._client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    @property
    def is_configured(self) -> bool:
        """Check if OpenAI is configured."""
        return self._client is not None

    async def clean_prompt(
        self,
        prompt: str,
        style: str = "architectural"
    ) -> PromptCleanResponse:
        """
        Clean and enhance a user prompt for DALL-E.

        Args:
            prompt: User's raw prompt
            style: Architecture style preference

        Returns:
            PromptCleanResponse with cleaned and optimized prompts
        """
        if not self._client:
            raise RuntimeError("OpenAI not configured. Set OPENAI_API_KEY.")

        style_context = self.STYLE_CONTEXTS.get(style, self.STYLE_CONTEXTS["architectural"])

        response = await self._client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": f"Style preference: {style_context}\n\nUser prompt: {prompt}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=500
        )

        result = json.loads(response.choices[0].message.content)

        return PromptCleanResponse(
            original_prompt=prompt,
            cleaned_prompt=result.get("cleaned_prompt", prompt),
            dalle_prompt=result.get("dalle_prompt", prompt),
            style_tags=result.get("style_tags", [])
        )

    async def generate_images(
        self,
        prompt: str,
        num_images: int = 1,
        size: str = "1024x1024",
        quality: str = "hd",
        style: str = "natural"
    ) -> ImageGenerateResponse:
        """
        Generate architectural images with DALL-E 3.

        Args:
            prompt: Optimized DALL-E prompt
            num_images: Number of views to generate (1-4)
            size: Image size
            quality: standard or hd
            style: natural or vivid

        Returns:
            ImageGenerateResponse with image URLs
        """
        if not self._client:
            raise RuntimeError("OpenAI not configured. Set OPENAI_API_KEY.")

        # Create view variations for multi-view
        view_prompts = [
            prompt,
            f"{prompt}, side elevation view, architectural rendering",
            f"{prompt}, aerial view from above, architectural rendering",
            f"{prompt}, 3/4 perspective view, architectural rendering"
        ][:num_images]

        # Generate all images in parallel instead of sequentially
        async def generate_single_image(view_prompt: str):
            response = await self._client.images.generate(
                model="dall-e-3",
                prompt=view_prompt,
                size=size,
                quality=quality,
                style=style,
                n=1
            )
            return response.data[0].url

        # Run all image generations concurrently
        images = await asyncio.gather(*[generate_single_image(p) for p in view_prompts])

        return ImageGenerateResponse(
            images=list(images),
            prompt_used=prompt
        )
