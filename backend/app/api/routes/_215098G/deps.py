from fastapi import Request


def get_stage_classifier_bundle(request: Request):
    error = getattr(request.app.state, "stage_classifier_error", None)
    if error is not None:
        return None

    return request.app.state.stage_classifier_bundle
