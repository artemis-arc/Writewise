import re

import nltk
import numpy as np
import textstat
from sklearn.metrics.pairwise import cosine_similarity

_NLTK_DATA_READY = False


def _ensure_nltk_data() -> None:
    """Downloads NLTK's tokenizer data on first use, guarded so it only pays the
    (network) cost once per process instead of on every request."""
    global _NLTK_DATA_READY
    if _NLTK_DATA_READY:
        return
    for resource in ("tokenizers/punkt", "tokenizers/punkt_tab"):
        try:
            nltk.data.find(resource)
        except LookupError:
            nltk.download(resource.split("/")[-1], quiet=True)
    _NLTK_DATA_READY = True


ACADEMIC_WORDS = {
    "analysis", "analyze", "approach", "architecture", "argument",
    "assessment", "cite", "clarify", "compare", "conclusion",
    "dataset", "define", "demonstrate", "describe", "design",
    "develop", "discussion", "evaluate", "evaluation", "evidence",
    "example", "explain", "experiment", "finding", "framework",
    "hypothesis", "implementation", "improve", "introduction",
    "justify", "literature", "method", "methodology", "model",
    "objective", "proposal", "reference", "research", "result",
    "revise", "scope", "section", "structure", "study",
    "support", "system", "technique", "theory", "validate",
}

HEDGE_WORDS = [
    "maybe", "probably", "perhaps", "possibly", "kind of", "sort of",
    "a bit", "somewhat", "i think", "i guess", "some aspects", "try to",
    "stuff", "a little", "a lot", "some more",
]

VAGUE_VERBS = [
    "improve", "fix", "work on", "look at", "think about", "consider",
    "change", "address", "help", "make better", "do more",
]

SPECIFIC_VERBS = [
    "identify", "define", "list", "compare", "choose", "analyze",
    "calculate", "name", "describe", "outline", "narrow", "add",
    "remove", "include", "specify", "select", "state", "explain",
    "develop", "write", "brainstorm", "prioritize", "evaluate",
    "decide", "clarify", "strengthen", "review",
]

GENERIC_REFS = [
    "your paper", "your work", "this part", "the part", "your section",
    "something", "stuff", "it ",
]


def surface_features(text: str, language_tool) -> dict:
    _ensure_nltk_data()
    words = nltk.word_tokenize(text)
    alpha_words = [w.lower() for w in words if w.isalpha()]

    readability = textstat.flesch_reading_ease(text)
    grade = textstat.flesch_kincaid_grade(text)
    fog = textstat.gunning_fog(text)

    matches = language_tool.check(text)
    grammar_errors = spelling_errors = punctuation_errors = style_errors = 0
    for match in matches:
        issue = getattr(match, "ruleIssueType", "").lower()
        if issue == "misspelling":
            spelling_errors += 1
        elif issue == "typographical":
            punctuation_errors += 1
        elif issue == "style":
            style_errors += 1
        else:
            grammar_errors += 1

    lexical_density = len(alpha_words) / max(len(words), 1)
    vocabulary_diversity = len(set(alpha_words)) / max(len(alpha_words), 1)
    average_word_length = sum(len(w) for w in alpha_words) / max(len(alpha_words), 1)

    academic_count = sum(1 for w in alpha_words if w in ACADEMIC_WORDS)
    academic_vocab_ratio = academic_count / max(len(alpha_words), 1)

    return {
        "readability": readability,
        "grade": grade,
        "fog": fog,
        "lexical_density": lexical_density,
        "grammar_errors": grammar_errors,
        "spelling_errors": spelling_errors,
        "punctuation_errors": punctuation_errors,
        "style_errors": style_errors,
        "vocabulary_diversity": vocabulary_diversity,
        "average_word_length": average_word_length,
        "academic_vocab_ratio": academic_vocab_ratio,
    }


def _tree_depth(token) -> int:
    children = list(token.children)
    if not children:
        return 1
    return 1 + max(_tree_depth(c) for c in children)


def syntax_features(text: str, nlp) -> dict:
    doc = nlp(text)
    sent_lengths = []
    tree_depths = []
    clause_count = 0
    for sent in doc.sents:
        sent_lengths.append(len(sent))
        roots = [t for t in sent if t.head == t]
        if roots:
            tree_depths.append(_tree_depth(roots[0]))
        clause_count += sum(
            token.dep_ in ("ccomp", "xcomp", "advcl", "relcl") for token in sent
        )
    return {
        "avg_sentence_length": sum(sent_lengths) / max(len(sent_lengths), 1),
        "max_sentence_length": max(sent_lengths) if sent_lengths else 0,
        "avg_tree_depth": sum(tree_depths) / max(len(tree_depths), 1),
        "clause_count": clause_count,
    }


def semantic_features(text: str, semantic_model) -> dict:
    _ensure_nltk_data()
    sents = nltk.sent_tokenize(text)
    if len(sents) == 1:
        return {"semantic_consistency": 1, "cohesion": 1}
    embeddings = semantic_model.encode(sents)
    sims = []
    for i in range(len(embeddings) - 1):
        sim = cosine_similarity(
            embeddings[i].reshape(1, -1), embeddings[i + 1].reshape(1, -1)
        )[0][0]
        sims.append(sim)
    return {
        "semantic_consistency": float(np.mean(sims)),
        "cohesion": float(np.std(sims)),
    }


def specificity_features(text: str) -> dict:
    lower = text.lower()

    number_count = len(re.findall(
        r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third)\b",
        lower,
    ))
    hedge_count = sum(1 for h in HEDGE_WORDS if h in lower)
    vague_verb_count = sum(1 for v in VAGUE_VERBS if v in lower)
    specific_verb_count = sum(1 for v in SPECIFIC_VERBS if v in lower)
    generic_ref_count = sum(1 for g in GENERIC_REFS if g in lower)

    return {
        "number_mentions": number_count,
        "hedge_word_count": hedge_count,
        "vague_verb_count": vague_verb_count,
        "specific_verb_count": specific_verb_count,
        "generic_reference_count": generic_ref_count,
        "specificity_ratio": specific_verb_count / (specific_verb_count + vague_verb_count + 1),
    }


def extract_features(text: str, nlp, semantic_model, language_tool) -> dict:
    features = {}
    features.update(surface_features(text, language_tool))
    features.update(syntax_features(text, nlp))
    features.update(semantic_features(text, semantic_model))
    features.update(specificity_features(text))
    return features
