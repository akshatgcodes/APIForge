import httpx

from app import proxy


def make(owner, name="Shop"):
    return owner.post("/api/collections", json={"name": name}).json()


def add(owner, cid, **fields):
    r = owner.post(f"/api/collections/{cid}/requests", json=fields)
    assert r.status_code == 201, r.text
    return r.json()


def test_needs_login(client):
    assert client.get("/api/collections").status_code == 401
    assert (
        client.post("/api/send", json={"method": "GET", "url": "https://x.test"}).status_code == 401
    )
    assert client.post("/api/auth/login", json={"password": "nope"}).status_code == 401
    assert client.get("/api/auth/me").json() == {"owner": False}


def test_collection_crud(owner):
    c = make(owner)
    assert c["folders"] == [] and c["requests"] == [] and c["variables"] == []
    add(owner, c["id"], name="List products", url="{{base}}/products")
    listed = owner.get("/api/collections").json()
    assert [(x["name"], x["requests"]) for x in listed] == [("Shop", 1)]

    patched = owner.patch(
        f"/api/collections/{c['id']}",
        json={"name": "Store", "variables": [{"key": "base", "value": "https://s.test"}]},
    ).json()
    assert patched["name"] == "Store" and patched["variables"] == [
        {"key": "base", "value": "https://s.test"}
    ]

    assert owner.delete(f"/api/collections/{c['id']}").status_code == 204
    assert owner.get(f"/api/collections/{c['id']}").status_code == 404


def test_variables_validated(owner):
    c = make(owner)
    dup = [{"key": "a", "value": "1"}, {"key": "a", "value": "2"}]
    assert owner.patch(f"/api/collections/{c['id']}", json={"variables": dup}).status_code == 422
    bad = [{"key": "has space", "value": "1"}]
    assert owner.patch(f"/api/collections/{c['id']}", json={"variables": bad}).status_code == 422


def test_requests_and_folders(owner):
    c = make(owner)
    cid = c["id"]
    folder = owner.post(f"/api/collections/{cid}/folders", json={"name": "Auth"}).json()
    a = add(owner, cid, name="Login", method="POST", folder_id=folder["id"])
    b = add(owner, cid, name="Health")

    patched = owner.patch(
        f"/api/requests/{b['id']}",
        json={"url": "https://s.test/health", "headers": [{"key": "Accept", "value": "*/*"}]},
    ).json()
    assert patched["name"] == "Health" and patched["headers"][0]["enabled"] is True
    assert owner.patch(f"/api/requests/{b['id']}", json={"method": "FETCH"}).status_code == 422

    # Move into the folder, then back to the top level
    assert (
        owner.patch(f"/api/requests/{b['id']}", json={"folder_id": folder["id"]}).json()[
            "folder_id"
        ]
        == folder["id"]
    )
    t = owner.get(f"/api/collections/{cid}").json()
    assert [r["name"] for r in t["folders"][0]["requests"]] == ["Login", "Health"]
    assert (
        owner.patch(f"/api/requests/{b['id']}", json={"folder_id": None}).json()["folder_id"]
        is None
    )

    dup = owner.post(f"/api/requests/{a['id']}/duplicate").json()
    assert (
        dup["name"] == "Login copy" and dup["method"] == "POST" and dup["folder_id"] == folder["id"]
    )

    other = make(owner, "Other")
    assert add_fails(owner, other["id"], folder["id"])

    assert owner.delete(f"/api/folders/{folder['id']}").status_code == 204
    t = owner.get(f"/api/collections/{cid}").json()
    assert t["folders"] == [] and [r["name"] for r in t["requests"]] == ["Health"]


def add_fails(owner, cid, foreign_folder):
    r = owner.post(f"/api/collections/{cid}/requests", json={"folder_id": foreign_folder})
    return r.status_code == 422


