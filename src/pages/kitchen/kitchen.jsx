import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./kitchen.css";
import { authFetch, API_BASE } from "../../lib/api";
import { clearAuth, getRestaurantName } from "../../lib/auth";
import { SERVICE_STATUS_LABELS, subscribeToOrderStream, upsertOrder } from "../../lib/orderLive";

export default function Kitchen() {
  const navigate = useNavigate();
  const restaurantName = getRestaurantName();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [liveState, setLiveState] = useState("connecting");

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
    const unsubscribe = subscribeToOrderStream({
      audience: "staff",
      onStateChange: setLiveState,
      onEvent: (event) => {
        const incoming = event?.staff_order;
        if (!incoming) return;
        setOrders((current) => upsertOrder(current, incoming));
      },
    });
    return unsubscribe;
  }, [fetchOrders]);

  const { preparingOrders, readyOrders, servedOrders } = useMemo(() => {
    const preparing = orders.filter((o) => o.status === "preparing");
    const ready = orders.filter((o) => o.status === "ready");
    const served = orders.filter((o) => o.status === "served");
    return { preparingOrders: preparing, readyOrders: ready, servedOrders: served };
  }, [orders]);

  const markReady = async (id) => {
    setBusyId(id);
    try {
      const res = await authFetch(`${API_BASE}/api/orders/${id}/status/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ready" }),
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
          {restaurantName ? <p className="mm-ops-restaurant">{restaurantName}</p> : null}
          <p className="mm-ops-sub">Only orders released by waiters or admins appear here.</p>
          <p className={`mm-ops-live mm-ops-live--${liveState}`}>Live feed: {liveState}</p>
        </div>
        <div className="mm-kitchen-top-meta">
          <span className="mm-kitchen-pill">{preparingOrders.length + readyOrders.length} active</span>
          <button type="button" className="mm-ops-logout" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {error ? <div className="mm-ops-alert">{error}</div> : null}

      <section className="mm-kitchen-section">
        <h2 className="mm-kitchen-h2">Preparing</h2>
        <div className="mm-kitchen-grid">
          {preparingOrders.length === 0 ? (
            <p className="mm-kitchen-empty">No tickets. Waiters or admins must send orders from the floor console.</p>
          ) : (
            preparingOrders.map((order) => (
              <article key={order.id} className={`mm-kitchen-card mm-kitchen-card--${order.status}`}>
                <header className="mm-kitchen-card__head">
                  <div>
                    <span className="mm-kitchen-table">Table {order.table_number}</span>
                    <h3>#{order.id}</h3>
                  </div>
                  <span className="mm-kitchen-status">{SERVICE_STATUS_LABELS[order.status] || order.status}</span>
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
                    onClick={() => markReady(order.id)}
                  >
                    {busyId === order.id ? "Saving…" : "Mark ready"}
                  </button>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mm-kitchen-section">
        <h2 className="mm-kitchen-h2">Ready for service</h2>
        <div className="mm-kitchen-grid">
          {readyOrders.length === 0 ? (
            <p className="mm-kitchen-empty">Nothing is waiting for pickup right now.</p>
          ) : (
            readyOrders.map((order) => (
              <article key={order.id} className="mm-kitchen-card mm-kitchen-card--ready">
                <header className="mm-kitchen-card__head">
                  <div>
                    <span className="mm-kitchen-table">Table {order.table_number}</span>
                    <h3>#{order.id}</h3>
                  </div>
                  <span className="mm-kitchen-status">{SERVICE_STATUS_LABELS.ready}</span>
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
                <p className="mm-kitchen-note">Waiting for waiter or floor staff to serve this order.</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mm-kitchen-section mm-kitchen-section--done">
        <h2 className="mm-kitchen-h2">Served</h2>
        <div className="mm-kitchen-grid">
          {servedOrders.length === 0 ? (
            <p className="mm-kitchen-empty">No served tickets yet.</p>
          ) : (
            servedOrders.map((order) => (
              <article key={order.id} className="mm-kitchen-card mm-kitchen-card--served">
                <header className="mm-kitchen-card__head">
                  <div>
                    <span className="mm-kitchen-table">Table {order.table_number}</span>
                    <h3>#{order.id}</h3>
                  </div>
                  <span className="mm-kitchen-status">{SERVICE_STATUS_LABELS.served}</span>
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
