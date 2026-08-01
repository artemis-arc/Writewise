import json
from functools import lru_cache
from pathlib import Path

from app.core.config import Settings
from app.models._215131E.schemas import ActionSet, Milestone, TaskBreakdownRequest, TaskBreakdownResponse
from app.services._215131E.gemini_client import generate_json
from app.services._215131E.scenario_retriever import ScenarioRetriever


@lru_cache
def _load_action_bank(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _build_prompt(payload: TaskBreakdownRequest, scenario: dict, action_bank: dict) -> str:
    profile = payload.writing_profile

    # Everything embedded below uses json.dumps (double-quoted), not Python repr
    # (single-quoted) -- feeding the model single-quoted "almost JSON" in its context
    # measurably increases the odds it echoes that style back, which then fails
    # json.loads() on the response.
    context = f"""
Scenario ID: {scenario['id']}
Job: {scenario['task']}
Academic Level: {scenario['academic_level']}
Writer Level: {scenario['writing_profile']['writer_level']}

Task Patterns:
{json.dumps(scenario['task_breakdown'])}

Reference Actions:
{json.dumps(scenario['actions'])}
"""

    return f"""
You are an adaptive academic writing assistant.

IMPORTANT:
- You MUST use ONLY the information provided in the KNOWLEDGE BASE CONTEXT and Writing Support Actions below.
- Do NOT add new ideas, examples, or explanations beyond the context.
- Respond with STRICT JSON ONLY, matching the OUTPUT SCHEMA. No markdown, no commentary.

=== KNOWLEDGE BASE CONTEXT ===
{context}
================================

INPUT:
Task: {payload.task}
Academic Level: {payload.academic_level}
Citation Style: {payload.citation_style}
Writing Scores:
- Mechanics: {profile.mechanics}
- Organization: {profile.organization}

Writing Support Action Banks:
- Mechanics (choose 1-2 based on the Mechanics score): {json.dumps(action_bank['mechanics'])}
- Organization (use as provided): {json.dumps(action_bank['organization'])}

INSTRUCTIONS:
1. Produce 4-6 milestones adapting the Task Patterns above to the given Task and Citation Style.
2. Keep each milestone description to one sentence.
3. For actions, select only the most suitable 1-2 entries per category from the action banks based on the writing scores. Do not invent new actions.

OUTPUT SCHEMA (STRICT JSON):
{{
  "milestones": [{{"title": "string", "description": "string"}}],
  "actions": {{"mechanics": ["string"], "organization": ["string"]}}
}}
"""


async def generate_task_breakdown(
    payload: TaskBreakdownRequest,
    retriever: ScenarioRetriever,
    settings: Settings,
) -> TaskBreakdownResponse:
    query = (
        f"Job: {payload.task}\n"
        f"Academic level: {payload.academic_level}\n"
        f"Writing profile: mechanics={payload.writing_profile.mechanics}, "
        f"organization={payload.writing_profile.organization}"
    )
    scenario = retriever.retrieve_best_match(query, payload.academic_level)
    action_bank = _load_action_bank(settings.action_bank_path)

    prompt = _build_prompt(payload, scenario, action_bank)

    # Gemini's JSON mode is not a hard schema guarantee -- retry once before giving up,
    # since a second sample is usually well-formed when the first isn't.
    attempts = 2
    data = None
    last_error: json.JSONDecodeError | None = None
    for _ in range(attempts):
        raw_response = generate_json(prompt, settings)
        try:
            data = json.loads(raw_response)
            break
        except json.JSONDecodeError as exc:
            last_error = exc
    if data is None:
        raise ValueError(f"Gemini did not return valid JSON after {attempts} attempts: {last_error}")

    milestones = [
        Milestone(order=index + 1, title=step["title"], description=step["description"])
        for index, step in enumerate(data["milestones"])
    ]
    actions = ActionSet(**data["actions"])

    return TaskBreakdownResponse(milestones=milestones, actions=actions)
