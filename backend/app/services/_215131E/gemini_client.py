from functools import lru_cache

from google import genai
from google.genai import types

from app.core.config import Settings


@lru_cache
def _get_client(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key)


def generate_json(prompt: str, settings: Settings) -> str:
    """
    Sends the prompt to Gemini and asks for a strict JSON response, so the
    caller can json.loads() it directly. task_define.ipynb's original prompt
    asked for free-form text (fine for a human reading a notebook cell) --
    for a service response, structured output is what the API contract needs.
    """
    client = _get_client(settings.gemini_api_key)
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )
    return response.text
