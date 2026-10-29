from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app import importers
from app.auth import require_owner
from app.config import settings
from app.db import get_db
from app.models import ApiRequest, Collection, Folder
from app.schemas import (
    CollectionCreate,
    CollectionPatch,
    ExportCollection,
    FolderIn,
    Layout,
    RequestCreate,
    RequestFields,
    RequestPatch,
)

router = APIRouter(prefix="/api", tags=["collections"], dependencies=[Depends(require_owner)])

_EDITABLE = ("name", "method", "url", "headers", "body_type", "body", "extracts")


def request_dict(r: ApiRequest) -> dict:
    return {"id": r.id, "folder_id": r.folder_id, **{k: getattr(r, k) for k in _EDITABLE}}


def tree(c: Collection) -> dict:
    by_folder: dict[int | None, list[dict]] = {}
    for r in c.requests:
        by_folder.setdefault(r.folder_id, []).append(request_dict(r))
    return {
        "id": c.id,
        "name": c.name,
        "variables": c.variables,
        "updated_at": c.updated_at,
        "folders": [
            {"id": f.id, "name": f.name, "requests": by_folder.get(f.id, [])} for f in c.folders
        ],
        "requests": by_folder.get(None, []),
    }


def _collection(db: Session, cid: int) -> Collection:
    c = db.get(Collection, cid)
    if c is None:
        raise HTTPException(404, "Collection not found")
    return c


def _folder(db: Session, fid: int) -> Folder:
    f = db.get(Folder, fid)
    if f is None:
        raise HTTPException(404, "Folder not found")
    return f


def _request(db: Session, rid: int) -> ApiRequest:
    r = db.get(ApiRequest, rid)
    if r is None:
        raise HTTPException(404, "Request not found")
    return r


def _check_folder(db: Session, collection_id: int, folder_id: int | None) -> None:
    if folder_id is not None and _folder(db, folder_id).collection_id != collection_id:
        raise HTTPException(422, "That folder belongs to another collection")


def _next_position(db: Session, collection_id: int, folder_id: int | None) -> int:
    last = db.scalar(
        select(func.max(ApiRequest.position)).where(
            ApiRequest.collection_id == collection_id,
            ApiRequest.folder_id.is_(None)
            if folder_id is None
            else ApiRequest.folder_id == folder_id,
        )
    )
    return 0 if last is None else last + 1


def _touch(db: Session, cid: int) -> None:
    """Bump the collection's updated_at so the home list shows recently edited first."""
    db.execute(update(Collection).where(Collection.id == cid).values(updated_at=func.now()))


def _dump(model: Any) -> Any:
    return model.model_dump(mode="json")


def _create_from_export(db: Session, data: ExportCollection) -> Collection:
    c = Collection(name=data.name, variables=_dump(data)["variables"])
    db.add(c)
    db.flush()
    for i, r in enumerate(data.requests):
        db.add(ApiRequest(collection_id=c.id, position=i, **_dump(r)))
    for fi, f in enumerate(data.folders):
        folder = Folder(collection_id=c.id, name=f.name, position=fi)
        db.add(folder)
        db.flush()
        for i, r in enumerate(f.requests):
            db.add(ApiRequest(collection_id=c.id, folder_id=folder.id, position=i, **_dump(r)))
    db.commit()
    db.refresh(c)
    return c


# --- collections ---------------------------------------------------------------------


@router.get("/collections")
def list_collections(db: Session = Depends(get_db)) -> list[dict]:
    counts = dict(
        db.execute(
            select(ApiRequest.collection_id, func.count()).group_by(ApiRequest.collection_id)
        ).all()
    )
    rows = db.scalars(select(Collection).order_by(Collection.updated_at.desc(), Collection.id))
    return [
        {"id": c.id, "name": c.name, "requests": counts.get(c.id, 0), "updated_at": c.updated_at}
        for c in rows
    ]


@router.post("/collections", status_code=201)
def create_collection(body: CollectionCreate, db: Session = Depends(get_db)) -> dict:
    c = Collection(name=body.name.strip() or "Untitled", variables=[])
    db.add(c)
    db.commit()
    db.refresh(c)
    return tree(c)


