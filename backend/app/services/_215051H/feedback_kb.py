import json
from pathlib import Path
from typing import Any


def _fallback_text(entry: Any) -> str:
    """Converts a KB entry (string or dict) into a descriptive string for retrieval."""
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict):
        parts = []
        for key, value in entry.items():
            if key == "id":
                continue
            label = key.replace("_", " ").title()
            parts.append(f"{label}: {value}")
        return "\n".join(parts)
    return str(entry)


_KNOWLEDGE_SECTIONS = [
    "stage_definitions",
    "clarity_patterns",
    "history_patterns",
    "improvement_patterns",
    "stage_transition_patterns",
]


def load_kb(kb_path: Path) -> dict[str, Any]:
    return json.loads(kb_path.read_text(encoding="utf-8"))


def build_document_corpus(kb: dict[str, Any]) -> list[str]:
    """
    Flattens the KB into a document corpus for FAISS retrieval, same shape as
    module_04_feedback_scoring_final_flow_v2.py Cell 12.
    """
    documents: list[str] = []

    for section in _KNOWLEDGE_SECTIONS:
        content = kb.get(section, {})
        if isinstance(content, dict):
            for subkey, items in content.items():
                if isinstance(items, list):
                    documents.extend(_fallback_text(item) for item in items)
                else:
                    documents.append(f"{subkey}: {items}")
        elif isinstance(content, list):
            documents.extend(_fallback_text(item) for item in content)

    for examples_list in kb.get("examples", {}).values():
        documents.extend(_fallback_text(example) for example in examples_list)

    metadata = kb.get("metadata", {})
    if "description" in metadata:
        documents.append(metadata["description"])
    if "notes" in metadata:
        documents.append(metadata["notes"])

    return documents
