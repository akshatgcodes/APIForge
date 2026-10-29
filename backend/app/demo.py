"""A tiny notes API that the example collection runs against.

It exists so request chaining can be tried with no outside service: log in, take the
token from the response, then use it (and a created note's id) in later requests.
State lives in memory and is capped, since anyone can call it.
"""

from collections import OrderedDict
from itertools import count

from fastapi import APIRouter, Header, HTTPException, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer
from pydantic import BaseModel, Field

from app.config import settings

router = APIRouter(prefix="/demo", tags=["demo"])

DEMO_PASSWORD = "demo"
TOKEN_MAX_AGE = 60 * 60
MAX_USERS = 500
MAX_NOTES = 50

signer = URLSafeTimedSerializer(settings.session_secret, salt="apiforge-demo")
_notes: OrderedDict[str, dict[int, dict]] = OrderedDict()
_ids = count(1)


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    password: str


class NoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


def _user(authorization: str | None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Send Authorization: Bearer <access_token>")
    try:
        return signer.loads(token, max_age=TOKEN_MAX_AGE)
    except BadSignature as e:
        raise HTTPException(401, "Invalid or expired token") from e


def _store(user: str) -> dict[int, dict]:
    if user not in _notes:
        if len(_notes) >= MAX_USERS:
            _notes.popitem(last=False)
        _notes[user] = {}
    _notes.move_to_end(user)
    return _notes[user]


@router.post("/login")
def login(body: LoginIn) -> dict:
    if body.password != DEMO_PASSWORD:
        raise HTTPException(401, f"Wrong password (it's '{DEMO_PASSWORD}')")
    return {
        "access_token": signer.dumps(body.username),
        "token_type": "bearer",
        "expires_in": TOKEN_MAX_AGE,
        "user": {"username": body.username},
    }


@router.get("/me")
def me(authorization: str | None = Header(default=None)) -> dict:
    user = _user(authorization)
    return {"username": user, "notes": len(_store(user))}


@router.get("/notes")
def list_notes(authorization: str | None = Header(default=None)) -> list[dict]:
    return list(_store(_user(authorization)).values())


@router.post("/notes", status_code=201)
def create_note(body: NoteIn, authorization: str | None = Header(default=None)) -> dict:
    notes = _store(_user(authorization))
    if len(notes) >= MAX_NOTES:
        raise HTTPException(409, f"Demo accounts hold at most {MAX_NOTES} notes")
    note = {"id": next(_ids), "text": body.text}
    notes[note["id"]] = note
    return note


@router.get("/notes/{note_id}")
def get_note(note_id: int, authorization: str | None = Header(default=None)) -> dict:
    note = _store(_user(authorization)).get(note_id)
    if note is None:
        raise HTTPException(404, "No such note")
    return note


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int, authorization: str | None = Header(default=None)) -> Response:
    if _store(_user(authorization)).pop(note_id, None) is None:
        raise HTTPException(404, "No such note")
    return Response(status_code=204)
