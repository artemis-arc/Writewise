import json
import os
import tempfile
from pathlib import Path
from typing import Any


def write_json_atomically(path: Path, payload: Any) -> None:
    """
    Write JSON so that a crash mid-write cannot leave a truncated file behind: serialize
    to a temp file in the same directory, fsync it, then os.replace it into position --
    replace is atomic on both Windows and POSIX as long as both paths share a volume.

    Used by everything under this module that keeps learned state on disk, since a
    corrupted Q-table or session log means losing the run, not just the request.
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    # delete=False plus an explicit replace: on Windows a NamedTemporaryFile cannot be
    # reopened or moved by another handle while it is still open.
    handle = tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=path.parent,
        prefix=path.name,
        suffix=".tmp",
        delete=False,
    )
    try:
        with handle:
            json.dump(payload, handle)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(handle.name, path)
    except BaseException:
        Path(handle.name).unlink(missing_ok=True)
        raise
