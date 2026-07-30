from fastapi import Request

from app.services._215043K.engine import FeedbackEngine


def get_feedback_engine(request: Request) -> FeedbackEngine:
    return request.app.state.feedback_engine
