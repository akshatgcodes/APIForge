import { useState } from "react";
import { api } from "../api";
import { formatMs } from "../lib/format";
import { runAll, type Step } from "../lib/runner";
import type { Req, Variable } from "../types";
import Modal from "./Modal";
import { MethodTag } from "./Sidebar";

interface Props {
  title: string;
  requests: Req[];
  variables: Variable[];
  onValues: (values: Record<string, string>) => void;
  onClose: () => void;
}

export default function RunnerPanel({ title, requests, variables, onValues, onClose }: Props) {
  const [stopOnError, setStopOnError] = useState(true);
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const start = async () => {
    setSteps([]);
    setDone(false);
    setRunning(true);
    await runAll(requests, variables, api.send, {
      stopOnError,
      onStep: (step) => {
        setSteps((s) => [...s, step]);
        onValues(step.extracted);
      },
    });
    setRunning(false);
    setDone(true);
  };

  const passed = steps.filter((s) => s.ok).length;
  const total = steps.reduce((sum, s) => sum + (s.time_ms ?? 0), 0);

  return (
    <Modal title={`Run: ${title}`} onClose={onClose} wide>
      <p className="muted small">
        Sends {requests.length} request{requests.length === 1 ? "" : "s"} in sidebar order. Each one's extracted values are available to the
        next.
      </p>
      <div className="row wrap">
        <label className="radio">
          <input type="checkbox" checked={stopOnError} onChange={(e) => setStopOnError(e.target.checked)} disabled={running} />
          Stop at the first failure
        </label>
        <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={start} disabled={running || !requests.length}>
          {running ? "Running…" : done ? "Run again" : "Run"}
        </button>
      </div>
      <ol className="steps">
        {requests.map((r, i) => {
          const step = steps[i];
          const state = step ? (step.ok ? "ok" : "bad") : running && i === steps.length ? "running" : "idle";
          return (
            <li key={r.id} className={`step step-${state}`}>
              <span className="step-icon" aria-hidden>
                {state === "ok" ? "✓" : state === "bad" ? "✕" : state === "running" ? "…" : "·"}
              </span>
              <MethodTag method={r.method} />
              <span className="step-name">{r.name}</span>
              <span className="step-meta muted small">
                {step?.status !== undefined && <span className={step.status < 400 ? "ok-text" : "error"}>{step.status}</span>}
                {step?.time_ms !== undefined && <span> · {formatMs(step.time_ms)}</span>}
              </span>
              {step && (Object.keys(step.extracted).length > 0 || step.error) && (
                <div className="step-detail">
                  {Object.entries(step.extracted).map(([k, v]) => (
                    <span key={k} className="chip chip-ok" title={v}>
                      {`{{${k}}}`} ← {v.length > 32 ? `${v.slice(0, 32)}…` : v}
                    </span>
                  ))}
                  {step.error && <span className="error small">{step.error}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {done && (
        <p className={passed === requests.length ? "ok-text" : "error"} role="status">
          {passed} of {requests.length} passed{steps.length < requests.length ? ` (stopped after ${steps.length})` : ""} · {formatMs(total)} total
        </p>
      )}
    </Modal>
  );
}
