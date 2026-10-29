import { useMemo, useState, type ReactNode } from "react";
import { formatPath, type ExtractOutcome, type Segment } from "../lib/extract";
import { formatBytes, formatMs } from "../lib/format";
import { VAR_NAME } from "../lib/template";
import type { SendResult } from "../types";

export interface ResponseState {
  loading?: boolean;
  error?: string;
  result?: SendResult;
  extracted?: ExtractOutcome;
}

interface Props {
  state: ResponseState | undefined;
  onExtract: (varName: string, path: string, value: string) => void;
}

// Past this size a fully expanded tree gets slow; start on Raw instead
const TREE_LIMIT = 300_000;

export default function ResponseView({ state, onExtract }: Props) {
  if (!state) {
    return (
      <section className="response response-empty" aria-label="Response">
        <p className="muted">
          Send the request to see the response. <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd> works from anywhere.
        </p>
      </section>
    );
  }
  if (state.loading) {
    return (
      <section className="response response-empty" aria-label="Response" aria-busy>
        <p className="muted">Sending…</p>
      </section>
    );
  }
  if (state.error || !state.result) {
    return (
      <section className="response" aria-label="Response">
        <div className="send-error" role="alert">
          <strong>Request failed.</strong> {state.error}
        </div>
      </section>
    );
  }
  return <Result result={state.result} extracted={state.extracted} onExtract={onExtract} />;
}

