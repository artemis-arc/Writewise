from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.api.routes._215043K import feedback
from app.api.routes._215051H import feedback_scoring
from app.api.routes._215098G import stage_classification
from app.api.routes._215131E import task_breakdown, writing_profile
from app.core.config import get_settings
from app.services._215043K.engine import build_feedback_engine
from app.services._215051H.clarity_scoring import ClarityScorer
from app.services._215051H.feedback_retriever import FeedbackRetriever
from app.services._215098G.ml_pipeline import inference as stage_inference
from app.services._215098G.stage_context import StageContextStore
from app.services._215131E.scenario_retriever import ScenarioRetriever
from app.services._215131E.srsd_scoring import SrsdScorer

# Preserve the old startup seam so tests and local monkeypatches can override
# the Module 2 loader without reaching into the inference module directly.
load_stage_bundle = stage_inference.load_bundle


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    # Built once at startup so a request never pays the embedding/index/model-load cost.
    app.state.retriever = ScenarioRetriever(
        settings.embedding_model, settings.scenarios_path
    )
    app.state.srsd_scorer = SrsdScorer(
        settings.srsd_embedding_model, settings.srsd_checkpoint_path
    )
    app.state.feedback_retriever = FeedbackRetriever(
        settings.feedback_embedding_model, settings.feedback_kb_path
    )
    # ClarityScorer tolerates a missing joblib checkpoint (not trained yet) instead of
    # raising, so its absence doesn't take down the other modules' endpoints too.
    app.state.clarity_scorer = ClarityScorer(
        settings.clarity_semantic_model, settings.clarity_model_dir
    )
    # Backend-owned memory of what Module 2 last produced, so Modules 3 and 4 can fill in
    # the writing context instead of making the client carry it around.
    app.state.stage_context = StageContextStore()
    # Built after Module 4's three pieces because Module 3 scores its own output with them.
    app.state.feedback_engine = build_feedback_engine(
        settings,
        module4_retriever=app.state.feedback_retriever,
        clarity_scorer=app.state.clarity_scorer,
        stage_context=app.state.stage_context,
    )
    try:
        app.state.stage_classifier_bundle = load_stage_bundle(settings)
        app.state.stage_classifier_error = None
    except FileNotFoundError as exc:
        app.state.stage_classifier_bundle = None
        app.state.stage_classifier_error = exc
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
app.include_router(feedback.router)
app.include_router(stage_classification.router)
app.include_router(feedback_scoring.router)
