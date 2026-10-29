import { useState } from "react";
import { VAR_NAME } from "../lib/template";
import type { Variable } from "../types";
import Modal from "./Modal";

interface Props {
  variables: Variable[];
  producers: Record<string, string[]>;
  onSave: (vars: Variable[]) => void;
  onClose: () => void;
}

export default function VariablesPanel({ variables, producers, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Variable[]>(variables.length ? variables : [{ key: "", value: "" }]);
  const set = (i: number, patch: Partial<Variable>) => setDraft(draft.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const rows = draft.filter((v) => v.key.trim() || v.value);
  const problems = rows.flatMap((v, i) => {
    const key = v.key.trim();
    if (!VAR_NAME.test(key)) return [`“${key || "(blank)"}” isn't a valid name: letters, digits, _ . - and no leading digit`];
    if (rows.findIndex((w) => w.key.trim() === key) !== i) return [`“${key}” is defined twice`];
    return [];
  });

  return (
    <Modal title="Variables" onClose={onClose} wide>
      <p className="muted small">
        Use them anywhere as <code>{"{{name}}"}</code>. Extract rules update these values after each send. Built-ins:{" "}
        <code>{"{{$uuid}}"}</code> <code>{"{{$timestamp}}"}</code> <code>{"{{$isoTimestamp}}"}</code> <code>{"{{$randomInt}}"}</code>.
      </p>
      <div className="kv">
        {draft.map((v, i) => (
          <div key={i} className="kv-row var-row">
            <input className="mono" placeholder="name" aria-label="Variable name" value={v.key} onChange={(e) => set(i, { key: e.target.value })} />
            <input className="mono" placeholder="value" aria-label="Variable value" value={v.value} onChange={(e) => set(i, { value: e.target.value })} />
            <button className="icon-btn" aria-label="Remove variable" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
              ✕
            </button>
            {producers[v.key.trim()] && <span className="muted small var-hint">set by {producers[v.key.trim()].join(", ")}</span>}
          </div>
        ))}
        <button className="link-btn small add-row" onClick={() => setDraft([...draft, { key: "", value: "" }])}>
          + Add variable
        </button>
      </div>
      {problems.map((p) => (
        <p key={p} className="error small">
          {p}
        </p>
      ))}
      <div className="row modal-foot">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          disabled={problems.length > 0}
          onClick={() => {
            onSave(rows.map((v) => ({ key: v.key.trim(), value: v.value })));
            onClose();
          }}
        >
          Save variables
        </button>
      </div>
    </Modal>
  );
}
