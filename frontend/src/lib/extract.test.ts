import { describe, expect, it } from "vitest";
import type { SendResult } from "../types";
import { formatPath, getPath, parsePath, runExtracts } from "./extract";

const res = (body: string | null, headers: [string, string][] = [], status = 200): SendResult => ({
  status,
  reason: "OK",
  headers,
  body,
  binary: false,
  truncated: false,
  size: 0,
  time_ms: 1,
  url: "https://a.test",
  redirects: [],
});

describe("parsePath", () => {
  it.each([
    ["token", ["token"]],
    ["data.items[0].id", ["data", "items", 0, "id"]],
    ["$.data.token", ["data", "token"]],
    ["$[0]", [0]],
    ['meta["x-rate.limit"]', ["meta", "x-rate.limit"]],
    ["meta['it\\'s']", ["meta", "it's"]],
    ["", []],
  ])("%s", (path, segs) => {
    expect(parsePath(path)).toEqual(segs);
  });

  it.each(["a..b", "a[x]", "a[0", "a]"])("rejects %s", (path) => {
    expect(() => parsePath(path)).toThrow();
  });
});

describe("formatPath", () => {
  it("round-trips through parsePath", () => {
    for (const segs of [["data", "items", 0, "id"], ["x-rate", "a b", 2], [0, "id"]]) {
      expect(parsePath(formatPath(segs))).toEqual(segs);
    }
  });
});

describe("getPath", () => {
  const doc = { a: [{ b: null }], n: 0 };
  it("distinguishes missing from null/falsy", () => {
    expect(getPath(doc, ["a", 0, "b"])).toEqual({ found: true, value: null });
    expect(getPath(doc, ["n"])).toEqual({ found: true, value: 0 });
    expect(getPath(doc, ["a", 1]).found).toBe(false);
    expect(getPath(doc, ["a", "length"]).found).toBe(false);
    expect(getPath(doc, ["n", "x"]).found).toBe(false);
  });
});

describe("runExtracts", () => {
  it("reads body paths, headers (any case) and status", () => {
    const out = runExtracts(
      [
        { var: "token", source: "body", path: "data.token" },
        { var: "count", source: "body", path: "data.count" },
        { var: "user", source: "body", path: "data.user" },
        { var: "rid", source: "header", path: "X-Request-Id" },
        { var: "code", source: "status", path: "" },
      ],
      res('{"data":{"token":"abc","count":3,"user":{"id":1}}}', [["x-request-id", "r-9"]], 201),
    );
    expect(out.values).toEqual({ token: "abc", count: "3", user: '{"id":1}', rid: "r-9", code: "201" });
    expect(out.errors).toEqual([]);
  });

  it("explains each failure without stopping the others", () => {
    const out = runExtracts(
      [
        { var: "a", source: "body", path: "missing" },
        { var: "b", source: "header", path: "X-Nope" },
        { var: "c", source: "body", path: "a[" },
        { var: "ok", source: "status", path: "" },
      ],
      res('{"x":1}'),
    );
    expect(out.values).toEqual({ ok: "200" });
    expect(out.errors.map((e) => e.var)).toEqual(["a", "b", "c"]);
  });

  it("reports a non-JSON body", () => {
    const out = runExtracts([{ var: "t", source: "body", path: "t" }], res("<html>"));
    expect(out.errors[0].message).toMatch(/isn't JSON/);
  });
});
