import json

from app.core.config import Settings
from app.services._215131E.gemini_client import generate_json

# Ported from mechanics_score_profile.ipynb. The notebook used the deprecated
# google.generativeai SDK with free-form text output and a regex to pull the JSON
# back out; generate_json() already asks Gemini for strict JSON (response_mime_type),
# so that extraction step isn't needed here.
_MECHANICS_PROMPT_TEMPLATE = """
You are an expert English writing evaluator.

Your task is to evaluate the mechanics of the given English text.

Mechanics include ONLY:
1. Spelling
2. Grammar
3. Punctuation

Follow these rules carefully.

-------------------------
SPELLING
-------------------------
- Count the number of misspelled words.
- Ignore proper nouns, names, abbreviations, URLs, email addresses and technical terms.
- Count each misspelled occurrence separately.
- Return:
    incorrect_spelling_words
    total_words

-------------------------
GRAMMAR
-------------------------
- Split the text into sentences.
- Count how many sentences contain one or more grammatical errors.
- Count each sentence only once even if it has multiple grammar mistakes.
- Return:
    grammar_error_sentences
    total_sentences

-------------------------
PUNCTUATION
-------------------------
Count every punctuation mark used in the text.

Punctuation includes:
. , ; : ! ? ' ( ) [ ] {{ }} - — …

Return

all_used_punctuations

Also count punctuation marks that are used incorrectly, such as

- missing comma causing incorrect punctuation
- comma splice
- wrong apostrophe
- repeated punctuation
- unnecessary punctuation
- incorrect quotation usage
- incorrect full stop
- missing end punctuation
- incorrect colon/semicolon usage

Return

incorrect_punctuations

-------------------------
IMPORTANT
-------------------------

Return ONLY valid JSON.

Format

{{
  "incorrect_spelling_words": 0,
  "total_words": 0,
  "grammar_error_sentences": 0,
  "total_sentences": 0,
  "incorrect_punctuations": 0,
  "all_used_punctuations": 0,
  "explanations": {{
      "spelling": [],
      "grammar": [],
      "punctuation": []
  }}
}}

Text to evaluate:

{text}
"""


def _compute_mechanics_score(result: dict) -> float:
    incorrect_spellings = result["incorrect_spelling_words"]
    total_words = result["total_words"]

    grammar_errors = result["grammar_error_sentences"]
    total_sentences = result["total_sentences"]

    incorrect_punct = result["incorrect_punctuations"]
    total_punct = result["all_used_punctuations"]

    spelling_score = (
        100.0 if total_words == 0 else max(0.0, 100 - (incorrect_spellings / total_words) * 100)
    )
    grammar_score = (
        100.0
        if total_sentences == 0
        else max(0.0, 100 - (grammar_errors / total_sentences) * 100)
    )
    punctuation_score = (
        100.0 if total_punct == 0 else max(0.0, 100 - (incorrect_punct / total_punct) * 100)
    )

    return round((spelling_score + grammar_score + punctuation_score) / 3)


def score_mechanics(text: str, settings: Settings) -> float:
    """Returns a 0-100 mechanics score (spelling + grammar + punctuation) for the given text."""
    prompt = _MECHANICS_PROMPT_TEMPLATE.format(text=text)

    # Gemini's JSON mode is not a hard schema guarantee -- retry once before giving up,
    # matching the pattern already used in task_define.py's generate_task_breakdown.
    attempts = 2
    data = None
    last_error: (json.JSONDecodeError | KeyError) | None = None
    for _ in range(attempts):
        raw_response = generate_json(prompt, settings)
        try:
            data = json.loads(raw_response)
            _compute_mechanics_score(data)  # validate required keys are present
            break
        except (json.JSONDecodeError, KeyError) as exc:
            last_error = exc
            data = None

    if data is None:
        raise ValueError(f"Gemini did not return valid mechanics JSON after {attempts} attempts: {last_error}")

    return _compute_mechanics_score(data)
