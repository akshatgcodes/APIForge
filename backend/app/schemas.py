"""Request/response shapes shared by the routers and the importer."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
Method = Literal["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
BodyType = Literal["none", "json", "text"]

# Same rule the frontend template engine uses for {{name}}
VAR_NAME = r"^[A-Za-z_][A-Za-z0-9_.-]{0,63}$"


class Header(BaseModel):
    key: str = Field("", max_length=256)
    value: str = Field("", max_length=8192)
    enabled: bool = True


class Extract(BaseModel):
    var: str = Field(pattern=VAR_NAME)
    source: Literal["body", "header", "status"] = "body"
    # JSON path for body ("data.items[0].id"), header name for header, unused for status
    path: str = Field("", max_length=256)


class Variable(BaseModel):
    key: str = Field(pattern=VAR_NAME)
    value: str = Field("", max_length=8192)


def _unique_keys(items: list[Variable]) -> list[Variable]:
    seen: set[str] = set()
    for v in items:
        if v.key in seen:
            raise ValueError(f"Variable '{v.key}' is defined twice")
        seen.add(v.key)
    return items


class RequestFields(BaseModel):
    name: str = Field("New request", min_length=1, max_length=120)
    method: Method = "GET"
    url: str = Field("", max_length=4096)
    headers: list[Header] = Field(default_factory=list, max_length=50)
    body_type: BodyType = "none"
    body: str = Field("", max_length=1_000_000)
    extracts: list[Extract] = Field(default_factory=list, max_length=20)


class RequestCreate(RequestFields):
    folder_id: int | None = None


class RequestPatch(BaseModel):
    """Every field optional; only the ones sent are changed."""

    name: str | None = Field(None, min_length=1, max_length=120)
    method: Method | None = None
    url: str | None = Field(None, max_length=4096)
    headers: list[Header] | None = Field(None, max_length=50)
    body_type: BodyType | None = None
    body: str | None = Field(None, max_length=1_000_000)
    extracts: list[Extract] | None = Field(None, max_length=20)
    folder_id: int | None = None


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class CollectionPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    variables: list[Variable] | None = Field(None, max_length=200)

    @field_validator("variables")
    @classmethod
    def _unique(cls, v: list[Variable] | None) -> list[Variable] | None:
        return v if v is None else _unique_keys(v)


class FolderIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class LayoutItem(BaseModel):
    id: int
    folder_id: int | None = None


class Layout(BaseModel):
    """The full order of a collection's sidebar: every folder and every request, once."""

    folders: list[int]
    requests: list[LayoutItem]


# Export / import format. Ids are left out so a file can be imported anywhere.
class ExportFolder(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    requests: list[RequestFields] = Field(default_factory=list, max_length=500)


class ExportCollection(BaseModel):
    apiforge: Literal[1] = 1
    name: str = Field(min_length=1, max_length=120)
    variables: list[Variable] = Field(default_factory=list, max_length=200)
    folders: list[ExportFolder] = Field(default_factory=list, max_length=100)
    requests: list[RequestFields] = Field(default_factory=list, max_length=500)

    @field_validator("variables")
    @classmethod
    def _unique(cls, v: list[Variable]) -> list[Variable]:
        return _unique_keys(v)


class SendIn(BaseModel):
    method: Method
    url: str = Field(min_length=1, max_length=4096)
    headers: list[Header] = Field(default_factory=list, max_length=50)
    body: str | None = Field(None, max_length=1_000_000)
    follow_redirects: bool = True
