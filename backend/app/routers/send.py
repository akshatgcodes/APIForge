from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool

from app import proxy
from app.auth import require_owner
from app.config import settings
from app.schemas import SendIn

router = APIRouter(prefix="/api", tags=["send"], dependencies=[Depends(require_owner)])


@router.post("/send")
async def send(body: SendIn) -> dict:
    """Run one already-rendered request. Variables are filled in by the browser."""
    headers = [(h.key.strip(), h.value) for h in body.headers if h.enabled and h.key.strip()]
    try:
        result = await run_in_threadpool(
            proxy.send,
            body.method,
            body.url.strip(),
            headers,
            body.body,
            follow_redirects=body.follow_redirects,
            allow_private=settings.allow_private_targets,
            timeout=settings.proxy_timeout,
        )
    except proxy.ProxyError as e:
        raise HTTPException(e.status, str(e)) from e
    return {**result.__dict__, "headers": [list(h) for h in result.headers]}
