# Architecture

```
Browser (React)                                   FastAPI                         Target API
┌────────────────────────────┐   /api/collections   ┌──────────────────────┐
│ Workspace (useReducer tree)│ ───────────────────▶ │ collections router   │──▶ Postgres / SQLite
│  · autosave (debounced)    │                      │                      │
│  · prepare(): {{vars}}     │   /api/send          │ send router          │
│  · runExtracts()           │ ───────────────────▶ │  proxy.send(): httpx │ ───────────▶ any URL
│  · runAll() (runner)       │ ◀─────────────────── │  SSRF check per hop  │ ◀───────────
└────────────────────────────┘   status/headers/body└──────────────────────┘
                                                      /demo  (notes API for the example)
```

## Frontend

| File | Role |
|---|---|
| `src/lib/template.ts` | `{{name}}` rendering, built-ins, variables that reference variables |
| `src/lib/extract.ts` | JSON path parser (`a.b[0]["x-y"]`), path formatter, extract rules |
| `src/lib/prepare.ts` | Request → filled-in request (enabled headers, JSON content type, `http://` default), cURL export |
| `src/lib/runner.ts` | Sends requests in order, applying each step's extracted values before the next |
| `src/lib/state.ts` | Reducer for the collection tree, dirty revisions, layout moves |
| `src/pages/Workspace.tsx` | Wires the reducer to autosave, send, the runner and the panels |

All of `lib/` is pure and covered by Vitest.

### Saving

Each edit bumps a revision and stores it under the request id in `dirty`. 600 ms after the last change the flush PATCHes every dirty request (and the collection's variables if they changed), then dispatches `saved` with the revisions it sent. A request leaves `dirty` only if its revision is unchanged, so an edit made while the save was in flight goes out in the next flush. Only one flush runs at a time.

## Backend

| File | Role |
|---|---|
| `app/models.py` | `Collection` (name, `variables` JSON) → `Folder` → `ApiRequest` (method, url, `headers` JSON, body type, body, `extracts` JSON, position) |
| `app/schemas.py` | Pydantic models with limits (50 headers, 20 extract rules, 1 MB body) and variable-name rules |
| `app/routers/collections.py` | CRUD, `PUT /layout`, export, import, example |
| `app/importers.py` | Postman v2.1 → APIForge format |
| `app/proxy.py` | Outbound request with SSRF check, manual redirects, 5 MB cap, text/binary detection |
| `app/demo.py` | In-memory notes API with signed bearer tokens |

### API

| Method | Path | |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/logout` · GET `/api/auth/me` | session |
| GET / POST | `/api/collections` | list / create |
| POST | `/api/collections/example`, `/api/collections/import` | example, import (own format or Postman) |
| GET / PATCH / DELETE | `/api/collections/{id}` | full tree / name and variables / delete |
| PUT | `/api/collections/{id}/layout` | every folder and request, in order |
| GET | `/api/collections/{id}/export` | portable JSON without ids |
| POST | `/api/collections/{id}/folders` · PATCH/DELETE `/api/folders/{id}` | folders |
| POST | `/api/collections/{id}/requests` · PATCH/DELETE `/api/requests/{id}` · POST `/api/requests/{id}/duplicate` | requests |
| POST | `/api/send` | run one filled-in request |
| — | `/demo/login`, `/demo/me`, `/demo/notes[/{id}]` | demo API, no session needed |

### `/api/send` response

```json
{
  "status": 200, "reason": "OK",
  "headers": [["content-type", "application/json"]],
  "body": "{\"id\": 1}", "binary": false, "truncated": false,
  "size": 9, "time_ms": 42,
  "url": "https://api.example.com/x", "redirects": [{"status": 302, "url": "…"}]
}
```

Headers are a list of pairs so repeated headers like `set-cookie` survive.

---

<div align="center">

<h3>Akshat Gupta</h3>

<a href="https://akshatgcodes.in"><img src="https://img.shields.io/badge/Website-akshatgcodes.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/akshatgcodes"><img src="https://img.shields.io/badge/LinkedIn-akshatgcodes-0A66C2?style=flat-square" alt="LinkedIn"></a>
<a href="https://github.com/akshatgcodes"><img src="https://img.shields.io/badge/GitHub-akshatgcodes-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:akshatgcodes@gmail.com"><img src="https://img.shields.io/badge/Email-akshatgcodes%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
