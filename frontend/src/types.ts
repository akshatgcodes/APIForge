export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export type Method = (typeof METHODS)[number];
export type BodyType = "none" | "json" | "text";

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

export interface Extract {
  var: string;
  source: "body" | "header" | "status";
  path: string;
}

export interface Variable {
  key: string;
  value: string;
}

export interface Req {
  id: number;
  folder_id: number | null;
  name: string;
  method: Method;
  url: string;
  headers: Header[];
  body_type: BodyType;
  body: string;
  extracts: Extract[];
}

export interface Folder {
  id: number;
  name: string;
  requests: Req[];
}

export interface Collection {
  id: number;
  name: string;
  variables: Variable[];
  folders: Folder[];
  requests: Req[];
  updated_at: string;
}

export interface CollectionSummary {
  id: number;
  name: string;
  requests: number;
  updated_at: string;
}

/** A request with variables filled in, ready for the proxy. */
export interface Prepared {
  method: Method;
  url: string;
  headers: Header[];
  body: string | null;
}

export interface SendResult {
  status: number;
  reason: string;
  headers: [string, string][];
  body: string | null;
  binary: boolean;
  truncated: boolean;
  size: number;
  time_ms: number;
  url: string;
  redirects: { status: number; url: string }[];
}