@router.get("/collections/{cid}")
def get_collection(cid: int, db: Session = Depends(get_db)) -> dict:
    return tree(_collection(db, cid))


@router.patch("/collections/{cid}")
def patch_collection(cid: int, body: CollectionPatch, db: Session = Depends(get_db)) -> dict:
    c = _collection(db, cid)
    if body.name is not None:
        c.name = body.name.strip() or c.name
    if body.variables is not None:
        c.variables = _dump(body)["variables"]
    db.commit()
    db.refresh(c)
    return tree(c)


@router.delete("/collections/{cid}", status_code=204)
def delete_collection(cid: int, db: Session = Depends(get_db)) -> Response:
    db.delete(_collection(db, cid))
    db.commit()
    return Response(status_code=204)


@router.put("/collections/{cid}/layout")
def set_layout(cid: int, body: Layout, db: Session = Depends(get_db)) -> dict:
    """Reorder folders and requests (and move requests between folders) in one go.

    The client sends the whole sidebar, so every folder and request must appear exactly
    once. A partial list would leave positions ambiguous, so it's rejected.
    """
    c = _collection(db, cid)
    folders = {f.id: f for f in c.folders}
    requests = {r.id: r for r in c.requests}
    sent_requests = [item.id for item in body.requests]
    if sorted(body.folders) != sorted(folders) or sorted(sent_requests) != sorted(requests):
        raise HTTPException(422, "Layout must list every folder and request exactly once")
    for i, fid in enumerate(body.folders):
        folders[fid].position = i
    counters: dict[int | None, int] = {}
    for item in body.requests:
        if item.folder_id is not None and item.folder_id not in folders:
            raise HTTPException(422, "That folder belongs to another collection")
        r = requests[item.id]
        r.folder_id = item.folder_id
        r.position = counters.get(item.folder_id, 0)
        counters[item.folder_id] = r.position + 1
    db.commit()
    db.refresh(c)
    return tree(c)


@router.get("/collections/{cid}/export")
def export_collection(cid: int, db: Session = Depends(get_db)) -> dict:
    t = tree(_collection(db, cid))

    def strip(r: dict) -> dict:
        return {k: r[k] for k in _EDITABLE}

    return {
        "apiforge": 1,
        "name": t["name"],
        "variables": t["variables"],
        "folders": [
            {"name": f["name"], "requests": [strip(r) for r in f["requests"]]} for f in t["folders"]
        ],
        "requests": [strip(r) for r in t["requests"]],
    }


@router.post("/collections/import", status_code=201)
def import_collection(data: dict[str, Any], db: Session = Depends(get_db)) -> dict:
    """Accepts our own export file or a Postman v2.1 collection."""
    skipped: list[str] = []
    try:
        if importers.is_postman(data):
            parsed, skipped = importers.from_postman(data)
        else:
            parsed = ExportCollection.model_validate(data)
    except ValidationError as e:
        raise HTTPException(422, e.errors(include_url=False, include_context=False)) from e
    return {**tree(_create_from_export(db, parsed)), "skipped": skipped}


@router.post("/collections/example", status_code=201)
def create_example(db: Session = Depends(get_db)) -> dict:
    """A ready-to-run collection against the built-in /demo API."""
    auth = [{"key": "Authorization", "value": "Bearer {{token}}", "enabled": True}]
    data = ExportCollection(
        name="Notes API (example)",
        variables=[
            {"key": "base_url", "value": f"{settings.public_api_url.rstrip('/')}/demo"},
            {"key": "username", "value": "ada"},
            {"key": "token", "value": ""},
            {"key": "note_id", "value": ""},
        ],
        folders=[
            {
                "name": "Auth",
                "requests": [
                    {
                        "name": "Log in",
                        "method": "POST",
                        "url": "{{base_url}}/login",
                        "body_type": "json",
                        "body": '{\n  "username": "{{username}}",\n  "password": "demo"\n}',
                        "extracts": [{"var": "token", "source": "body", "path": "access_token"}],
                    },
                    {"name": "Who am I", "url": "{{base_url}}/me", "headers": auth},
                ],
            },
            {
                "name": "Notes",
                "requests": [
                    {
                        "name": "Create note",
                        "method": "POST",
                        "url": "{{base_url}}/notes",
                        "headers": auth,
                        "body_type": "json",
                        "body": '{\n  "text": "Written at {{$isoTimestamp}}"\n}',
                        "extracts": [{"var": "note_id", "source": "body", "path": "id"}],
                    },
                    {"name": "Get note", "url": "{{base_url}}/notes/{{note_id}}", "headers": auth},
                    {"name": "List notes", "url": "{{base_url}}/notes", "headers": auth},
                    {
                        "name": "Delete note",
                        "method": "DELETE",
                        "url": "{{base_url}}/notes/{{note_id}}",
                        "headers": auth,
                    },
                ],
            },
        ],
    )
    return tree(_create_from_export(db, data))


