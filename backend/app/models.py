from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, JsonColumn


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    # [{"key": "base_url", "value": "..."}]. Extract rules write back into this list,
    # which is how one request's response feeds the next request.
    variables: Mapped[list[dict[str, Any]]] = mapped_column(JsonColumn, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    folders: Mapped[list["Folder"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan", order_by="Folder.position"
    )
    requests: Mapped[list["ApiRequest"]] = relationship(
        back_populates="collection",
        cascade="all, delete-orphan",
        order_by="ApiRequest.position",
    )


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[int] = mapped_column(primary_key=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column(Integer, default=0)

    collection: Mapped[Collection] = relationship(back_populates="folders")


class ApiRequest(Base):
    __tablename__ = "requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True
    )
    # NULL = sits at the top level of the collection
    folder_id: Mapped[int | None] = mapped_column(
        ForeignKey("folders.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    method: Mapped[str] = mapped_column(String(10), default="GET")
    url: Mapped[str] = mapped_column(Text, default="")
    # [{"key", "value", "enabled"}]
    headers: Mapped[list[dict[str, Any]]] = mapped_column(JsonColumn, default=list)
    body_type: Mapped[str] = mapped_column(String(10), default="none")
    body: Mapped[str] = mapped_column(Text, default="")
    # [{"var", "source": body|header|status, "path"}]
    extracts: Mapped[list[dict[str, Any]]] = mapped_column(JsonColumn, default=list)
    position: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    collection: Mapped[Collection] = relationship(back_populates="requests")
