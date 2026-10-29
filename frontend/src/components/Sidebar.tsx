import { useState } from "react";
import type { Collection, Folder, Req } from "../types";

interface Props {
  col: Collection;
  selectedId: number | null;
  dirty: Record<number, number>;
  onSelect: (id: number) => void;
  onAddRequest: (folderId: number | null) => void;
  onAddFolder: () => void;
  onRenameFolder: (id: number, name: string) => void;
  onDeleteFolder: (folder: Folder) => void;
  onNudgeRequest: (id: number, delta: -1 | 1) => void;
  onNudgeFolder: (id: number, delta: -1 | 1) => void;
  onRun: (folderId: number | null) => void;
}

export function MethodTag({ method }: { method: string }) {
  return <span className={`method m-${method.toLowerCase()}`}>{method === "DELETE" ? "DEL" : method === "OPTIONS" ? "OPT" : method}</span>;
}

export default function Sidebar(props: Props) {
  const { col } = props;
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <nav className="sidebar" aria-label="Requests">
      {col.requests.length > 0 && (
        <RequestList requests={col.requests} {...props} />
      )}
      {col.folders.map((f, i) => (
        <FolderBlock
          key={f.id}
          folder={f}
          first={i === 0}
          last={i === col.folders.length - 1}
          open={!collapsed.has(f.id)}
          onToggle={() => toggle(f.id)}
          {...props}
        />
      ))}
      {col.requests.length === 0 && col.folders.length === 0 && (
        <p className="muted small sidebar-empty">No requests yet.</p>
      )}
      <div className="sidebar-actions">
        <button className="btn btn-sm" onClick={() => props.onAddRequest(null)}>
          + Request
        </button>
        <button className="btn btn-sm" onClick={props.onAddFolder}>
          + Folder
        </button>
      </div>
    </nav>
  );
}

function FolderBlock(
  props: Props & { folder: Folder; first: boolean; last: boolean; open: boolean; onToggle: () => void },
) {
  const { folder, open } = props;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);

  const commit = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== folder.name) props.onRenameFolder(folder.id, trimmed);
    else setName(folder.name);
  };

  return (
    <section className="folder">
      <div className="folder-head">
        {editing ? (
          <input
            className="folder-input"
            value={name}
            autoFocus
            aria-label="Folder name"
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setName(folder.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button className="folder-name" aria-expanded={open} onClick={props.onToggle} onDoubleClick={() => setEditing(true)}>
            <span className={`caret ${open ? "open" : ""}`} aria-hidden>
              ▸
            </span>
            {folder.name}
            <span className="count">{folder.requests.length}</span>
          </button>
        )}
        <div className="hover-actions">
          <button className="icon-btn" title="Run folder" aria-label={`Run ${folder.name}`} onClick={() => props.onRun(folder.id)}>
            ▶
          </button>
          <button className="icon-btn" title="Add request" aria-label={`Add request to ${folder.name}`} onClick={() => props.onAddRequest(folder.id)}>
            +
          </button>
          <button className="icon-btn" title="Rename" aria-label={`Rename ${folder.name}`} onClick={() => setEditing(true)}>
            ✎
          </button>
          <button className="icon-btn" title="Move up" aria-label={`Move ${folder.name} up`} disabled={props.first} onClick={() => props.onNudgeFolder(folder.id, -1)}>
            ↑
          </button>
          <button className="icon-btn" title="Move down" aria-label={`Move ${folder.name} down`} disabled={props.last} onClick={() => props.onNudgeFolder(folder.id, 1)}>
            ↓
          </button>
          <button className="icon-btn" title="Delete folder" aria-label={`Delete ${folder.name}`} onClick={() => props.onDeleteFolder(folder)}>
            ✕
          </button>
        </div>
      </div>
      {open && <RequestList requests={folder.requests} {...props} />}
    </section>
  );
}

function RequestList({ requests, ...props }: Props & { requests: Req[] }) {
  if (!requests.length) return <p className="muted small folder-empty">Empty folder</p>;
  return (
    <ul className="req-list">
      {requests.map((r, i) => (
        <li key={r.id} className={`req-item ${r.id === props.selectedId ? "selected" : ""}`}>
          <button className="req-link" onClick={() => props.onSelect(r.id)} aria-current={r.id === props.selectedId}>
            <MethodTag method={r.method} />
            <span className="req-name">{r.name}</span>
            {props.dirty[r.id] !== undefined && <span className="dot" title="Saving…" />}
          </button>
          <div className="hover-actions">
            <button className="icon-btn" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => props.onNudgeRequest(r.id, -1)}>
              ↑
            </button>
            <button className="icon-btn" aria-label={`Move ${r.name} down`} disabled={i === requests.length - 1} onClick={() => props.onNudgeRequest(r.id, 1)}>
              ↓
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
