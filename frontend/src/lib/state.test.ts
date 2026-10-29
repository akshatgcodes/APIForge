import { describe, expect, it } from "vitest";
import type { Collection, Req } from "../types";
import { allRequests, initState, layoutOf, moveRequest, nudgeFolder, nudgeRequest, producers, reducer } from "./state";

const req = (id: number, folder_id: number | null = null, over: Partial<Req> = {}): Req => ({
  id,
  folder_id,
  name: `r${id}`,
  method: "GET",
  url: "",
  headers: [],
  body_type: "none",
  body: "",
  extracts: [],
  ...over,
});

const col = (): Collection => ({
  id: 1,
  name: "c",
  variables: [{ key: "token", value: "" }],
  updated_at: "",
  requests: [req(1), req(2)],
  folders: [
    { id: 10, name: "Auth", requests: [req(3, 10, { extracts: [{ var: "token", source: "body", path: "t" }] })] },
    { id: 20, name: "Notes", requests: [req(4, 20), req(5, 20)] },
  ],
});

const names = (c: Collection) => [c.requests.map((r) => r.id), ...c.folders.map((f) => f.requests.map((r) => r.id))];

describe("reducer", () => {
  it("patches a request deep in a folder without touching the others", () => {
    const s0 = initState(col());
    const s1 = reducer(s0, { type: "patchRequest", id: 4, patch: { url: "/x" } });
    expect(s1.col.folders[1].requests[0].url).toBe("/x");
    expect(s1.col.folders[0]).toBe(s0.col.folders[0]); // untouched branch keeps its identity
    expect(s1.dirty).toEqual({ 4: 1 });
  });

  it("keeps a request dirty if it was edited again while saving", () => {
    let s = initState(col());
    s = reducer(s, { type: "patchRequest", id: 1, patch: { name: "a" } }); // rev 1, being saved
    s = reducer(s, { type: "patchRequest", id: 1, patch: { name: "ab" } }); // rev 2, typed meanwhile
    s = reducer(s, { type: "patchRequest", id: 2, patch: { name: "b" } }); // rev 3
    s = reducer(s, { type: "saved", requests: { 1: 1, 2: 3 } });
    expect(s.dirty).toEqual({ 1: 2 });
  });

  it("applies extracted values and marks variables dirty", () => {
    let s = initState(col());
    s = reducer(s, { type: "applyValues", values: { token: "T", uid: "7" } });
    expect(s.col.variables).toEqual([
      { key: "token", value: "T" },
      { key: "uid", value: "7" },
    ]);
    expect(s.metaDirty).toBe(1);
    expect(reducer(s, { type: "saved", requests: {}, meta: 1 }).metaDirty).toBe(0);
    expect(reducer(s, { type: "applyValues", values: {} })).toBe(s);
  });

  it("adds and removes requests and folders", () => {
    let s = initState(col());
    s = reducer(s, { type: "addRequest", req: req(6, 20) });
    s = reducer(s, { type: "patchRequest", id: 5, patch: { name: "x" } });
    expect(names(s.col)).toEqual([[1, 2], [3], [4, 5, 6]]);
    s = reducer(s, { type: "removeFolder", id: 20 });
    expect(names(s.col)).toEqual([[1, 2], [3]]);
    expect(s.dirty).toEqual({});
  });
});

describe("layout", () => {
  it("moves requests across folders and lists them in sidebar order", () => {
    const moved = moveRequest(col(), 1, 20, 1);
    expect(names(moved)).toEqual([[2], [3], [4, 1, 5]]);
    expect(layoutOf(moved).requests).toEqual([
      { id: 2, folder_id: null },
      { id: 3, folder_id: 10 },
      { id: 4, folder_id: 20 },
      { id: 1, folder_id: 20 },
      { id: 5, folder_id: 20 },
    ]);
    expect(names(moveRequest(col(), 5, null, 99))).toEqual([[1, 2, 5], [3], [4]]);
  });

  it("nudges within a list and stops at the ends", () => {
    expect(names(nudgeRequest(col(), 5, -1))).toEqual([[1, 2], [3], [5, 4]]);
    expect(nudgeRequest(col(), 4, -1).folders[1].requests.map((r) => r.id)).toEqual([4, 5]);
    expect(nudgeFolder(col(), 20, -1).folders.map((f) => f.id)).toEqual([20, 10]);
    expect(nudgeFolder(col(), 20, 1).folders.map((f) => f.id)).toEqual([10, 20]);
  });

  it("knows which request sets a variable", () => {
    expect(producers(col())).toEqual({ token: ["r3"] });
    expect(allRequests(col()).map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
