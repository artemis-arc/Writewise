from fastapi import Request

from app.services._215131E.scenario_retriever import ScenarioRetriever
from app.services._215131E.srsd_scoring import SrsdScorer


def get_retriever(request: Request) -> ScenarioRetriever:
    return request.app.state.retriever


def get_srsd_scorer(request: Request) -> SrsdScorer:
    return request.app.state.srsd_scorer
