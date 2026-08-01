# Feedback-Scoring API

Scores a piece of feedback (given to a student on their writing) across six quality
dimensions, using the student's writing context and feedback history.

**Endpoint:** `POST /api/v1/feedback-scoring`

## Input

```json
{
  "current_stage": "drafting",
  "previous_stage": "planning",
  "current_content": "intro paragraph written",
  "previous_content": "outline draft",
  "given_feedback": "Nice intro, but add a thesis statement.",
  "feedback_history": [
    "Good outline structure, expand on your research question."
  ]
}
```

| Field | Required? | Meaning |
|---|---|---|
| `current_stage` | No | The student's current writing stage (e.g. `drafting`). If omitted, filled in automatically from the latest [stage-classification](../_215098G/) result. |
| `previous_stage` | No | The stage before that (the prior transition). Auto-filled from stage-classification's history if omitted. |
| `current_content` | No | The student's current writing text. Auto-filled from the `after_text` of the last stage-classification call if omitted. |
| `previous_content` | No | The student's writing text before the latest edit. Auto-filled from the `before_text` of the last stage-classification call if omitted. |
| `given_feedback` | **Yes** | The feedback text being evaluated. |
| `feedback_history` | No | Earlier feedback given to this student, for consistency checking. Defaults to empty. |

### Auto-fill from stage-classification

You normally don't need to send the first four fields yourself. Every time
`POST /api/v1/stage-classification` runs, the backend remembers the result
(stage + the `before_text`/`after_text` it classified). When you call
feedback-scoring without `current_stage`/`current_content`, it reuses that
memory:

- `current_stage` ← latest recorded stage
- `previous_stage` ← the stage recorded just before that (falls back to
  `current_stage` if there's no earlier one yet)
- `current_content` ← latest recorded `after_text`
- `previous_content` ← latest recorded `before_text`

So the minimal real-world call, after at least one stage-classification call
has happened, is just:

```json
{
  "given_feedback": "Nice intro, but add a thesis statement."
}
```

If no stage-classification call has happened yet and you don't supply
`current_stage`/`current_content` yourself, the API returns `422`.

## Output

```json
{
  "overall_score": 0.82,
  "dimensions": {
    "relevance": { "score": 0.9, "reasoning": "..." },
    "clarity": { "score": 0.75, "reasoning": "..." },
    "actionability": { "score": 0.85, "reasoning": "..." },
    "stage_alignment": { "score": 0.8, "reasoning": "..." },
    "improvement_impact": { "score": 0.78, "reasoning": "..." },
    "consistency_with_history": { "score": 0.9, "reasoning": "..." }
  }
}
```

| Field | Meaning |
|---|---|
| `overall_score` | Weighted average of the six dimension scores, 0.0–1.0. |
| `dimensions.*.score` | Score for that dimension, 0.0–1.0. |
| `dimensions.*.reasoning` | One-sentence explanation for that score. |

The six dimensions come from the WRFEF (WriteWise Research-based Feedback
Evaluation Framework): relevance, clarity, actionability, stage alignment,
improvement impact, and consistency with feedback history. `clarity` is
scored by a trained ML model; the rest are scored by an LLM (Gemini) grounded
in retrieved knowledge-base context.

## Errors

| Status | When |
|---|---|
| `422` | `given_feedback` missing/empty, or `current_stage`/`current_content` missing with no stage-classification data to fall back on. |
| `502` | The LLM's response didn't match the expected shape. |
| `503` | The clarity model isn't trained yet. |
