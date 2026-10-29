import { useMemo, useState } from "react";
import { prepare, toCurl } from "../lib/prepare";
import { VAR_NAME } from "../lib/template";
import { METHODS, type BodyType, type Collection, type Extract, type Header, type Req } from "../types";

interface Props {
  req: Req;
  col: Collection;
  producers: Record<string, string[]>;
  sending: boolean;
  onChange: (patch: Partial<Req>) => void;
  onSend: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (folderId: number | null) => void;
}

type Tab = "headers" | "body" | "extract";

const COMMON_HEADERS = ["Accept", "Authorization", "Content-Type", "Cache-Control", "If-None-Match", "Origin", "User-Agent", "X-API-Key", "X-Request-Id"];

export default function RequestEditor({ req, col, producers, sending, onChange, onSend, onDuplicate, onDelete, onMove }: Props) {
  const [tab, setTab] = useState<Tab>(req.body_type !== "none" ? "body" : "headers");
  const [copied, setCopied] = useState(false);
  // Built-ins like {{$uuid}} change on every call, so preview with fixed stand-ins
  const preview = useMemo(
    () =>
      prepare(req, col.variables, {
        $timestamp: () => "<timestamp>",
        $isoTimestamp: () => "<iso-time>",
        $uuid: () => "<uuid>",
        $randomInt: () => "<int>",
      }),
    [req, col.variables],
  );

  const copyCurl = async () => {
    // Real values for the copy, so the command runs as-is
    await navigator.clipboard.writeText(toCurl(prepare(req, col.variables).prepared));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const enabledHeaders = req.headers.filter((h) => h.enabled && h.key).length;

  return (
    <section className="editor" aria-label="Request">
      <div className="editor-top">
        <input className="name-input" value={req.name} aria-label="Request name" onChange={(e) => onChange({ name: e.target.value })} />
        <div className="row editor-tools">
          <select
            className="select-sm"
            aria-label="Folder"
            value={req.folder_id ?? ""}
            onChange={(e) => onMove(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">(top level)</option>
            {col.folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button className="btn btn-sm" onClick={copyCurl}>
            {copied ? "Copied" : "Copy as cURL"}
          </button>
          <button className="btn btn-sm" onClick={onDuplicate}>
            Duplicate
          </button>
          <button className="icon-btn" aria-label="Delete request" title="Delete request" onClick={onDelete}>
            ✕
          </button>
        </div>
      </div>

      <form
        className="url-bar"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <select
          className={`method-select m-${req.method.toLowerCase()}`}
          aria-label="Method"
          value={req.method}
          onChange={(e) => onChange({ method: e.target.value as Req["method"] })}
        >
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          className="url-input mono"
          aria-label="URL"
          placeholder="{{base_url}}/users"
          value={req.url}
          spellCheck={false}
          onChange={(e) => onChange({ url: e.target.value })}
        />
        <button className="btn btn-primary send-btn" type="submit" disabled={sending || !req.url.trim()}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>

      <Resolved url={preview.prepared.url} raw={req.url} missing={preview.missing} empty={preview.empty} warnings={preview.warnings} producers={producers} />

      <div className="tabs" role="tablist">
        <TabButton id="headers" tab={tab} setTab={setTab} label="Headers" count={enabledHeaders} />
        <TabButton id="body" tab={tab} setTab={setTab} label="Body" count={req.body_type === "none" ? 0 : undefined} dot={req.body_type !== "none"} />
        <TabButton id="extract" tab={tab} setTab={setTab} label="Extract" count={req.extracts.length} />
      </div>

      <div className="tab-panel" role="tabpanel">
        {tab === "headers" && <HeadersEditor headers={req.headers} onChange={(headers) => onChange({ headers })} />}
        {tab === "body" && <BodyEditor req={req} onChange={onChange} />}
        {tab === "extract" && <ExtractEditor extracts={req.extracts} onChange={(extracts) => onChange({ extracts })} />}
      </div>
    </section>
  );
}

function TabButton({ id, tab, setTab, label, count, dot }: { id: Tab; tab: Tab; setTab: (t: Tab) => void; label: string; count?: number; dot?: boolean }) {
  return (
    <button role="tab" aria-selected={tab === id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
      {label}
      {count ? <span className="count">{count}</span> : dot ? <span className="tab-dot" aria-hidden /> : null}
    </button>
  );
}

function Resolved({
  url,
  raw,
  missing,
  empty,
  warnings,
  producers,
}: {
  url: string;
  raw: string;
  missing: string[];
  empty: string[];
  warnings: string[];
  producers: Record<string, string[]>;
}) {
  const showUrl = raw.includes("{{") && url;
  if (!showUrl && !missing.length && !empty.length && !warnings.length) return null;
  return (
    <div className="resolved">
      {showUrl && (
        <div className="mono resolved-url" title="URL after filling in variables">
          → {url}
        </div>
      )}
      {missing.map((m) => (
        <div key={m} className="chip chip-bad">
          {`{{${m}}}`} isn't defined. Add it under Variables.
        </div>
      ))}
      {empty.map((m) => (
        <div key={m} className="chip chip-warn">
          {`{{${m}}}`} is empty{producers[m] && <>. Run {producers[m].map((n) => `“${n}”`).join(" or ")} first</>}.
        </div>
      ))}
      {warnings.map((w) => (
        <div key={w} className="chip chip-warn">
          {w}
        </div>
      ))}
    </div>
  );
}

function HeadersEditor({ headers, onChange }: { headers: Header[]; onChange: (h: Header[]) => void }) {
  const set = (i: number, patch: Partial<Header>) => onChange(headers.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  return (
    <div className="kv">
      <datalist id="common-headers">
        {COMMON_HEADERS.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>
      {headers.map((h, i) => (
        <div key={i} className={`kv-row ${h.enabled ? "" : "off"}`}>
          <input type="checkbox" checked={h.enabled} aria-label="Enabled" onChange={(e) => set(i, { enabled: e.target.checked })} />
          <input className="mono" placeholder="Header" list="common-headers" aria-label="Header name" value={h.key} onChange={(e) => set(i, { key: e.target.value })} />
          <input className="mono" placeholder="Value" aria-label="Header value" value={h.value} onChange={(e) => set(i, { value: e.target.value })} />
          <button className="icon-btn" aria-label="Remove header" onClick={() => onChange(headers.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button className="link-btn small add-row" onClick={() => onChange([...headers, { key: "", value: "", enabled: true }])}>
        + Add header
      </button>
    </div>
  );
}

function BodyEditor({ req, onChange }: { req: Req; onChange: (p: Partial<Req>) => void }) {
  const [error, setError] = useState<string | null>(null);
  const format = () => {
    // Variables may sit where JSON values go ({"id": {{id}}}), so swap them out first
    const holders: string[] = [];
    const masked = req.body.replace(/\{\{[^}]*\}\}/g, (m) => {
      holders.push(m);
      return `"__VAR${holders.length - 1}__"`;
    });
    try {
      const pretty = JSON.stringify(JSON.parse(masked), null, 2).replace(/"__VAR(\d+)__"/g, (_, i) => holders[Number(i)]);
      onChange({ body: pretty });
      setError(null);
    } catch (e) {
      setError(`Can't format: ${(e as Error).message}`);
    }
  };
  return (
    <div className="body-editor">
      <div className="row wrap">
        {(["none", "json", "text"] as BodyType[]).map((t) => (
          <label key={t} className="radio">
            <input type="radio" name="body_type" checked={req.body_type === t} onChange={() => onChange({ body_type: t })} />
            {t === "none" ? "None" : t === "json" ? "JSON" : "Text"}
          </label>
        ))}
        {req.body_type === "json" && (
          <button className="link-btn small" style={{ marginLeft: "auto" }} onClick={format}>
            Format
          </button>
        )}
      </div>
      {req.body_type !== "none" && (
        <textarea
          className="mono body-input"
          aria-label="Body"
          rows={10}
          spellCheck={false}
          value={req.body}
          placeholder={req.body_type === "json" ? '{\n  "name": "{{username}}"\n}' : ""}
          onChange={(e) => onChange({ body: e.target.value })}
        />
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}

function ExtractEditor({ extracts, onChange }: { extracts: Extract[]; onChange: (e: Extract[]) => void }) {
  const set = (i: number, patch: Partial<Extract>) => onChange(extracts.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="kv">
      <p className="muted small">
        After this request runs, save parts of the response as variables. Later requests use them as <code>{"{{name}}"}</code>. Tip: click a
        value in the response to add a rule.
      </p>
      {extracts.map((x, i) => {
        const bad = x.var !== "" && !VAR_NAME.test(x.var);
        return (
          <div key={i} className="kv-row extract-row">
            <input
              className={`mono ${bad ? "invalid" : ""}`}
              placeholder="variable"
              aria-label="Variable name"
              aria-invalid={bad}
              value={x.var}
              onChange={(e) => set(i, { var: e.target.value })}
            />
            <select aria-label="Source" value={x.source} onChange={(e) => set(i, { source: e.target.value as Extract["source"] })}>
              <option value="body">from JSON body</option>
              <option value="header">from header</option>
              <option value="status">status code</option>
            </select>
            <input
              className="mono"
              aria-label="Path"
              placeholder={x.source === "header" ? "X-Request-Id" : x.source === "body" ? "data.token" : ""}
              disabled={x.source === "status"}
              value={x.source === "status" ? "" : x.path}
              onChange={(e) => set(i, { path: e.target.value })}
            />
            <button className="icon-btn" aria-label="Remove rule" onClick={() => onChange(extracts.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        );
      })}
      <button className="link-btn small add-row" onClick={() => onChange([...extracts, { var: "", source: "body", path: "" }])}>
        + Add rule
      </button>
    </div>
  );
}
