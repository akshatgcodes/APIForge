def login(client, username="ada"):
    r = client.post("/demo/login", json={"username": username, "password": "demo"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_login(client):
    assert client.post("/demo/login", json={"username": "ada", "password": "x"}).status_code == 401
    body = client.post("/demo/login", json={"username": "ada", "password": "demo"}).json()
    assert body["token_type"] == "bearer" and body["user"] == {"username": "ada"}


def test_token_required(client):
    assert client.get("/demo/me").status_code == 401
    assert client.get("/demo/me", headers={"Authorization": "Bearer junk"}).status_code == 401
    assert client.get("/demo/me", headers=login(client)).json()["username"] == "ada"


def test_notes_flow_is_per_user(client):
    ada, bob = login(client, "ada-notes"), login(client, "bob-notes")
    note = client.post("/demo/notes", json={"text": "hi"}, headers=ada).json()
    assert client.get(f"/demo/notes/{note['id']}", headers=ada).json() == note
    assert client.get(f"/demo/notes/{note['id']}", headers=bob).status_code == 404
    assert client.get("/demo/notes", headers=bob).json() == []
    assert client.delete(f"/demo/notes/{note['id']}", headers=ada).status_code == 204
    assert client.delete(f"/demo/notes/{note['id']}", headers=ada).status_code == 404
