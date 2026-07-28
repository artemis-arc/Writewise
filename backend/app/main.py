from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.api.routes._215131E import task_breakdown, writing_profile
from app.core.config import get_settings
from app.services._215131E.scenario_retriever import ScenarioRetriever
from app.services._215131E.srsd_scoring import SrsdScorer


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    # Built once at startup so a request never pays the embedding/index/model-load cost.
    app.state.retriever = ScenarioRetriever(settings.embedding_model, settings.scenarios_path)
    app.state.srsd_scorer = SrsdScorer(settings.srsd_embedding_model, settings.srsd_checkpoint_path)
    yield


app = FastAPI(title="WriteWise Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(task_breakdown.router)
app.include_router(writing_profile.router)
