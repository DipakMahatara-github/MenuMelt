import { useEffect, useMemo, useState } from "react";
import "./subscriptions.css";
import { authFetch, API_BASE } from "../../../lib/api";

const STATUS_OPTIONS = ["all", "active", "pending", "failed", "expired", "cancelled"];

export default function Subscriptions() {
  const [data, setData] = useState({ stats: {}, subscriptions: [] });
  const [statusFilter, setStatusFilter] = useState("all");
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (onlyExpiring) params.set("expiring", "true");
      if (search.trim()) params.set("search", search.trim());
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await authFetch(`${API_BASE}/api/restaurants/admin/subscriptions/${query}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not load subscription data.");
        return;
      }
      setError("");
      setData(json);
    } catch {
      setError("Network error.");
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, onlyExpiring]);

  const stats = data.stats || {};
  const rows = data.subscriptions || [];

  const revenueLabel = useMemo(() => `Rs. ${Number(stats.revenue || 0).toFixed(2)}`, [stats.revenue]);

  const patchSubscription = async (id, payload) => {
    const marker = `${id}:${payload.status}:${payload.extend_days || 0}`;
    setBusyKey(marker);
    try {
      const res = await authFetch(`${API_BASE}/api/restaurants/admin/subscriptions/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not update subscription.");
        return;
      }
      setError("");
      load();
    } catch {
      setError("Network error.");
    } finally {
      setBusyKey("");
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString();
  };

  return (
    <div className="mm-admin-subscriptions">
      <header className="mm-admin-subscriptions__hero">
        <div>
          <p className="mm-admin-subscriptions__eyebrow">Platform billing</p>
          <h1>Restaurant subscriptions</h1>
          <p className="mm-admin-subscriptions__lead">
            Monitor active restaurants, catch subscriptions that are about to end, and intervene when payments fail.
          </p>
        </div>

        <div className="mm-admin-subscriptions__controls">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
            placeholder="Search restaurant or owner"
          />
          <button type="button" onClick={load}>
            Refresh
          </button>
        </div>
      </header>

      {error ? <div className="mm-admin-subscriptions__alert">{error}</div> : null}

      <section className="mm-admin-subscriptions__stats">
        <div className="mm-admin-subscriptions__stat">
          <strong>{stats.active || 0}</strong>
          <span>Active</span>
        </div>
        <div className="mm-admin-subscriptions__stat warn">
          <strong>{stats.expiring_soon || 0}</strong>
          <span>Expiring soon</span>
        </div>
        <div className="mm-admin-subscriptions__stat">
          <strong>{stats.pending || 0}</strong>
          <span>Pending</span>
        </div>
        <div className="mm-admin-subscriptions__stat danger">
          <strong>{stats.failed || 0}</strong>
          <span>Failed</span>
        </div>
        <div className="mm-admin-subscriptions__stat">
          <strong>{revenueLabel}</strong>
          <span>Collected revenue</span>
        </div>
      </section>

      <section className="mm-admin-subscriptions__filters">
        <div className="mm-admin-subscriptions__tabs">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              className={statusFilter === status ? "is-active" : ""}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
        <label className="mm-admin-subscriptions__toggle">
          <input type="checkbox" checked={onlyExpiring} onChange={(e) => setOnlyExpiring(e.target.checked)} />
          <span>Only expiring within 7 days</span>
        </label>
      </section>

      <div className="mm-admin-subscriptions__table-wrap">
        <table className="mm-admin-subscriptions__table">
          <thead>
            <tr>
              <th>Restaurant</th>
              <th>Owner</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Ends</th>
              <th>Days left</th>
              <th>Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="8" className="mm-admin-subscriptions__empty">
                  No subscriptions match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.restaurant_name}</strong>
                    <div className="muted">{row.restaurant_active ? "Restaurant active" : "Restaurant locked"}</div>
                  </td>
                  <td>
                    <strong>{row.owner_name}</strong>
                    <div className="muted">{row.owner_email}</div>
                  </td>
                  <td>
                    <strong>{row.plan_name}</strong>
                    <div className="muted">Rs. {Number(row.plan_price || 0).toFixed(2)}</div>
                  </td>
                  <td>
                    <span className={`status-chip is-${row.status}`}>{row.status.replaceAll("_", " ")}</span>
                    {row.expiring_soon ? <div className="muted danger-text">Ending soon</div> : null}
                  </td>
                  <td>{formatDate(row.ends_at)}</td>
                  <td>{row.days_remaining ?? "—"}</td>
                  <td>
                    <strong>{row.latest_payment?.status || "—"}</strong>
                    <div className="muted">
                      {row.latest_payment?.amount ? `Rs. ${Number(row.latest_payment.amount).toFixed(2)}` : "No payment"}
                    </div>
                  </td>
                  <td>
                    <div className="mm-admin-subscriptions__actions">
                      <button
                        type="button"
                        disabled={busyKey === `${row.id}:active:0`}
                        onClick={() => patchSubscription(row.id, { status: "active" })}
                      >
                        {busyKey === `${row.id}:active:0` ? "…" : "Activate"}
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === `${row.id}:active:30`}
                        onClick={() => patchSubscription(row.id, { status: "active", extend_days: 30 })}
                      >
                        {busyKey === `${row.id}:active:30` ? "…" : "+30d"}
                      </button>
                      <button
                        type="button"
                        className="warn"
                        disabled={busyKey === `${row.id}:expired:0`}
                        onClick={() => patchSubscription(row.id, { status: "expired" })}
                      >
                        {busyKey === `${row.id}:expired:0` ? "…" : "Expire"}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={busyKey === `${row.id}:cancelled:0`}
                        onClick={() => patchSubscription(row.id, { status: "cancelled" })}
                      >
                        {busyKey === `${row.id}:cancelled:0` ? "…" : "Cancel"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
