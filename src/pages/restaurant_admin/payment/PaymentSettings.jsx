import { useEffect, useState } from "react";
import { authFetch, API_BASE } from "../../../lib/api";
import PasswordField from "../../../components/PasswordField";

export default function PaymentSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const load = async () => {
    setError("");
    try {
      const res = await authFetch(`${API_BASE}/api/dashboard/payment-config/`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.detail || "Could not load settings.");
        return;
      }
      setPublicKey(data.public_key || "");
      setSecretKey(data.secret_key || "");
      setUpdatedAt(data.updated_at || "");
    } catch (e) {
      console.error(e);
      setError("Network error.");
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
    try {
      const res = await authFetch(`${API_BASE}/api/dashboard/payment-config/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_key: publicKey, secret_key: secretKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.error || "Save failed.");
        return;
      }
      setPublicKey(data.public_key || "");
      setSecretKey(data.secret_key || "");
      setUpdatedAt(data.updated_at || "");
    } catch (err) {
      console.error(err);
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="max-w-[520px]">
      <h1 className="mb-3 text-3xl font-semibold tracking-tight text-slate-950">Payment settings</h1>
      <p className="mb-5 text-[0.95rem] leading-6 text-slate-500">
        Khalti credentials allow you to receive payments directly. These are stored securely on the server.
        Use your <a href="https://khalti.com/join/" target="_blank" rel="noreferrer" className="text-purple-600 underline">Khalti Merchant</a> sandbox keys for development.
      </p>

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-900">
          Public Key
          <input
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="e.g. key_public_..."
            autoComplete="off"
            className="rounded-[10px] border border-slate-200 px-3.5 py-2.5 text-base outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-900">
          Secret Key
          <PasswordField
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="e.g. key_secret_..."
            autoComplete="new-password"
            className="w-full rounded-[10px] border border-slate-200 px-3.5 py-2.5 pr-11 text-base outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            buttonClassName="text-slate-400 hover:text-slate-700 focus-visible:ring-slate-300"
          />
        </label>
        {updatedAt ? <p className="text-[0.85rem] text-slate-500">Last updated: {updatedAt}</p> : null}
        <button
          type="submit"
          className="mt-2 w-fit rounded-[10px] bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
