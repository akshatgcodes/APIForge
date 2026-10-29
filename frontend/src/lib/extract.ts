/**
 * Pull values out of a response so later requests can use them: the "chain" in
 * request chaining. Paths look like `data.items[0].id` or `meta["x-rate"]`.
 */
import type { Extract, SendResult } from "../types";

export type Segment = string | number;

export function parsePath(path: string): Segment[] {
  let s = path.trim();
  if (s.startsWith("$")) s = s.slice(1);
  const segs: Segment[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === ".") {
      i++;
      const m = /^[^.[\]]+/.exec(s.slice(i));
      if (!m) throw new Error(`Expected a key after "." at position ${i}`);
      segs.push(m[0]);
      i += m[0].length;
    } else if (s[i] === "[") {
      const rest = s.slice(i);
      const index = /^\[(\d+)\]/.exec(rest);
      const quoted = /^\[(["'])((?:\\.|(?!\1).)*)\1\]/.exec(rest);
      if (index) {
        segs.push(Number(index[1]));
        i += index[0].length;
      } else if (quoted) {
        segs.push(quoted[2].replace(/\\(.)/g, "$1"));
        i += quoted[0].length;
      } else {
        throw new Error(`Couldn't read the [...] at position ${i}`);
      }
    } else if (segs.length === 0) {
      const m = /^[^.[\]]+/.exec(s);
      segs.push(m![0]);
      i += m![0].length;
    } else {
      throw new Error(`Unexpected "${s[i]}" at position ${i}`);
    }
  }
  return segs;
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$-]*$/;

/** The inverse of parsePath, used when the user clicks a value in the response. */
export function formatPath(segs: Segment[]): string {
  return segs
    .map((seg, i) => {
      if (typeof seg === "number") return `[${seg}]`;
      if (IDENT.test(seg)) return i === 0 ? seg : `.${seg}`;
      return `[${JSON.stringify(seg)}]`;
    })
    .join("");
}

export function getPath(value: unknown, segs: Segment[]): { found: boolean; value?: unknown } {
  let cur = value;
  for (const seg of segs) {
    if (cur === null || typeof cur !== "object") return { found: false };
    // JSON semantics: numbers index arrays, strings index objects (so no "items.length")
    const hit = Array.isArray(cur)
      ? typeof seg === "number" && seg < cur.length
      : typeof seg === "string" && Object.hasOwn(cur, seg);
    if (!hit) return { found: false };
    cur = (cur as Record<string | number, unknown>)[seg];
  }
  return { found: true, value: cur };
}

/** Variables are strings: keep strings as-is, JSON-encode everything else. */
export function asString(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export interface ExtractOutcome {
  values: Record<string, string>;
  errors: { var: string; message: string }[];
}

export function runExtracts(rules: Extract[], res: SendResult): ExtractOutcome {
  const out: ExtractOutcome = { values: {}, errors: [] };
  let json: { ok: boolean; value?: unknown } | undefined;
  for (const rule of rules) {
    const fail = (message: string) => out.errors.push({ var: rule.var, message });
    if (rule.source === "status") {
      out.values[rule.var] = String(res.status);
    } else if (rule.source === "header") {
      const name = rule.path.trim().toLowerCase();
      const hit = res.headers.find(([k]) => k.toLowerCase() === name);
      if (hit) out.values[rule.var] = hit[1];
      else fail(`No "${rule.path}" header in the response`);
    } else {
      if (json === undefined) {
        try {
          json = { ok: true, value: JSON.parse(res.body ?? "") };
        } catch {
          json = { ok: false };
        }
      }
      if (!json.ok) {
        fail("The response body isn't JSON");
        continue;
      }
      try {
        const got = getPath(json.value, parsePath(rule.path));
        if (got.found) out.values[rule.var] = asString(got.value);
        else fail(`Nothing at "${rule.path || "$"}" in the response`);
      } catch (e) {
        fail((e as Error).message);
      }
    }
  }
  return out;
}
