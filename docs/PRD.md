# PRD: APIForge

## Problem

Desktop API clients are heavy installs, and the web versions push accounts and cloud sync. Quick tools like `curl` can't chain one response into the next request without scripting.

## Goal

An API client that runs in a browser tab, saves collections to a database you control, and passes values from one response into later requests.

## Users

- **Developer / tester:** builds collections for an API, runs them while developing, re-runs them to check nothing broke

## User stories

| As a… | I want to… | So that… |
|---|---|---|
| developer | group requests into collections and folders | each API's calls live together |
| developer | set method, URL, headers and a JSON or text body | I can call any endpoint |
| developer | see status, time, size, headers and a readable body | I can tell what happened quickly |
| developer | use `{{base_url}}` and other variables | switching environments is one edit |
| developer | save a token from the login response automatically | authenticated requests just work after logging in |
| developer | click a value in a response to keep it | I don't have to write paths by hand |
| developer | run a whole folder in order | I can replay a flow (log in → create → read → delete) |
| developer | import a Postman collection | I don't start from scratch |
| developer | copy a request as cURL | I can share it or run it in a terminal |

## Requirements

- Collections → folders (one level) → requests; reorder and move between folders
- Methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS; body types none, JSON, text
- `{{name}}` substitution in URL, header names and values, and body; built-ins `$uuid`, `$timestamp`, `$isoTimestamp`, `$randomInt`
- Extract rules per request: JSON path in the body, header name, or status code → variable
- Server-side proxy with SSRF protection when deployed
- Autosave; single-password login

## Non-goals (v1)

- Multiple environments per collection (variables are per collection)
- Pre-request or test scripts
- WebSocket, GraphQL-specific or gRPC requests
- File uploads and multipart bodies
- Teams and sharing

---

<div align="center">

<h3>Akshat Gupta</h3>

<a href="https://akshatgcodes.in"><img src="https://img.shields.io/badge/Website-akshatgcodes.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/akshatgcodes"><img src="https://img.shields.io/badge/LinkedIn-akshatgcodes-0A66C2?style=flat-square" alt="LinkedIn"></a>
<a href="https://github.com/akshatgcodes"><img src="https://img.shields.io/badge/GitHub-akshatgcodes-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:akshatgcodes@gmail.com"><img src="https://img.shields.io/badge/Email-akshatgcodes%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
