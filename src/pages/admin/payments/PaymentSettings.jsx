import { useEffect, useState } from "react";
import { authFetch, API_BASE } from "../../../lib/api";
import PasswordField from "../../../components/PasswordField";

export default function PaymentSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const load = async () => {
    setError("");
    try {
      const res = await authFetch(`${API_BASE}/api/admin/dashboard/settings/`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load settings.");
        return;
      }
      setPublicKey(data.settings?.khalti_public_key || "");
      setSecretKey(data.settings?.khalti_secret_key || "");
      setUpdatedAt(data.settings?.updated_at || "");
    } catch (e) {
      console.error(e);
      setError("Network error while loading settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/admin/dashboard/settings/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          khalti_public_key: publicKey, 
          khalti_secret_key: secretKey 
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save platform settings.");
        return;
      }
      setPublicKey(data.settings?.khalti_public_key || "");
      setSecretKey(data.settings?.khalti_secret_key || "");
      setUpdatedAt(data.settings?.updated_at || "");
      setMessage("Khalti credentials updated successfully.");
    } catch (err) {
      console.error(err);
      setError("Network error while saving settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#A1BDAB] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 text-[#172E1B]">
      <header className="flex flex-col gap-[18px] xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[#57735D]">System configuration</p>
          <h1 className="my-1.5 text-4xl font-extrabold tracking-[-0.03em] text-[#1A3120]">Payment Settings</h1>
          <p className="max-w-[720px] text-[#57735D]">
            Configure the platform's Khalti merchant credentials. These keys are used to receive subscription payments from restaurants.
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

      <div className="grid max-w-[600px] gap-4">
        <section className="rounded-[20px] border border-[#2A442E]/10 bg-white p-6 shadow-[0_4px_12px_rgba(42,68,46,0.04)]">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5C2D91]/10 text-[#5C2D91]">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#172E1B]">Khalti Credentials</h2>
              <p className="text-sm text-[#57735D]">Managed via the Khalti Merchant Dashboard</p>
            </div>
          </div>

          <form onSubmit={save} className="grid gap-5">
            <div className="grid gap-2">
              <label className="text-[0.92rem] font-semibold text-[#172E1B]">
                Public Key
              </label>
              <input
                type="text"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="key_public_..."
                className="w-full rounded-[14px] border border-[#2A442E]/20 bg-white px-3.5 py-3 text-[#172E1B] outline-none transition focus:border-[#A1BDAB] focus:ring-4 focus:ring-[#A1BDAB]/20"
              />
              <p className="text-xs text-[#57735D]">Your Khalti public key for identifying the merchant account.</p>
            </div>

            <div className="grid gap-2">
              <label className="text-[0.92rem] font-semibold text-[#172E1B]">
                Secret Key
              </label>
              <PasswordField
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="key_secret_..."
                className="w-full rounded-[14px] border border-[#2A442E]/20 bg-white px-3.5 py-3 pr-11 text-[#172E1B] outline-none transition focus:border-[#A1BDAB] focus:ring-4 focus:ring-[#A1BDAB]/20"
                buttonClassName="text-[#57735D] hover:text-[#172E1B] focus-visible:ring-[#A1BDAB]/30"
              />
              <p className="text-xs text-[#57735D]">Your Khalti secret key. Keep this private and never expose it on the client side.</p>
            </div>

            <div className="mt-2 flex items-center gap-4">
              <button
                type="submit"
                className="rounded-[14px] bg-[linear-gradient(120deg,#A1BDAB,#7DA389)] px-6 py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(161,189,171,0.3)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save credentials"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
