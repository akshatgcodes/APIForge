import axios, { AxiosError } from "axios";
import type { Collection, CollectionSummary, Folder, Prepared, Req, SendResult, Variable } from "./types";
import type { Layout } from "./lib/state";

// Empty in dev (Vite proxies /api). Set VITE_API_URL when the API is elsewhere.
const http = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "", withCredentials: true });

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** FastAPI errors come back as {detail: string | [{loc, msg}]}; turn them into one line. */
function message(err: AxiosError<{ detail?: unknown }>): string {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { loc?: unknown[]; msg?: string };
    return `${first.msg ?? "Invalid"}${first.loc ? ` (${first.loc.slice(1).join(".")})` : ""}`;
  }
  if (!err.response) return "Can't reach the APIForge server";
  return err.response.statusText || err.message;
}

http.interceptors.response.use(undefined, (err: AxiosError<{ detail?: unknown }>) =>
  Promise.reject(new ApiError(err.response?.status ?? 0, message(err))),
);

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export type RequestPatch = Partial<Omit<Req, "id">>;

export const api = {
  me: () => data<{ owner: boolean }>(http.get("/api/auth/me")),
  login: (password: string) => http.post("/api/auth/login", { password }),
  logout: () => http.post("/api/auth/logout"),

  collections: () => data<CollectionSummary[]>(http.get("/api/collections")),
  collection: (id: number) => data<Collection>(http.get(`/api/collections/${id}`)),
  createCollection: (name: string) => data<Collection>(http.post("/api/collections", { name })),
  createExample: () => data<Collection>(http.post("/api/collections/example")),
  importCollection: (file: unknown) =>
    data<Collection & { skipped: string[] }>(http.post("/api/collections/import", file)),
  exportCollection: (id: number) => data<unknown>(http.get(`/api/collections/${id}/export`)),
  patchCollection: (id: number, patch: { name?: string; variables?: Variable[] }) =>
    data<Collection>(http.patch(`/api/collections/${id}`, patch)),
  deleteCollection: (id: number) => http.delete(`/api/collections/${id}`),
  setLayout: (id: number, layout: Layout) => data<Collection>(http.put(`/api/collections/${id}/layout`, layout)),

  createFolder: (cid: number, name: string) => data<Folder>(http.post(`/api/collections/${cid}/folders`, { name })),
  renameFolder: (id: number, name: string) => http.patch(`/api/folders/${id}`, { name }),
  deleteFolder: (id: number) => http.delete(`/api/folders/${id}`),

  createRequest: (cid: number, fields: RequestPatch) => data<Req>(http.post(`/api/collections/${cid}/requests`, fields)),
  patchRequest: (id: number, patch: RequestPatch) => data<Req>(http.patch(`/api/requests/${id}`, patch)),
  duplicateRequest: (id: number) => data<Req>(http.post(`/api/requests/${id}/duplicate`)),
  deleteRequest: (id: number) => http.delete(`/api/requests/${id}`),

  send: (p: Prepared) => data<SendResult>(http.post("/api/send", p)),
};
