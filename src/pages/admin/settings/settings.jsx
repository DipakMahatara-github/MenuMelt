import { useEffect, useState } from "react";
import { authFetch, API_BASE } from "../../../lib/api";
import PasswordField from "../../../components/PasswordField";

export default function Settings() {
  const [profile, setProfile] = useState({ full_name: "", email: "" });
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/admin/dashboard/settings/`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (!res.ok) {
            setError(json.error || "Could not load platform settings.");
            return;
          }
          setError("");
          setProfile({
            full_name: json.profile?.full_name || "",
            email: json.profile?.email || "",
          });
          setAllowRegistration(Boolean(json.settings?.allow_restaurant_registration));
          setUpdatedAt(json.settings?.updated_at || "");
        }
      } catch {
        if (!cancelled) setError("Network error while loading platform settings.");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setError("");
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/admin/dashboard/settings/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: profile.full_name,
          email: profile.email,
          allow_restaurant_registration: allowRegistration,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not save platform settings.");
        return;
      }
      setProfile({
        full_name: json.profile?.full_name || "",
        email: json.profile?.email || "",
      });
      setAllowRegistration(Boolean(json.settings?.allow_restaurant_registration));
      setUpdatedAt(json.settings?.updated_at || "");
      setMessage(json.message || "Platform settings updated.");
    } catch {
      setError("Network error while saving platform settings.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setError("");
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/admin/dashboard/settings/change-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not update password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setMessage(json.message || "Password updated successfully.");
    } catch {
      setError("Network error while updating password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 text-[#172E1B]">
      <header className="flex flex-col gap-[18px] xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[#57735D]">Platform controls</p>
          <h1 className="my-1.5 text-4xl font-extrabold tracking-[-0.03em] text-[#1A3120]">Settings</h1>
          <p className="max-w-[720px] text-[#57735D]">
            Manage the platform admin profile and control whether new restaurant signups are allowed.
          </p>
        </div>
        <div className="min-w-[220px] rounded-[20px] border border-[#2A442E]/10 bg-white px-[18px] py-4 shadow-[0_4px_12px_rgba(42,68,46,0.04)]">
          <span className="block text-[0.82rem] text-[#57735D]">Last updated</span>
          <strong className="mt-1.5 block text-[#172E1B]">{updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</strong>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3.5 text-red-800 font-medium">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3.5 text-emerald-800 font-medium">{message}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[20px] border border-[#2A442E]/10 bg-white p-5 shadow-[0_4px_12px_rgba(42,68,46,0.04)]">
          <h2 className="mb-4 text-xl font-semibold text-[#172E1B]">Admin profile</h2>
          <form className="grid gap-4" onSubmit={saveProfile}>
            <label className="grid gap-2 text-[0.92rem] text-[#57735D]">
              Full name
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile((current) => ({ ...current, full_name: e.target.value }))}
                className="w-full rounded-[14px] border border-[#2A442E]/20 bg-white px-3.5 py-3 text-[#172E1B] outline-none transition focus:border-[#A1BDAB] focus:ring-4 focus:ring-[#A1BDAB]/20"
              />
            </label>

            <label className="grid gap-2 text-[0.92rem] text-[#57735D]">
              Email
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile((current) => ({ ...current, email: e.target.value }))}
                className="w-full rounded-[14px] border border-[#2A442E]/20 bg-white px-3.5 py-3 text-[#172E1B] outline-none transition focus:border-[#A1BDAB] focus:ring-4 focus:ring-[#A1BDAB]/20"
              />
            </label>

            <label className="flex items-center justify-between gap-[18px] rounded-2xl border border-[#2A442E]/10 bg-[#FAF6ED] p-4">
              <div>
                <strong className="mb-1 block text-[#172E1B]">Allow new restaurant registrations</strong>
                <span className="text-[0.86rem] text-[#57735D]">
                  Turning this off blocks new signup attempts, but existing users can still log in.
                </span>
              </div>
              <input
                type="checkbox"
                checked={allowRegistration}
                onChange={(e) => setAllowRegistration(e.target.checked)}
                className="h-5 w-5 accent-sky-500"
              />
            </label>

            <button
              type="submit"
              className="rounded-[14px] bg-[linear-gradient(120deg,#A1BDAB,#7DA389)] px-4 py-3 font-bold text-white shadow-[0_8px_20px_rgba(161,189,171,0.3)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={savingProfile}
            >
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>

        <section className="rounded-[20px] border border-[#2A442E]/10 bg-white p-5 shadow-[0_4px_12px_rgba(42,68,46,0.04)]">
          <h2 className="mb-4 text-xl font-semibold text-[#172E1B]">Change password</h2>
          <form className="grid gap-4" onSubmit={savePassword}>
            <label className="grid gap-2 text-[0.92rem] text-[#57735D]">
              Current password
              <PasswordField
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-[14px] border border-[#2A442E]/20 bg-white px-3.5 py-3 pr-11 text-[#172E1B] outline-none transition focus:border-[#A1BDAB] focus:ring-4 focus:ring-[#A1BDAB]/20"
                buttonClassName="text-[#57735D] hover:text-[#172E1B] focus-visible:ring-[#A1BDAB]/30"
              />
            </label>

            <label className="grid gap-2 text-[0.92rem] text-[#57735D]">
              New password
              <PasswordField
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-[14px] border border-[#2A442E]/20 bg-white px-3.5 py-3 pr-11 text-[#172E1B] outline-none transition focus:border-[#A1BDAB] focus:ring-4 focus:ring-[#A1BDAB]/20"
                buttonClassName="text-[#57735D] hover:text-[#172E1B] focus-visible:ring-[#A1BDAB]/30"
              />
            </label>

            <button
              type="submit"
              className="rounded-[14px] bg-[linear-gradient(135deg,#10B981,#059669)] px-4 py-3 font-bold text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={savingPassword}
            >
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
