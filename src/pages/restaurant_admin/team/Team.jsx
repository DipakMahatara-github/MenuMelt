import { useCallback, useEffect, useState } from "react";
import { authFetch, API_BASE } from "../../../lib/api";
import PasswordField from "../../../components/PasswordField";

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
    <div className="mx-auto max-w-[1100px] font-[Outfit,system-ui,sans-serif] text-slate-100">
      <header className="mb-8">
        <p className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-sky-300">Access control</p>
        <h1 className="mb-2 text-[clamp(1.85rem,3vw,2.4rem)] font-extrabold tracking-[-0.03em] text-transparent bg-[linear-gradient(120deg,#f8fafc,#7dd3fc)] bg-clip-text">
          Team
        </h1>
        <p className="max-w-[42rem] leading-7 text-slate-400">
          Create <strong>waiter</strong>, <strong>cashier</strong>, and <strong>kitchen</strong> logins for your
          restaurant. Only you as restaurant admin can add these roles.
        </p>
      </header>

      {msg ? (
        <div className="mb-4 rounded-xl border border-emerald-400/35 bg-emerald-400/12 px-4 py-3 text-[0.95rem] text-emerald-200">
          {msg}
        </div>
      ) : null}
      {err ? (
        <div className="mb-4 rounded-xl border border-red-400/35 bg-red-400/12 px-4 py-3 text-[0.95rem] text-red-200">
          {err}
        </div>
      ) : null}

      <div className="grid items-start gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <section className="rounded-[20px] border border-sky-300/12 bg-[linear-gradient(155deg,rgba(15,23,42,0.92),rgba(12,18,36,0.88))] px-6 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <h2 className="mb-5 text-[1.05rem] font-bold text-slate-300">Add member</h2>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <label className="flex flex-col gap-1.5 text-[0.82rem] font-semibold text-slate-400">
              Full name
              <input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                required
                autoComplete="name"
                className="rounded-xl border border-slate-400/25 bg-slate-950/55 px-3.5 py-2.5 text-base text-slate-100 outline-none transition focus:border-sky-400/55 focus:ring-4 focus:ring-sky-400/15"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.82rem] font-semibold text-slate-400">
              Email (login)
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                autoComplete="off"
                className="rounded-xl border border-slate-400/25 bg-slate-950/55 px-3.5 py-2.5 text-base text-slate-100 outline-none transition focus:border-sky-400/55 focus:ring-4 focus:ring-sky-400/15"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.82rem] font-semibold text-slate-400">
              Role
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="rounded-xl border border-slate-400/25 bg-slate-950/55 px-3.5 py-2.5 text-base text-slate-100 outline-none transition focus:border-sky-400/55 focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="waiter">Waiter</option>
                <option value="cashier">Cashier</option>
                <option value="kitchen">Kitchen</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[0.82rem] font-semibold text-slate-400">
              Temporary password
              <PasswordField
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-400/25 bg-slate-950/55 px-3.5 py-2.5 pr-11 text-base text-slate-100 outline-none transition focus:border-sky-400/55 focus:ring-4 focus:ring-sky-400/15"
                buttonClassName="text-slate-400 hover:text-sky-300 focus-visible:ring-sky-400/30"
              />
            </label>
            <button
              type="submit"
              className="mt-1 rounded-xl bg-[linear-gradient(120deg,#38bdf8,#818cf8)] px-4 py-3 font-bold text-slate-950 shadow-[0_14px_32px_rgba(56,189,248,0.3)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
        </section>

        <section className="rounded-[20px] border border-sky-300/12 bg-[linear-gradient(155deg,rgba(15,23,42,0.92),rgba(12,18,36,0.88))] px-6 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <h2 className="mb-5 text-[1.05rem] font-bold text-slate-300">Current team</h2>
          {members.length === 0 ? (
            <p className="m-0 text-slate-500">No waiter, cashier, or kitchen accounts yet.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4 border-b border-slate-400/12 py-3.5">
                  <div>
                    <span className="block font-bold text-slate-100">{m.full_name}</span>
                    <span className="text-[0.85rem] text-slate-400">{m.email}</span>
                  </div>
                  <span
                    className={[
                      "rounded-full border px-2.5 py-1 text-[0.72rem] font-extrabold uppercase tracking-[0.08em]",
                      m.role === "waiter" && "border-sky-300/40 text-sky-300",
                      m.role === "cashier" && "border-yellow-300/40 text-yellow-200",
                      m.role === "kitchen" && "border-rose-300/45 text-rose-300",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
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
