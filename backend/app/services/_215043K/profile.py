"""
Turns what the rest of the app already knows about a writer into the two categorical
inputs this module's retrieval needs: which writing stage they are in, and which writer
level bucket their scores put them in.

Neither existed as a derivation in the notebook -- both were hand-written into every
test input. They are here rather than in the request schema so that the mapping is one
documented rule instead of something each caller reinvents.
"""

from app.services._215043K.retriever import STAGES

PLANNING, IMPLEMENTATION, REVISION = STAGES


def resolve_stage(
    completed_milestones: int,
    total_milestones: int,
    planning_cutoff: float,
    implementation_cutoff: float,
) -> str:
    """
    Maps progress through Module 1's milestone list onto a writing stage. Module 1
    produces 4-6 milestones per task, so progress is read as a fraction rather than a
    fixed milestone index -- the cutoffs hold whatever the list length turns out to be.
    """
    if total_milestones <= 0:
        # No breakdown yet means the writer has not started working through a plan.
        return PLANNING

    progress = completed_milestones / total_milestones
    if progress < planning_cutoff:
        return PLANNING
    if progress < implementation_cutoff:
        return IMPLEMENTATION
    return REVISION


def resolve_writer_level(
    mechanics: float,
    vocabulary: float,
    organization: float,
    low_cutoff: float,
    medium_cutoff: float,
) -> str:
    """
    Buckets Module 2's three 0-100 scores into the low/medium/high label the knowledge
    base is indexed by. The defaults sit in the gaps between the bands actually present
    in feedback_kb.json, whose examples cluster at means of 36-46, 57-65 and 78-83.
    """
    mean_score = (mechanics + vocabulary + organization) / 3
    if mean_score < low_cutoff:
        return "low"
    if mean_score < medium_cutoff:
        return "medium"
    return "high"
