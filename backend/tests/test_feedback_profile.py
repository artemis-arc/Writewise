"""
Module 3's (215043K) writer profile handling.

The point of most of these is parity: Module 1 (215131E) does not score vocabulary, so
the live path has to render a profile without it -- but the notebook's evaluation numbers
were measured on strings that had it. The with-vocabulary cases below are asserted against
hardcoded literals so that a future edit cannot quietly change what gets embedded.
"""

import pytest

from app.services._215043K.profile import resolve_writer_level
from app.services._215043K.prompt import build_prompt, format_query
from app.services._215043K.retriever import RetrievalResult

WITH_VOCABULARY = {
    "writer_level": "low",
    "mechanics": 40,
    "vocabulary": 35,
    "organization": 45,
}

# What Module 1 actually produces: the key is present, the measurement is not.
WITHOUT_VOCABULARY = {
    "writer_level": "low",
    "mechanics": 40,
    "vocabulary": None,
    "organization": 45,
}

EMPTY_RETRIEVAL = RetrievalResult(documents=[], feedbacks=[], strategies=[])


def test_format_query_with_vocabulary_is_unchanged():
    assert format_query("PLANNING", "My draft", WITH_VOCABULARY) == (
        "Stage: PLANNING | Writer Level: low | Mechanics: 40 | Vocabulary: 35 | "
        "Organization: 45 | Content: My draft"
    )


def test_format_query_drops_only_the_vocabulary_segment():
    assert format_query("PLANNING", "My draft", WITHOUT_VOCABULARY) == (
        "Stage: PLANNING | Writer Level: low | Mechanics: 40 | "
        "Organization: 45 | Content: My draft"
    )


def test_format_query_tolerates_a_missing_vocabulary_key():
    profile = {key: value for key, value in WITH_VOCABULARY.items() if key != "vocabulary"}
    assert "Vocabulary" not in format_query("PLANNING", "My draft", profile)


def test_build_prompt_with_vocabulary_renders_the_original_context_block():
    prompt = build_prompt(
        stage="PLANNING",
        content="My draft",
        profile=WITH_VOCABULARY,
        retrieval=EMPTY_RETRIEVAL,
    )

    assert (
        """Student Context:
- Writing Stage: PLANNING
- Writer Level: low
- Mechanics Score: 40/100
- Vocabulary Score: 35/100
- Organization Score: 45/100
- Student's current text: "My draft\""""
        in prompt
    )


def test_build_prompt_without_vocabulary_drops_only_that_line():
    prompt = build_prompt(
        stage="PLANNING",
        content="My draft",
        profile=WITHOUT_VOCABULARY,
        retrieval=EMPTY_RETRIEVAL,
    )

    # Not "Vocabulary Score: None/100" -- an empty labelled slot reads as a measurement.
    assert "Vocabulary" not in prompt
    assert (
        """Student Context:
- Writing Stage: PLANNING
- Writer Level: low
- Mechanics Score: 40/100
- Organization Score: 45/100
- Student's current text: "My draft\""""
        in prompt
    )


@pytest.mark.parametrize(
    "overall, expected",
    [
        (0, "low"),
        (49.9, "low"),
        (50.0, "medium"),  # the cutoffs are the floor of the band above
        (69.9, "medium"),
        (70.0, "high"),
        (100, "high"),
    ],
)
def test_resolve_writer_level_bands(overall, expected):
    assert resolve_writer_level(overall, low_cutoff=50.0, medium_cutoff=70.0) == expected
