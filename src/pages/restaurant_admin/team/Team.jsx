import { useCallback, useEffect, useState } from "react";
import "./team.css";
import { authFetch, API_BASE } from "../../../lib/api";

export default function Team() {
  const [members, setMembers] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "waiter",
  });

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/auth/team/`);
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || data.detail || "Could not load team.");
        setMembers([]);
        return;
      }
      setErr("");
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      setErr("Network error.");
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const res = await authFetch(`${API_BASE}/api/auth/team/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || data.detail || "Could not create user.");
        return;
      }
      setMsg(`Created access for ${data.email}.`);
      setForm({ email: "", full_name: "", password: "", role: "waiter" });
      load();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mm-team">
      <header className="mm-team__hero">
        <p className="mm-team__eyebrow">Access control</p>
        <h1>Team</h1>
        <p className="mm-team__lead">
          Create <strong>waiter</strong>, <strong>cashier</strong>, and <strong>kitchen</strong> logins for your
          restaurant. Only you as restaurant admin can add these roles.
        </p>
      </header>

      {msg ? <div className="mm-team__banner mm-team__banner--ok">{msg}</div> : null}
      {err ? <div className="mm-team__banner mm-team__banner--err">{err}</div> : null}

      <div className="mm-team__grid">
        <section className="mm-team__card">
          <h2>Add member</h2>
          <form className="mm-team__form" onSubmit={submit}>
            <label>
              Full name
              <input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                required
                autoComplete="name"
              />
            </label>
            <label>
              Email (login)
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                autoComplete="off"
              />
            </label>
            <label>
              Role
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="waiter">Waiter</option>
                <option value="cashier">Cashier</option>
                <option value="kitchen">Kitchen</option>
              </select>
            </label>
            <label>
              Temporary password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="mm-team__submit" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
        </section>

        <section className="mm-team__card mm-team__card--list">
          <h2>Current team</h2>
          {members.length === 0 ? (
            <p className="mm-team__empty">No waiter, cashier, or kitchen accounts yet.</p>
          ) : (
            <ul className="mm-team__list">
              {members.map((m) => (
                <li key={m.id}>
                  <div>
                    <span className="mm-team__name">{m.full_name}</span>
                    <span className="mm-team__email">{m.email}</span>
                  </div>
                  <span className={`mm-team__role mm-team__role--${m.role}`}>
                    {m.role.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
