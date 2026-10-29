/**
 * Collection editor state. The tree is collection → folders → requests; every edit
 * returns a new tree (so React re-renders only what changed) and marks the request as
 * dirty with a revision number. The autosaver PATCHes dirty requests and clears them
 * only if no newer edit happened while the save was in flight.
 */
import type { Collection, Folder, Req, Variable } from "../types";
import { applyValues } from "./template";

export interface State {
  col: Collection;
  /** request id → revision of its latest unsaved edit */
  dirty: Record<number, number>;
  /** revision of the latest unsaved variables/name edit, 0 when saved */
  metaDirty: number;
  rev: number;
}

export type Action =
  | { type: "load"; col: Collection }
  /** New order from a move; unlike load, unsaved edits stay dirty */
  | { type: "reorder"; col: Collection }
  | { type: "patchRequest"; id: number; patch: Partial<Req> }
  | { type: "addRequest"; req: Req }
  | { type: "removeRequest"; id: number }
  | { type: "addFolder"; folder: Folder }
  | { type: "renameFolder"; id: number; name: string }
  | { type: "removeFolder"; id: number }
  | { type: "rename"; name: string }
  | { type: "setVariables"; variables: Variable[] }
  | { type: "applyValues"; values: Record<string, string> }
  | { type: "saved"; requests: Record<number, number>; meta?: number };

export const initState = (col: Collection): State => ({ col, dirty: {}, metaDirty: 0, rev: 0 });

/** Sidebar order: top-level requests first, then each folder's. */
export function allRequests(col: Collection): Req[] {
  return [...col.requests, ...col.folders.flatMap((f) => f.requests)];
}

export function findRequest(col: Collection, id: number): Req | undefined {
  return allRequests(col).find((r) => r.id === id);
}

/** Rebuild only the lists that actually change, so untouched folders keep their identity. */
function updateLists(col: Collection, fn: (list: Req[]) => Req[]): Collection {
  const requests = fn(col.requests);
  let foldersChanged = false;
  const folders = col.folders.map((f) => {
    const list = fn(f.requests);
    if (list === f.requests) return f;
    foldersChanged = true;
    return { ...f, requests: list };
  });
  if (requests === col.requests && !foldersChanged) return col;
  return { ...col, requests, folders: foldersChanged ? folders : col.folders };
}

function mapRequests(col: Collection, fn: (r: Req) => Req): Collection {
  return updateLists(col, (list) => {
    const out = list.map(fn);
    return out.some((r, i) => r !== list[i]) ? out : list;
  });
}

function filterRequests(col: Collection, keep: (r: Req) => boolean): Collection {
  return updateLists(col, (list) => {
    const out = list.filter(keep);
    return out.length === list.length ? list : out;
  });
}

function withoutKey<T>(obj: Record<number, T>, key: number): Record<number, T> {
  const { [key]: _gone, ...rest } = obj;
  return rest;
}

export function reducer(state: State, action: Action): State {
  const rev = state.rev + 1;
  switch (action.type) {
    case "load":
      return initState(action.col);
    case "reorder":
      return { ...state, col: action.col };
    case "patchRequest":
      return {
        ...state,
        rev,
        col: mapRequests(state.col, (r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
        dirty: { ...state.dirty, [action.id]: rev },
      };
    case "addRequest": {
      const { req } = action;
      const col =
        req.folder_id === null
          ? { ...state.col, requests: [...state.col.requests, req] }
          : {
              ...state.col,
              folders: state.col.folders.map((f) =>
                f.id === req.folder_id ? { ...f, requests: [...f.requests, req] } : f,
              ),
            };
      return { ...state, col };
    }
    case "removeRequest":
      return {
        ...state,
        col: filterRequests(state.col, (r) => r.id !== action.id),
        dirty: withoutKey(state.dirty, action.id),
      };
    case "addFolder":
      return { ...state, col: { ...state.col, folders: [...state.col.folders, action.folder] } };
    case "renameFolder":
      return {
        ...state,
        col: {
          ...state.col,
          folders: state.col.folders.map((f) => (f.id === action.id ? { ...f, name: action.name } : f)),
        },
      };
    case "removeFolder": {
      const gone = state.col.folders.find((f) => f.id === action.id);
      let dirty = state.dirty;
      gone?.requests.forEach((r) => (dirty = withoutKey(dirty, r.id)));
      return {
        ...state,
        dirty,
        col: { ...state.col, folders: state.col.folders.filter((f) => f.id !== action.id) },
      };
    }
    case "rename":
      return { ...state, rev, metaDirty: rev, col: { ...state.col, name: action.name } };
    case "setVariables":
      return { ...state, rev, metaDirty: rev, col: { ...state.col, variables: action.variables } };
    case "applyValues":
      if (!Object.keys(action.values).length) return state;
      return {
        ...state,
        rev,
        metaDirty: rev,
        col: { ...state.col, variables: applyValues(state.col.variables, action.values) },
      };
    case "saved": {
      const dirty = { ...state.dirty };
      for (const [id, savedRev] of Object.entries(action.requests)) {
        if (dirty[Number(id)] === savedRev) delete dirty[Number(id)];
      }
      const metaDirty = action.meta !== undefined && action.meta === state.metaDirty ? 0 : state.metaDirty;
      return { ...state, dirty, metaDirty };
    }
  }
}

// --- layout -------------------------------------------------------------------------

export interface Layout {
  folders: number[];
  requests: { id: number; folder_id: number | null }[];
}

export function layoutOf(col: Collection): Layout {
  return {
    folders: col.folders.map((f) => f.id),
    requests: allRequests(col).map((r) => ({ id: r.id, folder_id: r.folder_id })),
  };
}

/** Move a request into `folderId` (null = top level) at `index` within that list. */
export function moveRequest(
  col: Collection,
  id: number,
  folderId: number | null,
  index: number,
): Collection {
  const req = findRequest(col, id);
  if (!req) return col;
  const moved = { ...req, folder_id: folderId };
  const without = filterRequests(col, (r) => r.id !== id);
  const insert = (list: Req[]) => {
    const copy = [...list];
    copy.splice(Math.max(0, Math.min(index, copy.length)), 0, moved);
    return copy;
  };
  if (folderId === null) return { ...without, requests: insert(without.requests) };
  return {
    ...without,
    folders: without.folders.map((f) => (f.id === folderId ? { ...f, requests: insert(f.requests) } : f)),
  };
}

/** Shift a request up (-1) or down (+1) within its own list. */
export function nudgeRequest(col: Collection, id: number, delta: -1 | 1): Collection {
  const req = findRequest(col, id);
  if (!req) return col;
  const list = req.folder_id === null ? col.requests : col.folders.find((f) => f.id === req.folder_id)!.requests;
  const index = list.findIndex((r) => r.id === id) + delta;
  if (index < 0 || index >= list.length) return col;
  return moveRequest(col, id, req.folder_id, index);
}

export function nudgeFolder(col: Collection, id: number, delta: -1 | 1): Collection {
  const i = col.folders.findIndex((f) => f.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= col.folders.length) return col;
  const folders = [...col.folders];
  [folders[i], folders[j]] = [folders[j], folders[i]];
  return { ...col, folders };
}

/** Which requests set each variable, so the UI can say "run Log in first". */
export function producers(col: Collection): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of allRequests(col)) {
    for (const e of r.extracts) (out[e.var] ??= []).push(r.name);
  }
  return out;
}
