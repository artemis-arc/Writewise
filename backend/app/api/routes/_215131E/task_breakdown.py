from fastapi import APIRouter, Depends, HTTPException

from app.api.routes._215131E.deps import get_retriever
from app.core.config import Settings, get_settings
from app.models._215131E.schemas import TaskBreakdownRequest, TaskBreakdownResponse
from app.services._215131E.scenario_retriever import ScenarioRetriever
from app.services._215131E.task_define import generate_task_breakdown

router = APIRouter(prefix="/api/v1/task-breakdown", tags=["task-breakdown"])


@router.post("", response_model=TaskBreakdownResponse)
async def create_task_breakdown(
    payload: TaskBreakdownRequest,
    retriever: ScenarioRetriever = Depends(get_retriever),
    settings: Settings = Depends(get_settings),
) -> TaskBreakdownResponse:
    try:
        return await generate_task_breakdown(payload, retriever, settings)
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Model response did not match the expected shape: {exc}",
        ) from exc
