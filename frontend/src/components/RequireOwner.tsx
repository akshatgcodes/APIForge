import { createContext, useContext, useEffect, useState, type FormEvent } from "react";
import { Outlet } from "react-router-dom";
import { api } from "../api";

const LogoutContext = createContext<() => void>(() => {});
export const useLogout = () => useContext(LogoutContext);

export default function RequireOwner() {
  const [owner, setOwner] = useState<boolean | null>(null);
  const [apiDown, setApiDown] = useState(false);

  useEffect(() => {
    api.me().then((r) => setOwner(r.owner)).catch(() => setApiDown(true));
  }, []);

  if (apiDown) return <div className="center error">Can't reach the APIForge API. Is the backend running on :8000?</div>;
  if (owner === null) return <div className="center muted">Loading…</div>;
  if (!owner) return <LoginScreen onDone={() => setOwner(true)} />;

  const logout = async () => {
    await api.logout();
    setOwner(false);
  };
  return (
    <LogoutContext.Provider value={logout}>
      <Outlet />
    </LogoutContext.Provider>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M9 11h7M9 16h11M9 21h5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M19 18.5l4 2.5-4 2.5" fill="none" stroke="#fde68a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LoginScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.login(password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <main className="center">
      <form className="panel login" onSubmit={submit}>
        <h1 className="logo big">
          <Logo size={28} /> APIForge
        </h1>
        <p className="muted">Collections of API requests, run from the browser, chained together.</p>
        <label className="label" htmlFor="pw">
          Password
        </label>
        <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit">
          Log in
        </button>
      </form>
    </main>
  );
}
