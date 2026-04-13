import { useEffect, useState } from "react";
import "./settings.css";
import { authFetch, API_BASE } from "../../../lib/api";

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
    <div className="pa-settings">
      <header className="pa-settings__hero">
        <div>
          <p className="pa-settings__eyebrow">Platform controls</p>
          <h1>Settings</h1>
          <p className="pa-settings__lead">
            Manage the platform admin profile and control whether new restaurant signups are allowed.
          </p>
        </div>
        <div className="pa-settings__stamp">
          <span>Last updated</span>
          <strong>{updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</strong>
        </div>
      </header>

      {error ? <div className="pa-settings__alert is-error">{error}</div> : null}
      {message ? <div className="pa-settings__alert is-success">{message}</div> : null}

      <div className="pa-settings__grid">
        <section className="pa-settings__card">
          <h2>Admin profile</h2>
          <form className="pa-settings__form" onSubmit={saveProfile}>
            <label>
              Full name
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile((current) => ({ ...current, full_name: e.target.value }))}
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile((current) => ({ ...current, email: e.target.value }))}
              />
            </label>

            <label className="pa-settings__toggle">
              <div>
                <strong>Allow new restaurant registrations</strong>
                <span>Turning this off blocks new signup attempts, but existing users can still log in.</span>
              </div>
              <input
                type="checkbox"
                checked={allowRegistration}
                onChange={(e) => setAllowRegistration(e.target.checked)}
              />
            </label>

            <button type="submit" className="pa-settings__btn" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>

        <section className="pa-settings__card">
          <h2>Change password</h2>
          <form className="pa-settings__form" onSubmit={savePassword}>
            <label>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>

            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>

            <button type="submit" className="pa-settings__btn pa-settings__btn--secondary" disabled={savingPassword}>
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
