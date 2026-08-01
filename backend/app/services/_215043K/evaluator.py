import httpx

from app.services._215043K.rl_agent import METRICS


class Module4UnavailableError(RuntimeError):
    """Module 4 could not be reached, or answered with something unusable."""


class Module4Evaluator:
    """
    Scores a generated piece of feedback on the six WRFEF measures by calling Module 4.

    In the notebook this was module4_evaluate(), a stub returning six constants -- which
    is why every episode in the notebook's evaluation run scored a reward of exactly -1
    and the Q-table never learned anything. Pointing it at the real service is what turns
    the RL half of this module from scaffolding into something that trains.

    The expected contract is a POST returning a JSON object with one 0-1 float per
    measure in METRICS. If Module 4 settles on a different shape, this class is the only
    thing that has to change.
    """

    def __init__(self, base_url: str, path: str, timeout_seconds: float):
        self._url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
        self._timeout = timeout_seconds

    def evaluate(
        self,
        feedback: str,
        stage: str,
        content: str,
        feedback_history: list[str],
    ) -> dict[str, float]:
        try:
            response = httpx.post(
                self._url,
                json={
                    "feedback": feedback,
                    "stage": stage,
                    "content": content,
                    "feedback_history": feedback_history,
                },
                timeout=self._timeout,
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPError as exc:
            raise Module4UnavailableError(
                f"Could not reach Module 4's evaluator at {self._url}: {exc}"
            ) from exc

        return self._coerce(payload)

    def _coerce(self, payload: object) -> dict[str, float]:
        if not isinstance(payload, dict):
            raise Module4UnavailableError(
                f"Module 4 returned {type(payload).__name__}, expected an object of scores."
            )

        missing = [metric for metric in METRICS if metric not in payload]
        if missing:
            raise Module4UnavailableError(
                f"Module 4's response is missing {', '.join(missing)}. "
                f"All six measures are required to compute a state id."
            )

        scores: dict[str, float] = {}
        for metric in METRICS:
            try:
                value = float(payload[metric])
            except (TypeError, ValueError) as exc:
                raise Module4UnavailableError(
                    f"Module 4 returned a non-numeric {metric}: {payload[metric]!r}"
                ) from exc

            # Banding and the reward floor both assume a 0-1 scale; clamping here keeps
            # an out-of-range score from silently landing in the wrong band.
            scores[metric] = min(1.0, max(0.0, value))

        return scores