def test_layout(owner):
    cid = make(owner)["id"]
    f1 = owner.post(f"/api/collections/{cid}/folders", json={"name": "One"}).json()["id"]
    f2 = owner.post(f"/api/collections/{cid}/folders", json={"name": "Two"}).json()["id"]
    r1, r2, r3 = (add(owner, cid, name=n)["id"] for n in ("a", "b", "c"))

    layout = {
        "folders": [f2, f1],
        "requests": [
            {"id": r3, "folder_id": None},
            {"id": r1, "folder_id": f2},
            {"id": r2, "folder_id": f2},
        ],
    }
    t = owner.put(f"/api/collections/{cid}/layout", json=layout).json()
    assert [f["name"] for f in t["folders"]] == ["Two", "One"]
    assert [r["name"] for r in t["folders"][0]["requests"]] == ["a", "b"]
    assert [r["name"] for r in t["requests"]] == ["c"]

    partial = {"folders": [f1, f2], "requests": [{"id": r1}]}
    assert owner.put(f"/api/collections/{cid}/layout", json=partial).status_code == 422


def test_export_import_roundtrip(owner):
    ex = owner.post("/api/collections/example").json()
    assert [f["name"] for f in ex["folders"]] == ["Auth", "Notes"]
    assert ex["variables"][0] == {"key": "base_url", "value": "https://forge.test/demo"}

    exported = owner.get(f"/api/collections/{ex['id']}/export").json()
    assert exported["apiforge"] == 1 and "id" not in exported["folders"][0]["requests"][0]

    imported = owner.post("/api/collections/import", json=exported).json()
    assert imported["id"] != ex["id"] and imported["skipped"] == []
    again = owner.get(f"/api/collections/{imported['id']}/export").json()
    assert again == exported


def test_import_rejects_garbage(owner):
    r = owner.post("/api/collections/import", json={"name": "x", "requests": [{"method": "NOPE"}]})
    assert r.status_code == 422


def test_postman_import(owner):
    postman = {
        "info": {
            "name": "Petstore",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/",
        },
        "variable": [
            {"key": "baseUrl", "value": "https://pets.test"},
            {"key": "bad key", "value": "x"},
        ],
        "auth": {"type": "bearer"},
        "item": [
            {"name": "Ping", "request": "https://pets.test/ping"},
            {
                "name": "Pets",
                "item": [
                    {
                        "name": "Create pet",
                        "event": [{"listen": "test"}],
                        "request": {
                            "method": "POST",
                            "url": {"raw": "{{baseUrl}}/pets"},
                            "header": [
                                {"key": "X-Trace", "value": "1"},
                                {"key": "X-Off", "value": "0", "disabled": True},
                            ],
                            "body": {"mode": "raw", "raw": '{"name": "Rex"}'},
                        },
                    },
                    {
                        "name": "Admin",
                        "item": [
                            {
                                "name": "Purge",
                                "request": {"method": "DELETE", "url": "{{baseUrl}}/pets"},
                            }
                        ],
                    },
                ],
            },
        ],
    }
    t = owner.post("/api/collections/import", json=postman).json()
    assert t["name"] == "Petstore"
    assert t["variables"] == [{"key": "baseUrl", "value": "https://pets.test"}]
    assert [r["url"] for r in t["requests"]] == ["https://pets.test/ping"]
    assert [f["name"] for f in t["folders"]] == ["Pets / Admin", "Pets"]
    create = t["folders"][1]["requests"][0]
    assert create["method"] == "POST" and create["body_type"] == "json"
    assert [h["enabled"] for h in create["headers"]] == [True, False]
    assert any("Scripts" in s for s in t["skipped"])
    assert any("auth" in s for s in t["skipped"])
    assert any("bad key" in s for s in t["skipped"])


def test_send_endpoint(owner, monkeypatch):
    monkeypatch.setattr(proxy, "resolve", lambda host, port: ["93.184.216.34"])
    monkeypatch.setattr(
        proxy,
        "transport",
        httpx.MockTransport(lambda r: httpx.Response(200, json={"echo": r.headers.get("x-a")})),
    )
    body = {
        "method": "GET",
        "url": "https://api.test/",
        "headers": [
            {"key": "X-A", "value": "on"},
            {"key": "X-B", "value": "off", "enabled": False},
        ],
    }
    res = owner.post("/api/send", json=body).json()
    assert res["status"] == 200 and res["body"] == '{"echo":"on"}'
    assert ["content-type", "application/json"] in res["headers"]


def test_send_blocks_private_targets(owner):
    r = owner.post("/api/send", json={"method": "GET", "url": "http://127.0.0.1:8000/health"})
    assert r.status_code == 400 and "ALLOW_PRIVATE_TARGETS" in r.json()["detail"]
