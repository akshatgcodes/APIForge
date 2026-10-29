import type { Header, Prepared, Req, Variable } from "../types";
import { render, resolveVars, type Builtins, builtins } from "./template";

export interface Preparation {
  prepared: Prepared;
  missing: string[];
  empty: string[];
  warnings: string[];
}

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Fill in variables and apply the small defaults a user would otherwise forget. */
export function prepare(req: Req, variables: Variable[], fns: Builtins = builtins): Preparation {
  const vars = resolveVars(variables, fns);
  const missing = new Set<string>();
  const empty = new Set<string>();
  const fill = (text: string) => {
    const r = render(text, vars, fns);
    r.missing.forEach((m) => missing.add(m));
    r.empty.forEach((m) => empty.add(m));
    return r.text;
  };

  let url = fill(req.url.trim());
  if (url && !SCHEME.test(url)) url = `http://${url}`;

  const headers: Header[] = req.headers
    .filter((h) => h.enabled && h.key.trim())
    .map((h) => ({ key: fill(h.key.trim()), value: fill(h.value), enabled: true }));

  const warnings: string[] = [];
  let body: string | null = null;
  if (req.body_type !== "none") {
    body = fill(req.body);
    if (req.body_type === "json") {
      if (!headers.some((h) => h.key.toLowerCase() === "content-type"))
        headers.push({ key: "Content-Type", value: "application/json", enabled: true });
      try {
        if (body.trim()) JSON.parse(body);
      } catch {
        warnings.push("The body isn't valid JSON after filling in variables");
      }
    }
  }

  return {
    prepared: { method: req.method, url, headers, body },
    missing: [...missing],
    empty: [...empty],
    warnings,
  };
}

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function toCurl(p: Prepared): string {
  const parts = ["curl"];
  if (p.method === "HEAD") parts.push("--head");
  else if (p.method !== "GET" || p.body) parts.push(`-X ${p.method}`);
  parts.push(quote(p.url));
  for (const h of p.headers) parts.push(`-H ${quote(`${h.key}: ${h.value}`)}`);
  if (p.body) parts.push(`--data-raw ${quote(p.body)}`);
  return parts.join(" \\\n  ");
}
