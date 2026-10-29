/**
 * Run requests one after another, feeding each response's extracted values into the
 * variables used by the next request. Pure apart from the `send` it's given.
 */
import type { Prepared, Req, SendResult, Variable } from "../types";
import { runExtracts } from "./extract";
import { prepare } from "./prepare";
import { applyValues } from "./template";

export interface Step {
  request: Req;
  status?: number;
  time_ms?: number;
  error?: string;
  extracted: Record<string, string>;
  ok: boolean;
}

export async function runAll(
  requests: Req[],
  variables: Variable[],
  send: (p: Prepared) => Promise<SendResult>,
  opts: { stopOnError?: boolean; onStep?: (step: Step, vars: Variable[]) => void } = {},
): Promise<{ steps: Step[]; variables: Variable[] }> {
  const steps: Step[] = [];
  let vars = variables;
  for (const request of requests) {
    const step: Step = { request, extracted: {}, ok: false };
    const { prepared, missing } = prepare(request, vars);
    if (missing.length) {
      step.error = `Not sent: ${missing.map((m) => `{{${m}}}`).join(", ")} not defined`;
    } else {
      try {
        const res = await send(prepared);
        step.status = res.status;
        step.time_ms = res.time_ms;
        const { values, errors } = runExtracts(request.extracts, res);
        step.extracted = values;
        vars = applyValues(vars, values);
        if (res.status >= 400) step.error = `HTTP ${res.status} ${res.reason}`;
        else if (errors.length) step.error = errors.map((e) => `${e.var}: ${e.message}`).join("; ");
        step.ok = !step.error;
      } catch (e) {
        step.error = (e as Error).message;
      }
    }
    steps.push(step);
    opts.onStep?.(step, vars);
    if (!step.ok && opts.stopOnError) break;
  }
  return { steps, variables: vars };
}
