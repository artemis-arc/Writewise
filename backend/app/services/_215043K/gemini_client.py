from functools import lru_cache

from google import genai

from app.core.config import Settings


@lru_cache
def _get_client(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key)


def generate_text(prompt: str, settings: Settings) -> str:
    """
    Feedback_Generation_Module.ipynb used the legacy google-generativeai SDK
    (genai.configure + GenerativeModel) with a hardcoded key. This is the same call on
    the google-genai client the rest of the backend uses, with the key coming from
    Settings. The response is free-form prose, not JSON -- the prompt ends with
    "Output ONLY the feedback", and one or two sentences of text is the whole payload.
    """
    client = _get_client(settings.gemini_api_key)
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
    )
    return (response.text or "").strip()