function Result({ result, extracted, onExtract }: { result: SendResult; extracted?: ExtractOutcome; onExtract: Props["onExtract"] }) {
  const json = useMemo(() => {
    if (result.body === null) return undefined;
    try {
      return { value: JSON.parse(result.body) as unknown };
    } catch {
      return undefined;
    }
  }, [result.body]);
  const [view, setView] = useState<"pretty" | "raw" | "headers">(
    json && (result.body?.length ?? 0) < TREE_LIMIT ? "pretty" : "raw",
  );
  const [pick, setPick] = useState<{ path: string; value: string; name: string } | null>(null);

  const statusClass = result.status < 300 ? "ok" : result.status < 400 ? "redirect" : "bad";
  const choose = (segs: Segment[], value: unknown) => {
    const last = [...segs].reverse().find((s) => typeof s === "string") as string | undefined;
    const name = (last ?? "value").replace(/[^A-Za-z0-9_.-]/g, "_").replace(/^[^A-Za-z_]/, "_$&");
    setPick({ path: formatPath(segs), value: typeof value === "string" ? value : JSON.stringify(value), name });
  };

  return (
    <section className="response" aria-label="Response">
      <div className="response-meta">
        <span className={`status status-${statusClass}`}>
          {result.status} {result.reason}
        </span>
        <span className="muted">{formatMs(result.time_ms)}</span>
        <span className="muted">
          {formatBytes(result.size)}
          {result.truncated && " (cut off)"}
        </span>
        {result.redirects.length > 0 && (
          <span className="muted small" title={result.redirects.map((r) => `${r.status} → ${r.url}`).join("\n")}>
            after {result.redirects.length} redirect{result.redirects.length > 1 ? "s" : ""}
          </span>
        )}
        <div className="tabs tabs-inline" role="tablist">
          {json && (
            <button role="tab" aria-selected={view === "pretty"} className={`tab ${view === "pretty" ? "active" : ""}`} onClick={() => setView("pretty")}>
              Pretty
            </button>
          )}
          <button role="tab" aria-selected={view === "raw"} className={`tab ${view === "raw" ? "active" : ""}`} onClick={() => setView("raw")}>
            Raw
          </button>
          <button role="tab" aria-selected={view === "headers"} className={`tab ${view === "headers" ? "active" : ""}`} onClick={() => setView("headers")}>
            Headers <span className="count">{result.headers.length}</span>
          </button>
        </div>
      </div>

      {extracted && (Object.keys(extracted.values).length > 0 || extracted.errors.length > 0) && (
        <div className="extracted">
          {Object.entries(extracted.values).map(([k, v]) => (
            <span key={k} className="chip chip-ok" title={v}>
              {`{{${k}}}`} ← {v.length > 40 ? `${v.slice(0, 40)}…` : v}
            </span>
          ))}
          {extracted.errors.map((e) => (
            <span key={e.var} className="chip chip-bad">
              {`{{${e.var}}}`}: {e.message}
            </span>
          ))}
        </div>
      )}

      {pick && (
        <form
          className="pick-bar"
          onSubmit={(e) => {
            e.preventDefault();
            if (!VAR_NAME.test(pick.name)) return;
            onExtract(pick.name, pick.path, pick.value);
            setPick(null);
          }}
        >
          <span className="small">
            Save <code>{pick.path || "$"}</code> as
          </span>
          <input
            className="mono"
            aria-label="Variable name"
            value={pick.name}
            aria-invalid={!VAR_NAME.test(pick.name)}
            onChange={(e) => setPick({ ...pick, name: e.target.value })}
            autoFocus
          />
          <button className="btn btn-sm btn-primary" type="submit" disabled={!VAR_NAME.test(pick.name)}>
            Add extract rule
          </button>
          <button className="icon-btn" type="button" aria-label="Cancel" onClick={() => setPick(null)}>
            ✕
          </button>
        </form>
      )}

      <div className="response-body">
        {view === "headers" ? (
          <table className="headers-table">
            <tbody>
              {result.headers.map(([k, v], i) => (
                <tr key={i}>
                  <th className="mono">{k}</th>
                  <td className="mono">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : result.binary ? (
          <p className="muted">Binary response ({formatBytes(result.size)}), not shown.</p>
        ) : view === "pretty" && json ? (
          <div className="json-tree mono">
            <p className="muted small tree-hint">Click a value to save it as a variable.</p>
            <JsonNode value={json.value} segs={[]} depth={0} onPick={choose} />
          </div>
        ) : (
          <pre className="raw mono">{result.body || <span className="muted">(empty body)</span>}</pre>
        )}
      </div>
    </section>
  );
}

const MAX_CHILDREN = 200;

function JsonNode({ value, segs, depth, onPick, label }: { value: unknown; segs: Segment[]; depth: number; onPick: (s: Segment[], v: unknown) => void; label?: ReactNode }) {
  const [open, setOpen] = useState(depth < 3);
  const [all, setAll] = useState(false);
  const isArray = Array.isArray(value);
  if (value === null || typeof value !== "object") {
    return (
      <div className="jrow">
        {label}
        <button className={`jval j-${value === null ? "null" : typeof value}`} onClick={() => onPick(segs, value)} title={`Save ${formatPath(segs) || "$"} as a variable`}>
          {JSON.stringify(value)}
        </button>
      </div>
    );
  }
  const entries: [Segment, unknown][] = isArray ? (value as unknown[]).map((v, i) => [i, v]) : Object.entries(value);
  const shown = all ? entries : entries.slice(0, MAX_CHILDREN);
  const [l, r] = isArray ? ["[", "]"] : ["{", "}"];
  return (
    <div className="jnode">
      <div className="jrow">
        {label}
        <button className="jtoggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {l}
          {!open && <span className="muted"> {entries.length} {isArray ? "items" : "keys"} </span>}
          {!open && r}
        </button>
      </div>
      {open && (
        <div className="jchildren">
          {shown.map(([k, v]) => (
            <JsonNode
              key={String(k)}
              value={v}
              segs={[...segs, k]}
              depth={depth + 1}
              onPick={onPick}
              label={<span className={isArray ? "jindex" : "jkey"}>{isArray ? `${k}:` : `${JSON.stringify(k)}:`}</span>}
            />
          ))}
          {shown.length < entries.length && (
            <button className="link-btn small" onClick={() => setAll(true)}>
              Show {entries.length - shown.length} more
            </button>
          )}
        </div>
      )}
      {open && <div className="jrow">{r}</div>}
    </div>
  );
}
