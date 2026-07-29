from fastapi import Request

from app.services._215051H.clarity_scoring import ClarityScorer
from app.services._215051H.feedback_retriever import FeedbackRetriever


def get_feedback_retriever(request: Request) -> FeedbackRetriever:
    return request.app.state.feedback_retriever


def get_clarity_scorer(request: Request) -> ClarityScorer:
    return request.app.state.clarity_scorer
