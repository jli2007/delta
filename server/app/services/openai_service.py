import json
import asyncio
from typing import Optional
import openai

from ..config import get_settings
from ..schemas import PromptCleanResponse, ImageGenerateResponse


class OpenAIService:
    """Service for OpenAI API interactions."""

    SEARCH_INTENT_PROMPT = """You are an intelligent map assistant for a 3D architecture visualization platform. Parse user queries to understand their intent.

Analyze the query and extract:
1. **action**: One of:
   - "navigate" - User wants to go to a specific named location OR a famous landmark/structure (e.g., "take me to Paris", "go to Empire State Building", "tallest building in Toronto")
   - "find_building" - User wants to find a building by characteristics in the current view (e.g., "tallest building here", "biggest footprint")
   - "search_area" - User wants to explore an area (e.g., "what buildings are here")
   - "set_weather" - User wants to change weather effects (e.g., "make it rain", "add snow", "clear weather", "stop raining")
   - "set_time" - User wants to change time of day (e.g., "switch to night", "make it daytime", "night mode")
   - "camera_control" - User wants to adjust the camera view (e.g., "zoom in", "zoom out", "show from above", "tilt the view", "bird's eye view")
   - "delete_building" - User wants to remove a building (e.g., "delete the building at 123 Main St", "remove the CN Tower")
   - "question" - User is asking a question that needs an answer, not an action (e.g., "how tall is the CN Tower?", "what year was this built?", "what's the population of Toronto?")

IMPORTANT:
- If the user asks for the "tallest building in [city]" or similar, and that city has a famous iconic tall structure (like CN Tower in Toronto, Burj Khalifa in Dubai, Empire State Building in NYC, Eiffel Tower in Paris, etc.), use "navigate" action with the landmark name as location_query.
- Handle typos and casual language gracefully (e.g., "mak it rain" -> set_weather, "nite mode" -> set_time)

2. **location_query**: The location mentioned (city, landmark, address, neighborhood)
   - **CRITICAL**: Fix any spelling errors in location names (e.g., "anjing" -> "Anqing", "pariss" -> "Paris", "tokyoo" -> "Tokyo")
   - Use your knowledge to correct misspelled cities, landmarks, and place names
   - For famous landmarks, include the landmark name: "CN Tower, Toronto", "Burj Khalifa, Dubai"
   - Extract exact location names: "Central Park", "Tokyo", "Empire State Building"
   - If relative ("near here", "in this area", "around me"), set to null

3. **building_attributes**: For building searches (not navigation), extract:
   - sort_by: "height" (tallest), "area" (biggest footprint), "underdeveloped" (large footprint + low height), or null
   - building_type: "commercial", "residential", "any" (default: "any")
   - limit: number of results wanted (default: 5)

4. **search_radius_km**: If proximity search mentioned ("within 2km", "nearby" = 1km)

5. **weather_settings**: For set_weather action:
   - type: "rain", "snow", or "clear"

6. **time_settings**: For set_time action:
   - preset: "day" or "night"

7. **camera_settings**: For camera_control action:
   - zoom_delta: positive number to zoom in, negative to zoom out (e.g., +2, -2)
   - pitch: 0 for top-down view, 60 for angled view, or "increase"/"decrease" for relative change
   - bearing_delta: rotation in degrees (positive = clockwise)

8. **question_context**: For question action:
   - subject: what the question is about ("building_height", "building_info", "general_knowledge", etc.)
   - target_name: specific building/landmark name if mentioned

Respond in JSON format:
{
    "action": "navigate|find_building|search_area|set_weather|set_time|camera_control|delete_building|question",
    "location_query": "string or null",
    "building_attributes": {"sort_by": "height|area|underdeveloped|null", "building_type": "any", "limit": 5} or null,
    "search_radius_km": number or null,
    "weather_settings": {"type": "rain|snow|clear"} or null,
    "time_settings": {"preset": "day|night"} or null,
    "camera_settings": {"zoom_delta": number, "pitch": number or string, "bearing_delta": number} or null,
    "question_context": {"subject": string, "target_name": string} or null,
    "reasoning": "Brief explanation of your interpretation"
}

Examples:
- "take me to the Eiffel Tower" -> {"action": "navigate", "location_query": "Eiffel Tower, Paris", ...}
- "take me to anjing, anhui" -> {"action": "navigate", "location_query": "Anqing, Anhui", "reasoning": "Corrected spelling: anjing -> Anqing"}
- "go to pariss" -> {"action": "navigate", "location_query": "Paris", "reasoning": "Corrected spelling: pariss -> Paris"}
- "find the tallest building" -> {"action": "find_building", "location_query": null, "building_attributes": {"sort_by": "height", ...}, ...}
- "make it rain" -> {"action": "set_weather", "weather_settings": {"type": "rain"}, "reasoning": "User wants rain effect"}
- "switch to night" -> {"action": "set_time", "time_settings": {"preset": "night"}, "reasoning": "User wants night mode"}
- "zoom in" -> {"action": "camera_control", "camera_settings": {"zoom_delta": 2}, "reasoning": "User wants to zoom in"}
- "show from above" -> {"action": "camera_control", "camera_settings": {"pitch": 0}, "reasoning": "User wants bird's eye view"}
- "delete the CN Tower" -> {"action": "delete_building", "location_query": "CN Tower, Toronto", "reasoning": "User wants to remove CN Tower"}
- "how tall is the CN Tower?" -> {"action": "question", "question_context": {"subject": "building_height", "target_name": "CN Tower"}, "reasoning": "User asking about height"}
- "mak it rainy plz" -> {"action": "set_weather", "weather_settings": {"type": "rain"}, "reasoning": "Typo-corrected: wants rain"}
- "nite mode" -> {"action": "set_time", "time_settings": {"preset": "night"}, "reasoning": "Typo-corrected: wants night"}"""

    ANSWER_GENERATION_PROMPT = """You are a helpful map assistant. Generate a brief, informative response about the search result.

Be concise (1-2 sentences max). Include key facts when available:
- Building name if known
- Height or size if relevant to the query
- Location context

If no results were found, provide a helpful message."""

    QA_ANSWER_PROMPT = """You are a helpful assistant for a 3D architecture visualization platform.
Answer the user's question directly and concisely (1-2 sentences max).

If map data is available, use it. Otherwise, use your general knowledge.
Do not add meta-commentary like "based on my knowledge" or "from general knowledge".
Just answer the question directly."""

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

    async def parse_search_intent(self, query: str) -> dict:
        """
        Parse a natural language search query into structured intent.

        Args:
            query: User's search query (e.g., "take me to Paris", "tallest building")

        Returns:
            Dict with action, location_query, building_attributes, search_radius_km
        """
        if not self._client:
            # Fallback to simple keyword parsing if OpenAI not configured
            return self._fallback_intent_parse(query)

        try:
            response = await self._client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": self.SEARCH_INTENT_PROMPT},
                    {"role": "user", "content": f"Parse this search query: {query}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,  # Lower for more deterministic parsing
                max_tokens=300
            )

            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"OpenAI intent parsing error: {e}")
            return self._fallback_intent_parse(query)

    def _fallback_intent_parse(self, query: str) -> dict:
        """Fallback rule-based intent parsing when OpenAI is unavailable."""
        query_lower = query.lower()

        # Check for weather control
        if any(word in query_lower for word in ["rain", "rainy", "raining"]):
            return {
                "action": "set_weather",
                "weather_settings": {"type": "rain"},
                "reasoning": "Fallback: rain keyword detected"
            }
        if any(word in query_lower for word in ["snow", "snowy", "snowing"]):
            return {
                "action": "set_weather",
                "weather_settings": {"type": "snow"},
                "reasoning": "Fallback: snow keyword detected"
            }
        if any(phrase in query_lower for phrase in ["clear weather", "stop rain", "sunny", "clear sky"]):
            return {
                "action": "set_weather",
                "weather_settings": {"type": "clear"},
                "reasoning": "Fallback: clear weather keyword detected"
            }

        # Check for time control
        if any(word in query_lower for word in ["night", "dark", "evening", "nite"]):
            return {
                "action": "set_time",
                "time_settings": {"preset": "night"},
                "reasoning": "Fallback: night keyword detected"
            }
        if any(word in query_lower for word in ["day", "daytime", "morning", "bright"]) and "what" not in query_lower:
            return {
                "action": "set_time",
                "time_settings": {"preset": "day"},
                "reasoning": "Fallback: day keyword detected"
            }

        # Check for camera control
        if "zoom in" in query_lower:
            return {
                "action": "camera_control",
                "camera_settings": {"zoom_delta": 2},
                "reasoning": "Fallback: zoom in detected"
            }
        if "zoom out" in query_lower:
            return {
                "action": "camera_control",
                "camera_settings": {"zoom_delta": -2},
                "reasoning": "Fallback: zoom out detected"
            }
        if any(phrase in query_lower for phrase in ["from above", "top down", "bird's eye", "aerial", "overhead"]):
            return {
                "action": "camera_control",
                "camera_settings": {"pitch": 0},
                "reasoning": "Fallback: top-down view detected"
            }
        if "tilt" in query_lower:
            return {
                "action": "camera_control",
                "camera_settings": {"pitch": 60},
                "reasoning": "Fallback: tilt detected"
            }

        # Check for delete action
        if any(word in query_lower for word in ["delete", "remove", "erase"]):
            # Try to extract location
            location = None
            for phrase in ["delete", "remove", "erase"]:
                if phrase in query_lower:
                    parts = query_lower.split(phrase, 1)
                    if len(parts) > 1:
                        location = parts[1].strip()
                        # Clean up common words
                        for prefix in ["the", "this", "that", "building at", "building"]:
                            if location.startswith(prefix):
                                location = location[len(prefix):].strip()
                        if location:
                            break
            return {
                "action": "delete_building",
                "location_query": location if location else None,
                "reasoning": "Fallback: delete keyword detected"
            }

        # Check for question (starts with question words)
        if any(query_lower.startswith(q) for q in ["how", "what", "when", "who", "why", "is ", "are ", "does ", "do ", "can "]):
            # Try to extract target name
            target_name = None
            for landmark in ["cn tower", "eiffel tower", "empire state", "burj khalifa", "big ben"]:
                if landmark in query_lower:
                    target_name = landmark.title()
                    break
            return {
                "action": "question",
                "question_context": {
                    "subject": "general",
                    "target_name": target_name
                },
                "reasoning": "Fallback: question format detected"
            }

        # Check for navigation intent
        if any(phrase in query_lower for phrase in ["take me to", "go to", "navigate to", "fly to"]):
            # Extract location after the phrase
            for phrase in ["take me to", "go to", "navigate to", "fly to"]:
                if phrase in query_lower:
                    location = query_lower.split(phrase, 1)[1].strip()
                    # Check if it's a building search
                    if any(word in location for word in ["tallest", "biggest", "underdeveloped"]):
                        break  # It's a building search, not navigation
                    return {
                        "action": "navigate",
                        "location_query": location,
                        "building_attributes": None,
                        "search_radius_km": None,
                        "reasoning": "Fallback: navigation phrase detected"
                    }

        # Check for building search
        sort_by = None
        if any(word in query_lower for word in ["tallest", "tall", "highest", "height"]):
            sort_by = "height"
        elif any(word in query_lower for word in ["biggest", "largest", "footprint", "area"]):
            sort_by = "area"
        elif any(word in query_lower for word in ["underdeveloped", "low-rise", "short building"]):
            sort_by = "underdeveloped"

        if sort_by:
            return {
                "action": "find_building",
                "location_query": None,
                "building_attributes": {"sort_by": sort_by, "building_type": "any", "limit": 5},
                "search_radius_km": None,
                "reasoning": f"Fallback: building search for {sort_by}"
            }

        # Default to search area
        return {
            "action": "search_area",
            "location_query": None,
            "building_attributes": None,
            "search_radius_km": None,
            "reasoning": "Fallback: no specific intent detected"
        }

    async def generate_search_answer(
        self,
        query: str,
        top_result: Optional[dict],
        location_name: Optional[str],
        intent: Optional[dict] = None
    ) -> str:
        """
        Generate a natural language answer for search results.

        Args:
            query: Original search query
            top_result: Top building result (GeoJSON feature) or None
            location_name: Location context if applicable
            intent: Parsed intent for context

        Returns:
            Natural language answer string
        """
        if not self._client:
            return self._fallback_answer_generation(query, top_result, location_name, intent)

        try:
            if not top_result:
                context = f"Query: {query}\nLocation: {location_name or 'current viewport'}\nResult: No buildings found."
            else:
                props = top_result.get("properties", {})
                context = f"""Query: {query}
Location: {location_name or 'current viewport'}
Top result properties: {json.dumps(props, indent=2)}
Intent: {json.dumps(intent) if intent else 'unknown'}"""

            response = await self._client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": self.ANSWER_GENERATION_PROMPT},
                    {"role": "user", "content": context}
                ],
                temperature=0.7,
                max_tokens=100
            )

            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI answer generation error: {e}")
            return self._fallback_answer_generation(query, top_result, location_name, intent)

    def _fallback_answer_generation(
        self,
        query: str,
        top_result: Optional[dict],
        location_name: Optional[str],
        intent: Optional[dict]
    ) -> str:
        """Fallback answer generation when OpenAI is unavailable."""
        if not top_result:
            return f"No buildings found{' near ' + location_name if location_name else ' in this area'}."

        props = top_result.get("properties", {})
        name = props.get("name") or props.get("addr:housename") or props.get("addr:housenumber") or "this building"

        sort_by = intent.get("building_attributes", {}).get("sort_by") if intent else None

        if sort_by == "height":
            height = props.get("height", props.get("building:levels", "unknown"))
            return f"The tallest building is {name} ({height})."
        elif sort_by == "area":
            return f"The building with the largest footprint is {name}."
        elif sort_by == "underdeveloped":
            return f"The most underdeveloped building (large footprint, low height) is {name}."
        else:
            return f"Found {name} matching your query."

    async def generate_qa_answer(
        self,
        query: str,
        building_data: Optional[dict],
        question_context: Optional[dict]
    ) -> str:
        """
        Generate an answer for Q&A queries.

        Args:
            query: Original user question
            building_data: Building data from Overpass API (if available)
            question_context: Parsed question context (subject, target_name)

        Returns:
            Natural language answer string
        """
        if not self._client:
            return self._fallback_qa_answer(query, building_data, question_context)

        try:
            props = building_data.get("properties", {}) if building_data else {}
            context = f"""Question: {query}
Building data: {json.dumps(props, indent=2) if props else "No building data available"}
Question context: {json.dumps(question_context) if question_context else "None"}"""

            response = await self._client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": self.QA_ANSWER_PROMPT},
                    {"role": "user", "content": context}
                ],
                temperature=0.7,
                max_tokens=200
            )

            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI Q&A answer generation error: {e}")
            return self._fallback_qa_answer(query, building_data, question_context)

    def _fallback_qa_answer(
        self,
        query: str,
        building_data: Optional[dict],
        question_context: Optional[dict]
    ) -> str:
        """Fallback Q&A answer when OpenAI is unavailable."""
        if not building_data:
            return "I don't have enough information to answer that question."

        props = building_data.get("properties", {})
        name = props.get("name", "this building")
        subject = question_context.get("subject", "") if question_context else ""

        if subject == "building_height" or "tall" in query.lower() or "height" in query.lower():
            height = props.get("height")
            levels = props.get("building:levels")
            if height:
                return f"{name} is {height} meters tall."
            elif levels:
                return f"{name} has {levels} floors."
            else:
                return f"I don't have height information for {name}."

        if "built" in query.lower() or "year" in query.lower() or "old" in query.lower():
            start_date = props.get("start_date")
            if start_date:
                return f"{name} was built in {start_date}."
            else:
                return f"I don't have construction date information for {name}."

        return f"I found {name}, but I don't have specific information to answer your question."
