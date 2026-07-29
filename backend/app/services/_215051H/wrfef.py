"""
WriteWise Research-Based Feedback Evaluation Framework (WRFEF): the six scoring
dimensions, their theoretical grounding, the scoring rubric, and the weights
used to combine them into an overall score. Copied unchanged from
module_04_feedback_scoring_final_flow_v2.py, Cell 6.
"""

WRFEF = {
    "Relevance": {
        "theory": "Hattie & Timperley (2007)",
        "purpose": "Determine whether the feedback addresses the learner's current writing problem.",
    },
    "Clarity": {
        "theory": "Shute (2008), Cognitive Load Theory",
        "purpose": "Determine whether the feedback is clear, specific and easy to understand.",
    },
    "Actionability": {
        "theory": "Shute (2008), Nicol & Macfarlane-Dick (2006)",
        "purpose": "Determine whether the feedback provides clear actions the learner can follow.",
    },
    "Stage Alignment": {
        "theory": "Constructive Alignment (Biggs)",
        "purpose": "Determine whether the feedback matches the learner's current writing stage.",
    },
    "Improvement Impact": {
        "theory": "Hattie & Timperley (2007), Self-Regulated Learning",
        "purpose": "Determine how much the feedback is expected to improve the learner's next draft.",
    },
    "Consistency with History": {
        "theory": "Process Writing Theory, Formative Assessment",
        "purpose": "Determine whether the feedback remains consistent with previous feedback.",
    },
}

SCORING_RUBRIC = {
    "Relevance": {
        "9-10": "Directly addresses the learner's current writing issue.",
        "7-8": "Mostly relevant.",
        "5-6": "Partially relevant.",
        "3-4": "Weakly related.",
        "1-2": "Irrelevant.",
    },
    "Clarity": {
        "9-10": "Very clear and specific.",
        "7-8": "Mostly clear.",
        "5-6": "Understandable but somewhat vague.",
        "3-4": "Difficult to understand.",
        "1-2": "Confusing.",
    },
    "Actionability": {
        "9-10": "Provides clear next actions.",
        "7-8": "Mostly actionable.",
        "5-6": "General suggestions.",
        "3-4": "Limited actions.",
        "1-2": "No actionable advice.",
    },
    "Stage Alignment": {
        "9-10": "Fully matches the learner's stage.",
        "7-8": "Mostly aligned.",
        "5-6": "Partially aligned.",
        "3-4": "Poorly aligned.",
        "1-2": "Not aligned.",
    },
    "Improvement Impact": {
        "9-10": "Highly improves future writing.",
        "7-8": "Moderate improvement.",
        "5-6": "Limited improvement.",
        "3-4": "Minimal improvement.",
        "1-2": "No educational impact.",
    },
    "Consistency with History": {
        "9-10": "Fully consistent with previous feedback.",
        "7-8": "Mostly consistent.",
        "5-6": "Some repetition.",
        "3-4": "Contradictory or repetitive.",
        "1-2": "Completely inconsistent.",
    },
}

# Relevance and Actionability carry the most weight because Hattie & Timperley
# (2007) and Nicol & Macfarlane-Dick (2006) treat "does the feedback address
# the real problem" and "can the learner act on it" as the strongest
# predictors of whether feedback improves the next draft.
WRFEF_WEIGHTS = {
    "relevance": 0.25,
    "clarity": 0.15,
    "actionability": 0.20,
    "stage_alignment": 0.15,
    "improvement_impact": 0.15,
    "consistency_with_history": 0.10,
}
assert abs(sum(WRFEF_WEIGHTS.values()) - 1.0) < 1e-9

DIMENSIONS = list(WRFEF_WEIGHTS.keys())
