import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, authError, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLocalError(null);

    try {
      await login(email.trim(), password);
    } catch (err) {
      setLocalError(err.message);
    }
  }

  const errorMsg = localError || authError;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <form onSubmit={handleSubmit} className="card" style={{ padding: "2.5rem", width: "420px" }}>
        <div className="eyebrow">AWS Cost Monitoring</div>
        <h1 className="dashboard-title" style={{ fontSize: "1.6rem", marginBottom: "0.4rem" }}>FinOps Dashboard</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
          Sign in with your credentials to access cost data.
        </p>

        {errorMsg && (
          <div style={{
            padding: "0.6rem 0.8rem", marginBottom: "1rem", borderRadius: "8px",
            background: "rgba(255, 80, 80, 0.1)", border: "1px solid rgba(255, 80, 80, 0.3)",
            color: "#ff6b6b", fontSize: "0.82rem"
          }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.72rem", color: "var(--text-faint)", display: "block", marginBottom: "0.3rem" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="demo@finops.dev"
              autoComplete="username"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", color: "var(--text-faint)", display: "block", marginBottom: "0.3rem" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="topbar-control active"
            style={{
              justifyContent: "center", marginTop: "0.5rem", padding: "0.65rem",
              fontSize: "0.85rem", cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "0.55rem 0.7rem", borderRadius: "8px",
  background: "var(--surface-raised)", border: "1px solid var(--border-strong)",
  color: "var(--text-primary)", fontSize: "0.85rem", fontFamily: "inherit"
};