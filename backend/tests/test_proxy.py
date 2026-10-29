import httpx
import pytest

from app import proxy


@pytest.fixture
def public_dns(monkeypatch):
    """Every host resolves to a public address unless it's listed in `private`."""
    private = {"internal.test": "10.0.0.7", "localhost": "127.0.0.1"}
    monkeypatch.setattr(proxy, "resolve", lambda host, port: [private.get(host, "93.184.216.34")])


@pytest.fixture
def mock(monkeypatch, public_dns):
    """Install a handler as the proxy's transport; returns the list of seen requests."""
    seen: list[httpx.Request] = []

    def install(handler):
        def wrapped(request):
            seen.append(request)
            return handler(request)

        monkeypatch.setattr(proxy, "transport", httpx.MockTransport(wrapped))
        return seen

    return install


def send(url="https://api.test/x", method="GET", headers=None, body=None, **kw):
    return proxy.send(method, url, headers or [], body, **kw)


@pytest.mark.parametrize("url", ["http://localhost:8000/", "http://internal.test/admin"])
def test_private_targets_blocked(public_dns, url):
    with pytest.raises(proxy.ProxyError, match="private network"):
        proxy.check_target(url, allow_private=False)


def test_private_allowed_when_enabled(public_dns):
    proxy.check_target("http://localhost:8000/", allow_private=True)


@pytest.mark.parametrize("url", ["file:///etc/passwd", "ftp://api.test/", "api.test/x"])
def test_only_http(url):
    with pytest.raises(proxy.ProxyError, match="http"):
        proxy.check_target(url, allow_private=True)


def test_basic_json_response(mock):
    seen = mock(lambda r: httpx.Response(200, json={"ok": True}, headers={"X-Id": "7"}))
    res = send(headers=[("Accept", "application/json"), ("Connection", "close")])
    assert res.status == 200 and res.reason == "OK"
    assert res.body == '{"ok":true}' and not res.binary and res.size == len(res.body)
    assert ("x-id", "7") in res.headers
    assert res.time_ms >= 0
    sent = seen[0].headers
    assert sent["accept"] == "application/json"
    assert sent["user-agent"] == proxy.USER_AGENT
    assert sent["connection"] == "keep-alive"  # ours, not the user's hop-by-hop "close"


def test_user_agent_not_overridden(mock):
    seen = mock(lambda r: httpx.Response(204))
    send(headers=[("User-Agent", "mine")])
    assert seen[0].headers["user-agent"] == "mine"


def test_body_is_sent(mock):
    seen = mock(lambda r: httpx.Response(201, text=r.content.decode()))
    res = send(method="POST", body='{"a":1}', headers=[("Content-Type", "application/json")])
    assert res.status == 201 and res.body == '{"a":1}'
    assert seen[0].headers["content-type"] == "application/json"


def test_binary_body_not_returned(mock):
    mock(
        lambda r: httpx.Response(200, content=b"\x89PNG\r\n", headers={"content-type": "image/png"})
    )
    res = send()
    assert res.binary and res.body is None and res.size == 6


def test_large_body_truncated(mock, monkeypatch):
    monkeypatch.setattr(proxy, "MAX_BYTES", 10)
    mock(lambda r: httpx.Response(200, text="x" * 50))
    res = send()
    assert res.truncated and res.size == 10 and res.body == "x" * 10


def test_post_redirect_becomes_get(mock):
    def handler(r):
        if r.url.path == "/login":
            return httpx.Response(302, headers={"location": "/home"})
        return httpx.Response(200, text=f"{r.method} {r.content!r}")

    seen = mock(handler)
    res = send(
        url="https://api.test/login",
        method="POST",
        body="a=1",
        headers=[("Content-Type", "text/plain"), ("Authorization", "Bearer t")],
    )
    assert res.body == "GET b''" and res.url == "https://api.test/home"
    assert res.redirects == [{"status": 302, "url": "https://api.test/home"}]
    assert "content-type" not in seen[1].headers
    assert seen[1].headers["authorization"] == "Bearer t"  # same origin keeps credentials


def test_307_keeps_method_and_body(mock):
    def handler(r):
        if r.url.path == "/a":
            return httpx.Response(307, headers={"location": "/b"})
        return httpx.Response(200, text=f"{r.method} {r.content.decode()}")

    mock(handler)
    assert send(url="https://api.test/a", method="PUT", body="data").body == "PUT data"


def test_cross_origin_redirect_drops_credentials(mock):
    def handler(r):
        if r.url.host == "api.test":
            return httpx.Response(301, headers={"location": "https://other.test/"})
        return httpx.Response(200)

    seen = mock(handler)
    send(headers=[("Authorization", "Bearer secret"), ("Cookie", "s=1"), ("X-Keep", "1")])
    assert "authorization" not in seen[1].headers and "cookie" not in seen[1].headers
    assert seen[1].headers["x-keep"] == "1"


def test_redirect_to_private_address_blocked(mock):
    mock(lambda r: httpx.Response(302, headers={"location": "http://internal.test/secret"}))
    with pytest.raises(proxy.ProxyError, match="private network"):
        send()


def test_redirects_not_followed_when_disabled(mock):
    mock(lambda r: httpx.Response(302, headers={"location": "/next"}))
    res = send(follow_redirects=False)
    assert res.status == 302 and res.redirects == []


def test_redirect_loop_stops(mock):
    mock(lambda r: httpx.Response(302, headers={"location": "/again"}))
    with pytest.raises(proxy.ProxyError, match="redirects") as e:
        send()
    assert e.value.status == 502


def test_timeout_and_connect_errors(mock):
    def timeout(r):
        raise httpx.ReadTimeout("slow", request=r)

    mock(timeout)
    with pytest.raises(proxy.ProxyError, match="Timed out") as e:
        send(timeout=2)
    assert e.value.status == 504

    def refused(r):
        raise httpx.ConnectError("refused", request=r)

    mock(refused)
    with pytest.raises(proxy.ProxyError, match="Couldn't connect") as e:
        send()
    assert e.value.status == 502
