import { useEffect, useState } from "react";
import { authFetch, API_BASE } from "../../../lib/api";
import "./paymentSettings.css";

export default function PaymentSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [merchantId, setMerchantId] = useState("");
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
      setMerchantId(data.merchant_id || "");
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
        body: JSON.stringify({ merchant_id: merchantId, secret_key: secretKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.error || "Save failed.");
        return;
      }
      setMerchantId(data.merchant_id || "");
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
    return <p className="payment-settings__muted">Loading…</p>;
  }

  return (
    <div className="payment-settings">
      <h1 className="page-title">Payment settings</h1>
      <p className="payment-settings__intro">
        eSewa credentials are stored only on the server and used to sign payment requests. Use your sandbox
        merchant code and secret for testing.
      </p>

      {error ? <p className="payment-settings__error">{error}</p> : null}

      <form onSubmit={save} className="payment-settings__form">
        <label>
          Merchant ID (product code)
          <input
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            placeholder="e.g. EPAYTEST"
            autoComplete="off"
          />
        </label>
        <label>
          Secret key
          <input
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="From eSewa merchant dashboard"
            autoComplete="new-password"
          />
        </label>
        {updatedAt ? <p className="payment-settings__muted">Last updated: {updatedAt}</p> : null}
        <button type="submit" className="payment-settings__submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
