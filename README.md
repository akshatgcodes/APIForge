<p align="center">
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"
       fill="none" stroke="#0f766e" stroke-width="1.5"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z"/>
    <path d="M22 2 11 13"/>
  </svg>
</p>

<h1 align="center">APIForge</h1>

<p align="center">
  <strong>A browser-based API client: collections of requests, run from a tab, chained together with variables.</strong>
</p>

<p align="center">
  <a href="https://apiforge.akshatgcodes.in">
    <img src="https://img.shields.io/badge/live_demo-0f766e-0f766e?style=flat-square" alt="Live Demo">
  </a>
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/license-GPL--3.0-0f766e?style=flat-square" alt="License">
</p>

---

## What is APIForge?

A lightweight Postman alternative that runs in the browser: no Electron, no install. Group requests into collections and folders, set method, URL, headers and body, send them, and read the status, timing, size, headers and body.

The feature that makes it useful for real workflows is **request chaining**. Send `POST /login`, pick `access_token` out of the JSON response, and every later request that has `Authorization: Bearer {{token}}` uses it. Create a resource, keep its `id`, then fetch, update and delete it. The collection runner does all of that in order and shows which step broke.

> **Live demo →** [apiforge.akshatgcodes.in](https://apiforge.akshatgcodes.in)
> Log in with the demo password `demo1234`, click **Load the example**, then **Run all**.

---

## What you get

- **Collections, folders, requests.** Rename, reorder, move between folders, duplicate. Edits save themselves.
- **`{{variables}}` everywhere.** URL, headers and body. Variables can refer to other variables, and `{{$uuid}}`, `{{$timestamp}}`, `{{$isoTimestamp}}`, `{{$randomInt}}` give fresh values per send. The editor shows the filled-in URL and warns about undefined or empty variables, naming the request that sets them.
- **Extract rules.** Save a value from the JSON body (`data.items[0].id`), a response header, or the status code into a variable. Or click any value in the response tree to create the rule.
- **Collection runner.** Run the whole collection or one folder in sidebar order, optionally stopping at the first failure, with each step's status, time and extracted values.
- **Response viewer.** Collapsible JSON tree, raw view, headers, redirect count, binary detection, 5 MB cap.
- **Import and export.** APIForge's own JSON format, plus Postman v2.1 collections (scripts and collection auth are listed as not carried over).
- **Copy as cURL** with variables filled in.
- **A demo API built in.** The example collection logs in to `/demo`, keeps the token and creates, reads and deletes notes, so chaining works with nothing else running.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 · TypeScript · Vite · React Router · axios |
| Backend | FastAPI · Pydantic 2 · SQLAlchemy 2 · httpx |
| Database | PostgreSQL (JSONB for headers, extract rules and variables); SQLite for local dev |
| Auth | Single password, signed session cookie |
| Tooling | uv · pytest · Vitest · ruff · GitHub Actions |

---

## Run it

```bash
# API → http://localhost:8000/docs
cd backend && uv sync && cp .env.example .env    # set APP_PASSWORD
uv run uvicorn app.main:app --reload

# App → http://localhost:5173
cd frontend && npm install && npm run dev
```

Log in with your `APP_PASSWORD`, click **Load the example**, then **Run all**. Details in [docs/SETUP.md](docs/SETUP.md).

---

## Engineering Decisions

**Why does a server send the requests instead of the browser?**
Browsers enforce CORS, so a page can't call most APIs directly. The frontend fills in the variables and posts the finished request to `/api/send`, which makes the call with httpx and returns the response.

**Doesn't a "fetch any URL" endpoint invite SSRF?**
Yes, so unless `ALLOW_PRIVATE_TARGETS` is on, every hop must resolve to public addresses only. Redirects are followed by hand so each new host is re-checked, and `Authorization`/`Cookie` are dropped when a redirect changes host. Local use turns private targets on so you can test `localhost` APIs.

**Why are variables filled in by the browser, not the server?**
The editor needs the same result live (the resolved URL preview, the missing-variable warnings), and the runner needs it between steps. One implementation in TypeScript, unit-tested, used for preview, send, runner and cURL export.

**How do edits save without a Save button?**
The collection is one `useReducer` tree. Each edit marks that request dirty with a revision number; a debounced flush PATCHes dirty requests one batch at a time and clears only the ones whose revision didn't change in the meantime, so typing during a save is never lost.

**What would you do differently in v2?**
Pin the connection to the IP address that passed the SSRF check (today DNS is resolved once for the check and again by httpx), and keep per-request response history.

More in [docs/DECISIONS.md](docs/DECISIONS.md).

---

## Docs

| Document | Description |
|---|---|
| [PRD](docs/PRD.md) | Product requirements: goals, user stories, non-goals |
| [Architecture](docs/ARCHITECTURE.md) | System design, data model, API |
| [Decisions](docs/DECISIONS.md) | Every major technical decision and why |
| [Setup](docs/SETUP.md) | Local dev setup and env vars |
| [Deploy](docs/DEPLOY.md) | Deployment notes |
| [Contributing](CONTRIBUTING.md) | How to propose changes |
| [Changelog](CHANGELOG.md) | What changed in each release |
| [Security](SECURITY.md) | How to report a vulnerability |

---

<div align="center">

<h3>Akshat Gupta</h3>

<a href="https://akshatgcodes.in"><img src="https://img.shields.io/badge/Website-akshatgcodes.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/akshatgcodes"><img src="https://img.shields.io/badge/LinkedIn-akshatgcodes-0A66C2?style=flat-square" alt="LinkedIn"></a>
<a href="https://github.com/akshatgcodes"><img src="https://img.shields.io/badge/GitHub-akshatgcodes-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:akshatgcodes@gmail.com"><img src="https://img.shields.io/badge/Email-akshatgcodes%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
