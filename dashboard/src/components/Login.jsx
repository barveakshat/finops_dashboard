import { useState } from "react";
import { useAuth } from "../context/AuthContext";

function initialsFrom(name) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function Login() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [environment, setEnvironment] = useState("Production");
  const [accountId, setAccountId] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !org.trim()) return;

    // If no account ID given, derive a stable-looking one from name+org
    const resolvedAccountId = accountId.trim() || String(
      Math.abs(hashCode(name + org)) % 900000000000 + 100000000000
    );

    login({
      name: name.trim(),
      org: org.trim(),
      environment,
      accountId: resolvedAccountId,
      initials: initialsFrom(name),
    });
  }

  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return h;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <form onSubmit={handleSubmit} className="card" style={{ padding: "2.5rem", width: "420px" }}>
        <div className="eyebrow">AWS Cost Monitoring</div>
        <h1 className="dashboard-title" style={{ fontSize: "1.6rem", marginBottom: "0.4rem" }}>FinOps Dashboard</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
          Sign in with your organization details. Each account sees only its own data.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.72rem", color: "var(--text-faint)", display: "block", marginBottom: "0.3rem" }}>Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Nandini Sharma"
              style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", color: "var(--text-faint)", display: "block", marginBottom: "0.3rem" }}>Organization</label>
            <input value={org} onChange={e => setOrg(e.target.value)} required placeholder="e.g. ABC Technologies"
              style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", color: "var(--text-faint)", display: "block", marginBottom: "0.3rem" }}>Environment</label>
            <select value={environment} onChange={e => setEnvironment(e.target.value)} style={inputStyle}>
              <option>Production</option>
              <option>Staging</option>
              <option>Development</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", color: "var(--text-faint)", display: "block", marginBottom: "0.3rem" }}>
              AWS Account ID <span style={{ color: "var(--text-faint)" }}>(optional — auto-generated if blank)</span>
            </label>
            <input value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="12-digit account ID"
              className="mono" style={inputStyle} />
          </div>

          <button type="submit" className="topbar-control active" style={{ justifyContent: "center", marginTop: "0.5rem", padding: "0.65rem", fontSize: "0.85rem", cursor: "pointer" }}>
            Sign In →
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