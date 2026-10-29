import { describe, expect, it } from "vitest";
import type { Req } from "../types";
import { prepare, toCurl } from "./prepare";

const fns = { $uuid: () => "UUID" };
const req = (over: Partial<Req> = {}): Req => ({
  id: 1,
  folder_id: null,
  name: "r",
  method: "GET",
  url: "{{base}}/me",
  headers: [],
  body_type: "none",
  body: "",
  extracts: [],
  ...over,
});
const vars = [
  { key: "base", value: "https://a.test" },
  { key: "token", value: "t0k" },
];

describe("prepare", () => {
  it("renders url, enabled headers and body", () => {
    const { prepared, missing } = prepare(
      req({
        method: "POST",
        headers: [
          { key: "Authorization", value: "Bearer {{token}}", enabled: true },
          { key: "X-Off", value: "1", enabled: false },
          { key: " ", value: "blank key", enabled: true },
        ],
        body_type: "json",
        body: '{"id":"{{$uuid}}"}',
      }),
      vars,
      fns,
    );
    expect(missing).toEqual([]);
    expect(prepared).toEqual({
      method: "POST",
      url: "https://a.test/me",
      headers: [
        { key: "Authorization", value: "Bearer t0k", enabled: true },
        { key: "Content-Type", value: "application/json", enabled: true },
      ],
      body: '{"id":"UUID"}',
    });
  });

  it("keeps a user-set content type", () => {
    const { prepared } = prepare(
      req({
        body_type: "json",
        body: "{}",
        headers: [{ key: "content-type", value: "application/vnd.api+json", enabled: true }],
      }),
      vars,
    );
    expect(prepared.headers).toHaveLength(1);
  });

  it("drops the body when the type is none", () => {
    expect(prepare(req({ body: "left over" }), vars).prepared.body).toBeNull();
  });

  it("adds http:// when the scheme is missing", () => {
    expect(prepare(req({ url: "localhost:8000/x" }), vars).prepared.url).toBe("http://localhost:8000/x");
  });

  it("collects missing variables and invalid JSON", () => {
    const p = prepare(req({ url: "{{host}}/x", body_type: "json", body: "{nope}" }), vars);
    expect(p.missing).toEqual(["host"]);
    expect(p.warnings).toHaveLength(1);
  });
});

describe("toCurl", () => {
  it("quotes for the shell", () => {
    expect(
      toCurl({
        method: "POST",
        url: "https://a.test/x?q=1&r=2",
        headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
        body: `{"name":"O'Brien"}`,
      }),
    ).toBe(
      `curl \\\n  -X POST \\\n  'https://a.test/x?q=1&r=2' \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{"name":"O'\\''Brien"}'`,
    );
  });

  it("keeps a plain GET short and uses --head for HEAD", () => {
    expect(toCurl({ method: "GET", url: "https://a.test", headers: [], body: null })).toBe(
      "curl \\\n  'https://a.test'",
    );
    expect(toCurl({ method: "HEAD", url: "https://a.test", headers: [], body: null })).toContain("--head");
  });
});
