"""
Turns what the rest of the app already knows about a writer into the categorical input
this module's retrieval needs: which writer level bucket their scores put them in.

The other categorical input, the writing stage, is Module 2's (215098G) output and is
taken from the request as-is -- there is no derivation for it here. Module 2's classifier
has not landed yet, so callers pass one of the three stage literals explicitly.

Writer level did not exist as a derivation in the notebook either; it was hand-written
into every test input. It is here rather than in the request schema so that the mapping
is one documented rule instead of something each caller reinvents.
"""


def resolve_writer_level(overall: float, low_cutoff: float, medium_cutoff: float) -> str:
    """
    Buckets Module 1's overall 0-100 score into the low/medium/high label the knowledge
    base is indexed by. The defaults sit in the gaps between the bands actually present
    in feedback_kb.json, whose examples cluster at means of 36-46, 57-65 and 78-83.
    """
    if overall < low_cutoff:
        return "low"
    if overall < medium_cutoff:
        return "medium"
    return "high"
