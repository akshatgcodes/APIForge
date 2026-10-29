import { describe, expect, it } from "vitest";
import type { Prepared, Req, SendResult } from "../types";
import { runAll } from "./runner";

let nextId = 1;
const req = (over: Partial<Req>): Req => ({
  id: nextId++,
  folder_id: null,
  name: "r",
  method: "GET",
  url: "",
  headers: [],
  body_type: "none",
  body: "",
  extracts: [],
  ...over,
});

const ok = (body: unknown, status = 200): SendResult => ({
  status,
  reason: status < 400 ? "OK" : "Unauthorized",
  headers: [],
  body: JSON.stringify(body),
  binary: false,
  truncated: false,
  size: 0,
  time_ms: 5,
  url: "",
  redirects: [],
});

// A fake API: /login hands out a token, /me only answers with that token
async function fakeSend(p: Prepared): Promise<SendResult> {
  if (p.url.endsWith("/login")) return ok({ access_token: "T1", user: { id: 42 } });
  const auth = p.headers.find((h) => h.key === "Authorization")?.value;
  if (p.url.endsWith("/me")) return auth === "Bearer T1" ? ok({ id: 42 }) : ok({}, 401);
  throw new Error("Couldn't connect");
}

const login = req({
  name: "login",
  method: "POST",
  url: "{{base}}/login",
  extracts: [
    { var: "token", source: "body", path: "access_token" },
    { var: "uid", source: "body", path: "user.id" },
  ],
});
const me = req({
  name: "me",
  url: "{{base}}/me",
  headers: [{ key: "Authorization", value: "Bearer {{token}}", enabled: true }],
});
const vars = [
  { key: "base", value: "https://a.test" },
  { key: "token", value: "" },
];

describe("runAll", () => {
  it("chains a value from one response into the next request", async () => {
    const { steps, variables } = await runAll([login, me], vars, fakeSend);
    expect(steps.map((s) => [s.request.name, s.status, s.ok])).toEqual([
      ["login", 200, true],
      ["me", 200, true],
    ]);
    expect(steps[0].extracted).toEqual({ token: "T1", uid: "42" });
    expect(variables).toContainEqual({ key: "token", value: "T1" });
    expect(variables).toContainEqual({ key: "uid", value: "42" });
  });

  it("fails without the chain", async () => {
    const { steps } = await runAll([me], vars, fakeSend);
    expect(steps[0]).toMatchObject({ status: 401, ok: false, error: "HTTP 401 Unauthorized" });
  });

  it("doesn't send requests with undefined variables", async () => {
    const sent: Prepared[] = [];
    const { steps } = await runAll([req({ url: "{{nowhere}}/x" })], vars, async (p) => {
      sent.push(p);
      return ok({});
    });
    expect(sent).toEqual([]);
    expect(steps[0].error).toMatch(/\{\{nowhere\}\}/);
  });

  it("stops at the first failure when asked", async () => {
    const broken = req({ name: "broken", url: "{{base}}/boom" });
    const all = await runAll([broken, login], vars, fakeSend);
    expect(all.steps.map((s) => s.ok)).toEqual([false, true]);
    const stopped = await runAll([broken, login], vars, fakeSend, { stopOnError: true });
    expect(stopped.steps).toHaveLength(1);
    expect(stopped.steps[0].error).toBe("Couldn't connect");
  });

  it("reports progress after each step", async () => {
    const seen: string[] = [];
    await runAll([login, me], vars, fakeSend, { onStep: (s, v) => seen.push(`${s.request.name}:${v.find((x) => x.key === "token")?.value}`) });
    expect(seen).toEqual(["login:T1", "me:T1"]);
  });
});
