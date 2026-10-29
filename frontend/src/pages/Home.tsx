import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Logo, useLogout } from "../components/RequireOwner";
import type { CollectionSummary } from "../types";
import { timeAgo } from "../lib/format";

export default function Home() {
  const [items, setItems] = useState<CollectionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const logout = useLogout();

  useEffect(() => {
    api.collections().then(setItems).catch((e: Error) => setError(e.message));
  }, []);

  const run = async (fn: () => Promise<{ id: number }>) => {
    setError(null);
    try {
      const c = await fn();
      navigate(`/c/${c.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const create = () => run(() => api.createCollection("New collection"));

  const importFile = async (file: File) => {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setError(`${file.name} isn't a JSON file`);
      return;
    }
    try {
      const c = await api.importCollection(parsed);
      const notice = c.skipped.length ? `Imported. Not carried over: ${c.skipped.join(", ")}.` : undefined;
      navigate(`/c/${c.id}`, { state: { notice } });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (c: CollectionSummary) => {
    if (!confirm(`Delete "${c.name}" and its ${c.requests} requests?`)) return;
    await api.deleteCollection(c.id);
    setItems((list) => list?.filter((x) => x.id !== c.id) ?? null);
  };

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="logo">
          <Logo /> APIForge
        </Link>
        <button className="link-btn" onClick={logout}>
          Log out
        </button>
      </header>
      <main className="page">
        <div className="page-head">
          <div>
            <h1>Collections</h1>
            <p className="muted small">Requests grouped by API. Variables are shared within a collection.</p>
          </div>
          <div className="row wrap">
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Import
            </button>
            <button className="btn btn-primary" onClick={create}>
              + New collection
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
        </div>
        {error && <p className="error">{error}</p>}
        {items === null ? (
          <p className="muted">Loading…</p>
        ) : items.length === 0 ? (
          <div className="empty">
            <p>
              <strong>No collections yet.</strong>
            </p>
            <p className="muted">
              Start with the example: it logs in to a small demo API, keeps the token, and uses it in the next requests.
            </p>
            <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => run(api.createExample)}>
                Load the example
              </button>
              <button className="btn" onClick={create}>
                Start empty
              </button>
            </div>
            <p className="muted small" style={{ marginTop: 12 }}>
              You can also import an APIForge export or a Postman v2.1 collection.
            </p>
          </div>
        ) : (
          <ul className="col-list">
            {items.map((c) => (
              <li key={c.id} className="panel col-row">
                <div>
                  <Link to={`/c/${c.id}`} className="col-title">
                    {c.name}
                  </Link>
                  <div className="muted small">
                    {c.requests} {c.requests === 1 ? "request" : "requests"} · edited {timeAgo(c.updated_at)}
                  </div>
                </div>
                <button className="icon-btn" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}>
                  ✕
                </button>
              </li>
            ))}
            <li>
              <button className="link-btn small" onClick={() => run(api.createExample)}>
                + Add the example collection
              </button>
            </li>
          </ul>
        )}
      </main>
    </div>
  );
}
