from functools import lru_cache

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_random_exponential

from app.core.config import Settings


@lru_cache
def _get_client(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key)


# Gemini's free tier caps out around 10 requests/minute and a 429 means "you've
# used this minute's quota," not a transient blip -- retries need to wait long
# enough for the per-minute window to actually reset. This module's prompt (full
# KB context + 6-dimension rubric) is heavier than task_define.py's, so unlike
# that module's single "retry once on bad JSON" this keeps the notebook's
# backoff retry around the Gemini call itself.
@retry(wait=wait_random_exponential(multiplier=1, min=15, max=70), stop=stop_after_attempt(6))
def generate_json(prompt: str, settings: Settings) -> str:
    client = _get_client(settings.gemini_api_key)
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )
    if not response or not response.text:
        raise ValueError("Empty or invalid response from Gemini")
    return response.text
