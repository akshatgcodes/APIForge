# Setup

## Requirements

- Python 3.12 and [uv](https://docs.astral.sh/uv/)
- Node 18+ (22 recommended)
- Optional: PostgreSQL (SQLite is used if `DATABASE_URL` is unset)

## Backend

```bash
cd backend
uv sync
cp .env.example .env        # then set APP_PASSWORD and SESSION_SECRET
uv run uvicorn app.main:app --reload     # http://localhost:8000/docs
```

## Frontend

```bash
cd frontend
npm install
npm run dev                              # http://localhost:5173
```

Vite proxies `/api` to `localhost:8000` (override with `VITE_API_PROXY`), so the session cookie works without CORS setup.

## Environment variables (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `APP_PASSWORD` | empty | login password. Login is disabled until set |
| `SESSION_SECRET` | insecure dev value | signs session cookies and demo tokens. Use a long random string |
| `DATABASE_URL` | `sqlite:///./apiforge.db` | e.g. `postgresql+psycopg://user:pass@host:5432/apiforge` |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |
| `CROSS_SITE_COOKIES` | `false` | `true` when frontend and API are on different domains |
| `ALLOW_PRIVATE_TARGETS` | `false` (`true` in `.env.example`) | let the proxy call localhost and private networks |
| `PROXY_TIMEOUT` | `30` | seconds per outbound request |
| `PUBLIC_API_URL` | `http://localhost:8000` | the example collection's `base_url` is this + `/demo` |

Frontend (`frontend/.env`, optional): `VITE_API_URL` points the app at an API on another origin.

## Checks

```bash
cd backend && uv run ruff check . && uv run pytest
cd frontend && npm test && npm run build
```

---

<div align="center">

<h3>Akshat Gupta</h3>

<a href="https://akshatgcodes.in"><img src="https://img.shields.io/badge/Website-akshatgcodes.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/akshatgcodes"><img src="https://img.shields.io/badge/LinkedIn-akshatgcodes-0A66C2?style=flat-square" alt="LinkedIn"></a>
<a href="https://github.com/akshatgcodes"><img src="https://img.shields.io/badge/GitHub-akshatgcodes-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:akshatgcodes@gmail.com"><img src="https://img.shields.io/badge/Email-akshatgcodes%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
