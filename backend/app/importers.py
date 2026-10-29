"""Turn a Postman v2.1 collection into our export format.

Postman uses the same {{variable}} syntax, so URLs, headers and bodies carry over as-is.
Postman allows folders inside folders; we have one level, so deeper folders are
flattened into names like "Users / Admin".
"""

import re
from typing import Any

from app.schemas import METHODS, VAR_NAME, ExportCollection, ExportFolder, RequestFields

_MAX_NAME = 120


def is_postman(data: Any) -> bool:
    return isinstance(data, dict) and isinstance(data.get("info"), dict) and "item" in data


def _url(url: Any) -> str:
    if isinstance(url, str):
        return url
    if isinstance(url, dict):
        return str(url.get("raw", ""))
    return ""


def _request(name: str, req: Any) -> RequestFields:
    if isinstance(req, str):  # shorthand: "request": "https://..."
        req = {"url": req}
    method = str(req.get("method", "GET")).upper()
    headers = [
        {
            "key": str(h.get("key", "")),
            "value": str(h.get("value", "")),
            "enabled": not h.get("disabled", False),
        }
        for h in req.get("header") or []
        if isinstance(h, dict)
    ]
    body_type, body = "none", ""
    b = req.get("body") or {}
    if b.get("mode") == "raw" and b.get("raw"):
        body = str(b["raw"])
        language = (b.get("options") or {}).get("raw", {}).get("language", "")
        body_type = "json" if language == "json" or body.lstrip()[:1] in "{[" else "text"
    return RequestFields(
        name=(name or "Untitled")[:_MAX_NAME],
        method=method if method in METHODS else "GET",
        url=_url(req.get("url")),
        headers=headers,
        body_type=body_type,
        body=body,
    )


def from_postman(data: dict) -> tuple[ExportCollection, list[str]]:
    """Returns the collection plus a list of things that didn't carry over."""
    skipped: list[str] = []
    folders: list[ExportFolder] = []
    top: list[RequestFields] = []

    def walk(items: list, path: list[str]) -> None:
        here: list[RequestFields] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name", "Untitled"))
            if "item" in item:
                walk(item["item"] or [], [*path, name])
            elif "request" in item:
                here.append(_request(name, item["request"]))
            if item.get("event"):
                skipped.append(f"Scripts on '{name}'")
        if not path:
            top.extend(here)
        elif here:
            folders.append(ExportFolder(name=" / ".join(path)[:_MAX_NAME], requests=here))

    walk(data.get("item") or [], [])
    variables: dict[str, str] = {}
    for v in data.get("variable") or []:
        key = str(v.get("key", "")) if isinstance(v, dict) else ""
        if not re.match(VAR_NAME, key) or key in variables:
            skipped.append(f"Variable '{key}'")
            continue
        variables[key] = str(v.get("value", ""))
    if data.get("auth"):
        skipped.append("Collection-level auth (add it as a header instead)")
    name = str(data["info"].get("name") or "Imported collection")[:_MAX_NAME]
    return ExportCollection(
        name=name,
        variables=[{"key": k, "value": val} for k, val in variables.items()],
        folders=folders,
        requests=top,
    ), skipped