# --- folders -------------------------------------------------------------------------


@router.post("/collections/{cid}/folders", status_code=201)
def create_folder(cid: int, body: FolderIn, db: Session = Depends(get_db)) -> dict:
    c = _collection(db, cid)
    last = db.scalar(select(func.max(Folder.position)).where(Folder.collection_id == cid))
    f = Folder(collection_id=c.id, name=body.name.strip(), position=0 if last is None else last + 1)
    db.add(f)
    _touch(db, cid)
    db.commit()
    return {"id": f.id, "name": f.name, "requests": []}


@router.patch("/folders/{fid}")
def rename_folder(fid: int, body: FolderIn, db: Session = Depends(get_db)) -> dict:
    f = _folder(db, fid)
    f.name = body.name.strip() or f.name
    _touch(db, f.collection_id)
    db.commit()
    return {"id": f.id, "name": f.name}


@router.delete("/folders/{fid}", status_code=204)
def delete_folder(fid: int, db: Session = Depends(get_db)) -> Response:
    f = _folder(db, fid)
    # Delete the requests explicitly: SQLite ignores ON DELETE CASCADE unless the
    # foreign_keys pragma is on
    for r in db.scalars(select(ApiRequest).where(ApiRequest.folder_id == fid)):
        db.delete(r)
    db.delete(f)
    _touch(db, f.collection_id)
    db.commit()
    return Response(status_code=204)


# --- requests ------------------------------------------------------------------------


@router.post("/collections/{cid}/requests", status_code=201)
def create_request(cid: int, body: RequestCreate, db: Session = Depends(get_db)) -> dict:
    _collection(db, cid)
    _check_folder(db, cid, body.folder_id)
    r = ApiRequest(
        collection_id=cid,
        position=_next_position(db, cid, body.folder_id),
        **_dump(body),
    )
    db.add(r)
    _touch(db, cid)
    db.commit()
    return request_dict(r)


@router.patch("/requests/{rid}")
def patch_request(rid: int, body: RequestPatch, db: Session = Depends(get_db)) -> dict:
    r = _request(db, rid)
    # Pick top-level fields that were sent, but dump them whole: exclude_unset would also
    # drop defaults inside nested items, like a header's "enabled"
    changes = {k: v for k, v in body.model_dump(mode="json").items() if k in body.model_fields_set}
    if "folder_id" in changes and changes["folder_id"] != r.folder_id:
        _check_folder(db, r.collection_id, changes["folder_id"])
        r.position = _next_position(db, r.collection_id, changes["folder_id"])
    for key, value in changes.items():
        if value is None and key != "folder_id":
            continue
        setattr(r, key, value)
    _touch(db, r.collection_id)
    db.commit()
    return request_dict(r)


@router.post("/requests/{rid}/duplicate", status_code=201)
def duplicate_request(rid: int, db: Session = Depends(get_db)) -> dict:
    src = _request(db, rid)
    fields = RequestFields.model_validate(request_dict(src))
    copy = ApiRequest(
        collection_id=src.collection_id,
        folder_id=src.folder_id,
        position=_next_position(db, src.collection_id, src.folder_id),
        **{**_dump(fields), "name": f"{src.name} copy"[:120]},
    )
    db.add(copy)
    _touch(db, src.collection_id)
    db.commit()
    return request_dict(copy)


@router.delete("/requests/{rid}", status_code=204)
def delete_request(rid: int, db: Session = Depends(get_db)) -> Response:
    r = _request(db, rid)
    db.delete(r)
    _touch(db, r.collection_id)
    db.commit()
    return Response(status_code=204)
