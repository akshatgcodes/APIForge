"""Send a request on the browser's behalf and report what came back.

Browsers can't call arbitrary APIs directly (CORS), so the frontend hands the fully
rendered request to this module. A server that fetches any URL a user types is an SSRF
hole, so unless ALLOW_PRIVATE_TARGETS is on, every hop must resolve only to public
addresses, and redirects are followed by hand so each one is re-checked.
"""

import ipaddress
import socket
import time
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

import httpx

MAX_BYTES = 5 * 1024 * 1024
MAX_REDIRECTS = 10
USER_AGENT = "APIForge/0.1"

# Headers that describe one TCP hop, or that httpx must compute itself
_DROP = {
    "connection",
    "keep-alive",
    "proxy-connection",
    "transfer-encoding",
    "upgrade",
    "te",
    "trailer",
    "content-length",
}
_TEXT_TYPES = ("json", "xml", "javascript", "x-www-form-urlencoded", "html", "csv", "yaml")

# Tests swap this for httpx.MockTransport
transport: httpx.BaseTransport | None = None


class ProxyError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def resolve(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    return [info[4][0] for info in infos]


def check_target(url: str, allow_private: bool) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ProxyError("Only http:// and https:// URLs can be sent")
    if allow_private:
        return
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        addresses = resolve(parsed.hostname, port)
    except socket.gaierror as e:
        raise ProxyError(f"Couldn't resolve {parsed.hostname}", 502) from e
    for addr in addresses:
        if not ipaddress.ip_address(addr).is_global:
            raise ProxyError(
                f"{parsed.hostname} points to a private network address. "
                "Set ALLOW_PRIVATE_TARGETS=true to call local APIs."
            )


def _origin(url: str) -> tuple[str, str | None, int | None]:
    p = urlparse(url)
    return p.scheme, p.hostname, p.port


def _is_text(content_type: str, raw: bytes) -> bool:
    ct = content_type.lower()
    if ct.startswith("text/") or any(t in ct for t in _TEXT_TYPES):
        return True
    if ct:
        return False
    # No content-type: call it text if it decodes cleanly
    try:
        raw.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


@dataclass
class Result:
    status: int
    reason: str
    headers: list[tuple[str, str]]
    body: str | None
    binary: bool
    truncated: bool
    size: int
    time_ms: int
    url: str
    redirects: list[dict] = field(default_factory=list)


def send(
    method: str,
    url: str,
    headers: list[tuple[str, str]],
    body: str | None,
    *,
    follow_redirects: bool = True,
    allow_private: bool = False,
    timeout: float = 30.0,
) -> Result:
    # Surrounding whitespace isn't part of a header value (RFC 9110), and h11 rejects it,
    # so "Bearer {{token}}" with an empty token still sends
    out_headers = [(k.strip(), v.strip()) for k, v in headers if k and k.lower() not in _DROP]
    if not any(k.lower() == "user-agent" for k, _ in out_headers):
        out_headers.append(("User-Agent", USER_AGENT))
    # A GET with a body is unusual but legal; send whatever the user wrote, like curl
    content = body.encode() if body else None

    redirects: list[dict] = []
    started = time.perf_counter()
    with httpx.Client(timeout=timeout, follow_redirects=False, transport=transport) as client:
        for _ in range(MAX_REDIRECTS + 1):
            check_target(url, allow_private)
            try:
                req = client.build_request(method, url, headers=out_headers, content=content)
                r = client.send(req, stream=True)
            except httpx.TimeoutException as e:
                raise ProxyError(f"Timed out after {timeout:g}s", 504) from e
            except httpx.InvalidURL as e:
                raise ProxyError(f"Invalid URL: {e}") from e
            except httpx.LocalProtocolError as e:
                raise ProxyError(f"Invalid request: {e}") from e
            except httpx.HTTPError as e:
                raise ProxyError(f"Couldn't connect: {e}", 502) from e
            try:
                if follow_redirects and r.is_redirect:
                    nxt = urljoin(url, r.headers["location"])
                    redirects.append({"status": r.status_code, "url": nxt})
                    # Browsers turn POST into GET on 301/302, and anything but HEAD on 303
                    if (r.status_code == 303 and method != "HEAD") or (
                        r.status_code in (301, 302) and method == "POST"
                    ):
                        method, content = "GET", None
                        out_headers = [
                            (k, v) for k, v in out_headers if k.lower() != "content-type"
                        ]
                    # Don't hand credentials to a different host (same rule as curl/requests)
                    if _origin(nxt) != _origin(url):
                        out_headers = [
                            (k, v)
                            for k, v in out_headers
                            if k.lower() not in ("authorization", "cookie")
                        ]
                    url = nxt
                    continue

                raw = b""
                truncated = False
                for chunk in r.iter_bytes():
                    raw += chunk
                    if len(raw) > MAX_BYTES:
                        raw, truncated = raw[:MAX_BYTES], True
                        break
                elapsed = round((time.perf_counter() - started) * 1000)
                ctype = r.headers.get("content-type", "")
                text = _is_text(ctype, raw)
                return Result(
                    status=r.status_code,
                    reason=r.reason_phrase,
                    headers=list(r.headers.multi_items()),
                    body=raw.decode(r.encoding or "utf-8", errors="replace") if text else None,
                    binary=not text,
                    truncated=truncated,
                    size=len(raw),
                    time_ms=elapsed,
                    url=url,
                    redirects=redirects,
                )
            finally:
                r.close()
    raise ProxyError(f"Stopped after {MAX_REDIRECTS} redirects", 502)
