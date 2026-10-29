# Decisions

### 1. Requests go through a server-side proxy
**Context:** A page can only call APIs that send CORS headers allowing its origin; most don't.
**Decision:** The browser posts the filled-in request to `/api/send`; the server makes the call with httpx and returns status, headers, body and timing.
**Trade-off:** Timing includes the hop from the API server to the target, not from the user's machine. Requests to the user's own `localhost` only work when the API server runs locally too.

### 2. SSRF guard, off only by explicit opt-in
**Decision:** `ALLOW_PRIVATE_TARGETS` defaults to `false`. Every hop's host must resolve only to global addresses; redirects are followed manually so each one is checked; `Authorization` and `Cookie` are dropped when a redirect changes scheme, host or port; bodies are capped at 5 MB. `.env.example` turns private targets on because local development is the main use.
**Known gap:** DNS is resolved for the check and again by httpx when connecting, so a host that changes its answer in between (DNS rebinding) could slip through. Pinning the connection to the checked IP is the fix for v2. The app also sits behind a password, which limits who can try.

### 3. Variables are filled in by the browser
**Decision:** `prepare()` in TypeScript renders `{{name}}` before sending. The server never sees templates.
**Why:** The editor shows the resolved URL and warnings as you type, the runner needs fresh values between steps, and cURL export needs the same result. One implementation serves all four.
**Trade-off:** A future server-side runner (e.g. for CI) would need a second implementation.

### 4. Extracted values are written into the collection's variables
**Decision:** There's one variable list per collection. Extract rules update it after each send, and it's saved like any other edit.
**Why:** One place to look, and a token from yesterday's login is still there after a reload.
**Trade-off:** No separate "initial" and "current" values like Postman; exporting a collection includes the last token. Clear it in Variables before sharing.

### 5. Requests with undefined variables aren't sent
**Decision:** If a `{{name}}` isn't defined, the send is blocked with a message. An empty variable only warns, and names the request that sets it.
**Why:** Sending a literal `{{token}}` produces confusing 401s or hits a wrong URL. Empty is often intentional (or means "run Log in first").

### 6. Paths for extraction are a small subset of JSONPath
**Decision:** Dots, `[index]` and `["quoted key"]`, optional leading `$`. No wildcards or filters.
**Why:** Each rule produces one string; wildcards would produce lists. The subset is easy to explain and to generate from a click in the response tree.

### 7. Autosave with revision numbers
**Decision:** Debounced PATCH per dirty request; a request is cleared only if its revision is unchanged after the save; one flush at a time.
**Why:** No Save button to forget, and no lost keystrokes when typing during a save. Serialising flushes keeps an older PATCH from landing after a newer one.

### 8. Layout is saved as a whole
**Decision:** `PUT /layout` takes every folder id and every request id with its folder, in order; anything partial is rejected.
**Why:** Positions are then unambiguous and moves can't leave gaps or duplicates. Collections are small enough that sending the full order is cheap.

### 9. Postman import, lossy on purpose
**Decision:** Requests, headers (with disabled state), raw bodies, URLs and collection variables carry over. Nested folders are flattened to "Parent / Child". Scripts and collection auth are reported as not imported.
**Why:** Same `{{var}}` syntax makes most collections usable immediately; pretending to support scripts would be worse than saying so.

### 10. A demo API inside the backend
**Decision:** `/demo` is a small in-memory notes API with signed bearer tokens, capped at 500 users and 50 notes each.
**Why:** The example collection shows chaining with no external service, and tests can exercise it too.

---

<div align="center">

<h3>Akshat Gupta</h3>

<a href="https://akshatgcodes.in"><img src="https://img.shields.io/badge/Website-akshatgcodes.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/akshatgcodes"><img src="https://img.shields.io/badge/LinkedIn-akshatgcodes-0A66C2?style=flat-square" alt="LinkedIn"></a>
<a href="https://github.com/akshatgcodes"><img src="https://img.shields.io/badge/GitHub-akshatgcodes-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:akshatgcodes@gmail.com"><img src="https://img.shields.io/badge/Email-akshatgcodes%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
