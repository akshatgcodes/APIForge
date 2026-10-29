import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import RequestEditor from "../components/RequestEditor";
import { Logo, useLogout } from "../components/RequireOwner";
import ResponseView, { type ResponseState } from "../components/ResponseView";
import RunnerPanel from "../components/RunnerPanel";
import Sidebar from "../components/Sidebar";
import VariablesPanel from "../components/VariablesPanel";
import { runExtracts } from "../lib/extract";
import { prepare } from "../lib/prepare";
import {
  allRequests,
  findRequest,
  initState,
  layoutOf,
  moveRequest,
  nudgeFolder,
  nudgeRequest,
  producers as producersOf,
  reducer,
  type State,
} from "../lib/state";
import { VAR_NAME } from "../lib/template";
import type { Collection, Folder, Req } from "../types";

export default function Workspace() {
  const { id } = useParams();
  const [col, setCol] = useState<Collection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCol(null);
    api.collection(Number(id)).then(setCol).catch((e: Error) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <div className="center">
        <p className="error">{error}</p>
        <Link to="/">Back to collections</Link>
      </div>
    );
  if (!col) return <div className="center muted">Loading…</div>;
  return <Editor key={col.id} initial={col} />;
}

const SAVE_DELAY = 600;

function Editor({ initial }: { initial: Collection }) {
  const [state, dispatch] = useReducer(reducer, initial, initState);
  const { col } = state;
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const logout = useLogout();

  const selectedId = Number(params.get("r")) || allRequests(col)[0]?.id || null;
  const selected = selectedId ? findRequest(col, selectedId) : undefined;
  const select = (rid: number) => {
    setParams({ r: String(rid) }, { replace: true });
    setNavOpen(false);
  };

  const [responses, setResponses] = useState<Record<number, ResponseState>>({});
  const [panel, setPanel] = useState<null | { kind: "vars" } | { kind: "run"; folderId: number | null | "all" }>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);
  const producers = useMemo(() => producersOf(col), [col]);

  // --- autosave ------------------------------------------------------------------------
  // Edits land in the reducer instantly; this pushes dirty requests to the server after
  // a pause in typing. Only one flush runs at a time so saves can't arrive out of order.
  const stateRef = useRef<State>(state);
  stateRef.current = state;
  const flushing = useRef(false);
  const again = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current) {
      again.current = true;
      return;
    }
    flushing.current = true;
    const s = stateRef.current;
    const revs = { ...s.dirty };
    try {
      await Promise.all(
        Object.keys(revs).map((rid) => {
          const r = findRequest(s.col, Number(rid));
          if (!r) return undefined;
          const { id: _id, folder_id: _folder, ...fields } = r;
          // Half-typed rules would fail validation; they're saved once they have a name
          return api.patchRequest(r.id, { ...fields, extracts: fields.extracts.filter((x) => VAR_NAME.test(x.var)) });
        }),
      );
      const meta = s.metaDirty;
      if (meta) await api.patchCollection(s.col.id, { name: s.col.name || "Untitled", variables: s.col.variables });
      dispatch({ type: "saved", requests: revs, meta: meta || undefined });
      setSaveError(null);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      flushing.current = false;
      if (again.current) {
        again.current = false;
        flush();
      }
    }
  }, []);

  const pending = Object.keys(state.dirty).length > 0 || state.metaDirty > 0;
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(flush, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [state.dirty, state.metaDirty, pending, flush]);

  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  // --- actions -------------------------------------------------------------------------
  const fail = (e: unknown) => setSaveError((e as Error).message);

  const relayout = (next: Collection) => {
    dispatch({ type: "reorder", col: next });
    api.setLayout(col.id, layoutOf(next)).catch(async (e) => {
      fail(e);
      dispatch({ type: "load", col: await api.collection(col.id) });
    });
  };

  const addRequest = async (folderId: number | null) => {
    try {
      const req = await api.createRequest(col.id, { name: "New request", folder_id: folderId });
      dispatch({ type: "addRequest", req });
      select(req.id);
    } catch (e) {
      fail(e);
    }
  };

  const addFolder = async () => {
    try {
      dispatch({ type: "addFolder", folder: await api.createFolder(col.id, "New folder") });
    } catch (e) {
      fail(e);
    }
  };

  const deleteFolder = async (f: Folder) => {
    const n = f.requests.length;
    if (n && !confirm(`Delete "${f.name}" and the ${n} request${n === 1 ? "" : "s"} in it?`)) return;
    try {
      await api.deleteFolder(f.id);
      dispatch({ type: "removeFolder", id: f.id });
    } catch (e) {
      fail(e);
    }
  };

  const deleteRequest = async (r: Req) => {
    if (!confirm(`Delete "${r.name}"?`)) return;
    try {
      await api.deleteRequest(r.id);
      dispatch({ type: "removeRequest", id: r.id });
      setParams({}, { replace: true });
    } catch (e) {
      fail(e);
    }
  };

  const duplicate = async (r: Req) => {
    try {
      await flush();
      const copy = await api.duplicateRequest(r.id);
      dispatch({ type: "addRequest", req: copy });
      select(copy.id);
    } catch (e) {
      fail(e);
    }
  };

  const send = useCallback(async (req: Req) => {
    const { prepared, missing } = prepare(req, stateRef.current.col.variables);
    if (missing.length) {
      setResponses((m) => ({
        ...m,
        [req.id]: { error: `Not sent: ${missing.map((v) => `{{${v}}}`).join(", ")} isn't defined. Add it under Variables.` },
      }));
      return;
    }
    setResponses((m) => ({ ...m, [req.id]: { loading: true } }));
    try {
      const result = await api.send(prepared);
      const extracted = runExtracts(req.extracts.filter((x) => VAR_NAME.test(x.var)), result);
      dispatch({ type: "applyValues", values: extracted.values });
      setResponses((m) => ({ ...m, [req.id]: { result, extracted } }));
    } catch (e) {
      setResponses((m) => ({ ...m, [req.id]: { error: (e as Error).message } }));
    }
  }, []);

  // ⌘/Ctrl+Enter sends the open request from anywhere on the page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && selected && !panel) {
        e.preventDefault();
        send(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, panel, send]);

  const runTarget = panel?.kind === "run" ? panel.folderId : null;
  const runRequests =
    panel?.kind !== "run"
      ? []
      : runTarget === "all"
        ? allRequests(col)
        : runTarget === null
          ? col.requests
          : (col.folders.find((f) => f.id === runTarget)?.requests ?? []);
  const runTitle = runTarget === "all" || runTarget === null ? col.name : (col.folders.find((f) => f.id === runTarget)?.name ?? "");

  const saveLabel = saveError ? null : pending ? "Saving…" : "Saved";

  return (
    <div className="workspace">
      <header className="ws-bar">
        <button className="icon-btn nav-toggle" aria-label="Show requests" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>
          ☰
        </button>
        <Link to="/" className="logo" aria-label="All collections">
          <Logo />
        </Link>
        <input
          className="col-name"
          aria-label="Collection name"
          value={col.name}
          onChange={(e) => dispatch({ type: "rename", name: e.target.value })}
        />
        <span className="save-state muted small" role="status">
          {saveLabel}
        </span>
        <div className="ws-actions">
          <button className="btn btn-sm" onClick={() => setPanel({ kind: "vars" })}>
            Variables <span className="count">{col.variables.length}</span>
          </button>
          <button className="btn btn-sm" onClick={() => setPanel({ kind: "run", folderId: "all" })} disabled={!allRequests(col).length}>
            ▶ Run all
          </button>
          <button
            className="btn btn-sm hide-narrow"
            onClick={async () => {
              const data = await api.exportCollection(col.id);
              const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
              const a = Object.assign(document.createElement("a"), { href: url, download: `${col.name.replace(/[^\w.-]+/g, "-")}.apiforge.json` });
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export
          </button>
          <button className="link-btn small hide-narrow" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {(saveError || notice) && (
        <div className={`banner ${saveError ? "banner-bad" : ""}`} role={saveError ? "alert" : "status"}>
          <span>{saveError ? `Couldn't save: ${saveError}` : notice}</span>
          {saveError ? (
            <button className="btn btn-sm" onClick={flush}>
              Retry
            </button>
          ) : (
            <button className="icon-btn" aria-label="Dismiss" onClick={() => setNotice(null)}>
              ✕
            </button>
          )}
        </div>
      )}

      <div className={`ws-body ${navOpen ? "nav-open" : ""}`}>
        <Sidebar
          col={col}
          selectedId={selectedId}
          dirty={state.dirty}
          onSelect={select}
          onAddRequest={addRequest}
          onAddFolder={addFolder}
          onRenameFolder={(fid, name) => {
            dispatch({ type: "renameFolder", id: fid, name });
            api.renameFolder(fid, name).catch(fail);
          }}
          onDeleteFolder={deleteFolder}
          onNudgeRequest={(rid, d) => relayout(nudgeRequest(col, rid, d))}
          onNudgeFolder={(fid, d) => relayout(nudgeFolder(col, fid, d))}
          onRun={(folderId) => setPanel({ kind: "run", folderId })}
        />
        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden />}

        <main className="ws-main">
          {selected ? (
            <>
              <RequestEditor
                key={selected.id}
                req={selected}
                col={col}
                producers={producers}
                sending={!!responses[selected.id]?.loading}
                onChange={(patch) => dispatch({ type: "patchRequest", id: selected.id, patch })}
                onSend={() => send(selected)}
                onDuplicate={() => duplicate(selected)}
                onDelete={() => deleteRequest(selected)}
                onMove={(folderId) => relayout(moveRequest(col, selected.id, folderId, Infinity))}
              />
              <ResponseView
                key={`r${selected.id}`}
                state={responses[selected.id]}
                onExtract={(name, path, value) => {
                  dispatch({
                    type: "patchRequest",
                    id: selected.id,
                    patch: { extracts: [...selected.extracts.filter((x) => x.var !== name), { var: name, source: "body", path }] },
                  });
                  dispatch({ type: "applyValues", values: { [name]: value } });
                }}
              />
            </>
          ) : (
            <div className="empty ws-empty">
              <p>
                <strong>Nothing selected.</strong>
              </p>
              <button className="btn btn-primary" onClick={() => addRequest(null)}>
                + New request
              </button>
            </div>
          )}
        </main>
      </div>

      {panel?.kind === "vars" && (
        <VariablesPanel
          variables={col.variables}
          producers={producers}
          onSave={(variables) => dispatch({ type: "setVariables", variables })}
          onClose={() => setPanel(null)}
        />
      )}
      {panel?.kind === "run" && (
        <RunnerPanel
          title={runTitle}
          requests={runRequests}
          variables={col.variables}
          onValues={(values) => dispatch({ type: "applyValues", values })}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}
