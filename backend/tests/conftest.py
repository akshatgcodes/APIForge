import os
import tempfile

# Settings are read at import time, so point them at a throwaway DB before importing the app
_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db.name}"
os.environ["APP_PASSWORD"] = "test-pass"
os.environ["ALLOW_PRIVATE_TARGETS"] = "false"
os.environ["PUBLIC_API_URL"] = "https://forge.test"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def owner(client):
    assert client.post("/api/auth/login", json={"password": "test-pass"}).status_code == 200
    return client
