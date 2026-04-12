import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./kitchen.css";
import { authFetch, API_BASE } from "../../lib/api";
import { clearAuth } from "../../lib/auth";

export default function Kitchen() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/orders/`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.error || "Could not load orders.");
        setOrders([]);
        return;
      }
      setError("");
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setError("Network error.");
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const { activeOrders, servedOrders } = useMemo(() => {
    const active = orders.filter((o) => o.status !== "served");
    const served = orders.filter((o) => o.status === "served");
    return { activeOrders: active, servedOrders: served };
  }, [orders]);

  const markServed = async (id) => {
    setBusyId(id);
    try {
      const res = await authFetch(`${API_BASE}/api/orders/${id}/status/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "served" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || data.detail || "Could not update.");
        return;
      }
      setError("");
      fetchOrders();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  };

  const getTime = (created_at) => {
    if (!created_at) return "—";
    const created = new Date(created_at);
    if (Number.isNaN(created.getTime())) return "—";
    const diff = Math.floor((Date.now() - created.getTime()) / 1000);
    const min = Math.floor(diff / 60);
    const sec = diff % 60;
    return `${min}m ${sec}s`;
  };

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <div className="mm-ops mm-kitchen">
      <header className="mm-ops-top">
        <div>
          <p className="mm-ops-eyebrow">Kitchen</p>
          <h1 className="mm-ops-title">Live line</h1>
          <p className="mm-ops-sub">Only orders released by staff appear here.</p>
        </div>
        <div className="mm-kitchen-top-meta">
          <span className="mm-kitchen-pill">{activeOrders.length} active</span>
          <button type="button" className="mm-ops-logout" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {error ? <div className="mm-ops-alert">{error}</div> : null}

      <section className="mm-kitchen-section">
        <h2 className="mm-kitchen-h2">Cooking</h2>
        <div className="mm-kitchen-grid">
          {activeOrders.length === 0 ? (
            <p className="mm-kitchen-empty">No tickets. Staff must send orders from the floor console.</p>
          ) : (
            activeOrders.map((order) => (
              <article key={order.id} className={`mm-kitchen-card mm-kitchen-card--${order.status}`}>
                <header className="mm-kitchen-card__head">
                  <div>
                    <span className="mm-kitchen-table">Table {order.table_number}</span>
                    <h3>#{order.id}</h3>
                  </div>
                  <span className="mm-kitchen-timer">{getTime(order.created_at)}</span>
                </header>
                <ul className="mm-kitchen-items">
                  {order.items?.map((item, index) => (
                    <li key={item.id ?? index}>
                      <span className="mm-kitchen-item-name">{item.item_name}</span>
                      <span className="mm-kitchen-qty">×{item.quantity}</span>
                    </li>
                  ))}
                </ul>
                {order.status === "preparing" && (
                  <button
                    type="button"
                    className="mm-kitchen-done"
                    disabled={busyId === order.id}
                    onClick={() => markServed(order.id)}
                  >
                    {busyId === order.id ? "Saving…" : "Mark served"}
                  </button>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mm-kitchen-section mm-kitchen-section--done">
        <h2 className="mm-kitchen-h2">Completed</h2>
        <div className="mm-kitchen-grid">
          {servedOrders.length === 0 ? (
            <p className="mm-kitchen-empty">No completed tickets yet.</p>
          ) : (
            servedOrders.map((order) => (
              <article key={order.id} className="mm-kitchen-card mm-kitchen-card--served">
                <header className="mm-kitchen-card__head">
                  <div>
                    <span className="mm-kitchen-table">Table {order.table_number}</span>
                    <h3>#{order.id}</h3>
                  </div>
                  <span className="mm-kitchen-timer muted">{getTime(order.created_at)}</span>
                </header>
                <ul className="mm-kitchen-items">
                  {order.items?.map((item, index) => (
                    <li key={item.id ?? index}>
                      <span>{item.item_name}</span>
                      <span>×{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
