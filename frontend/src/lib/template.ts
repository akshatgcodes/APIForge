/**
 * The {{variable}} engine. Same syntax as Postman, so imported collections keep working.
 * Names starting with $ are built-ins that produce a fresh value on every send.
 */
import type { Variable } from "../types";

export const VAR_NAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/;
const TOKEN = /\{\{\s*(\$?[A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g;

export type Builtins = Record<string, () => string>;

export const builtins: Builtins = {
  $timestamp: () => String(Math.floor(Date.now() / 1000)),
  $isoTimestamp: () => new Date().toISOString(),
  $uuid: () => crypto.randomUUID(),
  $randomInt: () => String(Math.floor(Math.random() * 1001)),
};

export interface Rendered {
  text: string;
  /** Referenced but not defined anywhere: left as {{name}} in the output. */
  missing: string[];
  /** Defined but empty, e.g. a token that no request has extracted yet. */
  empty: string[];
}

/** Names referenced in a piece of text, in order, without duplicates. */
export function tokens(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN)].map((m) => m[1]))];
}

export function render(
  text: string,
  vars: Record<string, string>,
  fns: Builtins = builtins,
): Rendered {
  const missing = new Set<string>();
  const empty = new Set<string>();
  const out = text.replace(TOKEN, (whole, name: string) => {
    if (name.startsWith("$")) {
      const fn = fns[name];
      if (fn) return fn();
      missing.add(name);
      return whole;
    }
    if (!Object.hasOwn(vars, name)) {
      missing.add(name);
      return whole;
    }
    if (vars[name] === "") empty.add(name);
    return vars[name];
  });
  return { text: out, missing: [...missing], empty: [...empty] };
}

/**
 * Turn the variable list into a lookup, letting values refer to other variables
 * ("api" = "{{host}}/v2"). Stops after a few rounds so a cycle can't loop forever.
 */
export function resolveVars(list: Variable[], fns: Builtins = builtins): Record<string, string> {
  let vars = Object.fromEntries(list.map((v) => [v.key, v.value]));
  for (let round = 0; round < 5; round++) {
    let changed = false;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) {
      next[k] = v.includes("{{") ? render(v, vars, fns).text : v;
      if (next[k] !== v) changed = true;
    }
    vars = next;
    if (!changed) break;
  }
  return vars;
}

/** Set (or add) variables, keeping the existing order. */
export function applyValues(list: Variable[], values: Record<string, string>): Variable[] {
  const out = list.map((v) => (Object.hasOwn(values, v.key) ? { ...v, value: values[v.key] } : v));
  for (const [key, value] of Object.entries(values)) {
    if (!list.some((v) => v.key === key)) out.push({ key, value });
  }
  return out;
}
