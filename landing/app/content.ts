import type { Site } from "./types";

export const site: Site = {
  name: "APIForge",
  letter: "A",
  title: "APIForge — an API client in the browser",
  description:
    "A browser-based API client: collections of requests, run from a tab, chained together with variables.",
  meta: ["live", "Postman-style, no install", "GPLv3"],
  headline: ["Requests that", "pass values along."],
  intro:
    "A lightweight Postman alternative that runs in a browser tab. Group requests into collections, send them, read the response. Then chain them: log in, keep the `access_token`, and every later request that says `Bearer {{token}}` uses it.",
  primary: { label: "Open APIForge", href: "/app/" },
  repo: "https://github.com/akshatgcodes/APIForge",
  note: "Demo password: `demo1234`. Click ‘Load the example’, then ‘Run all’: it logs in to the built-in demo API and creates, reads and deletes a note.",
  xfactor: {
    title: "Chaining, not copy-paste.",
    intro:
      "Real API work is a sequence: create something, keep its id, use it in the next call. APIForge makes that sequence a collection you can run.",
    features: [
      {
        icon: "{}",
        title: "Variables everywhere",
        body: "`{{variables}}` in the URL, headers and body, variables inside variables, and `{{$uuid}}` or `{{$timestamp}}` for fresh values. Undefined ones are flagged with the request that sets them.",
      },
      {
        icon: "⇣",
        title: "Extract rules",
        body: "Save `data.items[0].id` from the JSON body, a header or the status code into a variable. Or click any value in the response tree to make the rule.",
      },
      {
        icon: "▶",
        title: "Collection runner",
        body: "Run the whole collection or one folder in sidebar order, optionally stopping at the first failure, with each step's status, time and extracted values.",
      },
    ],
  },
  preview: {
    intro:
      "The runner going through the example collection, a request with its response tree, and the variables panel with values pulled from earlier responses.",
    shots: [
      { src: "/shots/runner.png", alt: "Collection runner listing each request with status, time and extracted values", caption: "Collection runner" },
      { src: "/shots/request.png", alt: "A GET request with the JSON response shown as a tree", caption: "Request and response" },
      { src: "/shots/variables.png", alt: "Variables panel with values extracted from responses", caption: "Variables" },
    ],
  },
  stack: ["React 19", "TypeScript", "Vite", "React Router", "axios", "FastAPI", "Pydantic 2", "SQLAlchemy 2", "httpx", "PostgreSQL", "pytest", "Vitest"],
  concepts: [
    { title: "Server-side send", body: "Browsers enforce CORS, so the page posts the finished request to `/api/send` and the server makes the call with httpx." },
    { title: "SSRF guard per hop", body: "Every hop must resolve to public addresses. Redirects are followed by hand so each new host is checked, and `Authorization` and `Cookie` are dropped when the host changes." },
    { title: "One variable engine", body: "Variables are filled in by TypeScript in the browser, so the URL preview, send, runner and cURL export all give the same result." },
    { title: "Autosave without losing keystrokes", body: "Each edit bumps a revision number; a debounced flush saves dirty requests and only clears the ones that didn't change during the save." },
    { title: "Postman import", body: "Postman v2.1 collections import with their `{{variable}}` syntax unchanged. Nested folders are flattened to one level; scripts and collection auth are listed as not carried over." },
    { title: "Built-in demo API", body: "`/demo` has login and a notes resource, so the example collection works with nothing else running." },
  ],
  run: {
    title: "Run your own",
    intro: "Locally, `ALLOW_PRIVATE_TARGETS=true` lets you test APIs on `localhost`.",
    blocks: [
      {
        title: "API",
        steps: [
          { text: "Install, then set `APP_PASSWORD` in `.env`:", cmd: "cd backend && uv sync\ncp .env.example .env" },
          { text: "Start it on port 8000:", cmd: "uv run uvicorn app.main:app --reload" },
        ],
      },
      {
        title: "App",
        steps: [
          { text: "Install and start Vite:", cmd: "cd frontend && npm install\nnpm run dev" },
          { text: "Open it, load the example and run it:", cmd: "http://localhost:5173" },
        ],
      },
    ],
  },
  tagline: "an API client with request chaining.",
};
