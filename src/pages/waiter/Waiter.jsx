import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Waiter.css";
import { authFetch, API_BASE } from "../../lib/api";
import { clearAuth, getRestaurantName, getUserRole } from "../../lib/auth";
import { SERVICE_STATUS_LABELS, subscribeToOrderStream, upsertOrder } from "../../lib/orderLive";

const ROLE_COPY = {
  waiter: {
    eyebrow: "Waiter",
    title: "Waiter console",
    subtitle: "Confirm new orders before the kitchen sees them.",
    emptyAwaiting: "No new orders right now.",
    emptyInKitchen: "Nothing sent to the kitchen yet.",
  },
};

export default function Waiter() {
  const navigate = useNavigate();
  const role = getUserRole();
  const restaurantName = getRestaurantName();
  const copy = ROLE_COPY[role] || ROLE_COPY.waiter;
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [liveState, setLiveState] = useState("connecting");

  const fetchOrders = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/orders/`);
      const data = await res.json().catch(() => ({}));
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

  const { awaiting, preparing, ready } = useMemo(() => {
    const awaitingList = orders.filter((o) => !o.confirmed_for_kitchen);
    const preparingList = orders.filter((o) => o.confirmed_for_kitchen && o.status === "preparing");
    const readyList = orders.filter((o) => o.confirmed_for_kitchen && o.status === "ready");
    return { awaiting: awaitingList, preparing: preparingList, ready: readyList };
  }, [orders]);

  const confirmForKitchen = async (id) => {
    setBusyId(id);
    try {
      const res = await authFetch(`${API_BASE}/api/orders/${id}/confirm-kitchen/`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || data.detail || "Could not confirm.");
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

  const updateStatus = async (id, next) => {
    setBusyId(id);
    try {
      const res = await authFetch(`${API_BASE}/api/orders/${id}/status/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || data.detail || "Update failed.");
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

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  const payLabel = (o) => {
    if (o.payment_method === "khalti") return `Khalti · ${String(o.billing_status).replaceAll("_", " ")}`;
    if (o.payment_method === "cash") return `Cash · ${String(o.billing_status).replaceAll("_", " ")}`;
    return `Billing · ${String(o.billing_status).replaceAll("_", " ")}`;
  };

  const OrderCard = ({ order, mode }) => (
    <article className="mm-waiter-card" key={order.id}>
      <header className="mm-waiter-card__head">
        <div>
          <span className="mm-waiter-card__table">Table {order.table_number}</span>
          <h3 className="mm-waiter-card__title">Order #{order.id}</h3>
        </div>
        <span className={`mm-waiter-badge mm-waiter-badge--${order.status}`}>
          {SERVICE_STATUS_LABELS[order.status] || order.status}
        </span>
      </header>
      <p className="mm-waiter-card__who">{order.customer_name}</p>
      <p className="mm-waiter-card__pay">{payLabel(order)}</p>
      <p className="mm-waiter-card__amt">Rs. {Number(order.total_price).toFixed(2)}</p>
      <ul className="mm-waiter-items">
        {(order.items || []).map((item) => (
          <li key={item.id ?? `${item.menu_item}-${item.quantity}`}>
            <span>{item.item_name}</span>
            <span>×{item.quantity}</span>
          </li>
        ))}
      </ul>
      {mode === "await" ? (
        <button
          type="button"
          className="mm-waiter-btn mm-waiter-btn--primary"
          disabled={busyId === order.id}
          onClick={() => confirmForKitchen(order.id)}
        >
          {busyId === order.id ? "Sending…" : "Send to kitchen"}
        </button>
      ) : (
        <div className="mm-waiter-card__actions">
          {order.status === "ready" && (
            <button
              type="button"
              className="mm-waiter-btn mm-waiter-btn--ghost"
              disabled={busyId === order.id}
              onClick={() => updateStatus(order.id, "served")}
            >
              Mark served
            </button>
          )}
        </div>
      )}
    </article>
  );

  return (
    <div className="mm-ops mm-waiter">
      <header className="mm-ops-top">
        <div>
          <p className="mm-ops-eyebrow">{copy.eyebrow}</p>
          <h1 className="mm-ops-title">{copy.title}</h1>
          {restaurantName ? <p className="mm-ops-restaurant">{restaurantName}</p> : null}
          <p className="mm-ops-sub">{copy.subtitle}</p>
          <p className={`mm-ops-live mm-ops-live--${liveState}`}>Live feed: {liveState}</p>
        </div>
        <button type="button" className="mm-ops-logout" onClick={logout}>
          Log out
        </button>
      </header>

      {error ? <div className="mm-ops-alert">{error}</div> : null}

      <section className="mm-waiter-section">
        <div className="mm-waiter-section__head">
          <h2>Awaiting your confirmation</h2>
          <span className="mm-waiter-count">{awaiting.length}</span>
        </div>
        {awaiting.length === 0 ? (
          <p className="mm-waiter-empty">{copy.emptyAwaiting}</p>
        ) : (
          <div className="mm-waiter-grid">
            {awaiting.map((o) => (
              <OrderCard key={o.id} order={o} mode="await" />
            ))}
          </div>
        )}
      </section>

      <section className="mm-waiter-section mm-waiter-section--dim">
        <div className="mm-waiter-section__head">
          <h2>Kitchen is preparing</h2>
          <span className="mm-waiter-count">{preparing.length}</span>
        </div>
        {preparing.length === 0 ? (
          <p className="mm-waiter-empty">{copy.emptyInKitchen}</p>
        ) : (
          <div className="mm-waiter-grid">
            {preparing.map((o) => (
              <OrderCard key={o.id} order={o} mode="floor" />
            ))}
          </div>
        )}
      </section>

      <section className="mm-waiter-section">
        <div className="mm-waiter-section__head">
          <h2>Ready to serve</h2>
          <span className="mm-waiter-count">{ready.length}</span>
        </div>
        {ready.length === 0 ? (
          <p className="mm-waiter-empty">Kitchen has not marked any orders ready yet.</p>
        ) : (
          <div className="mm-waiter-grid">
            {ready.map((o) => (
              <OrderCard key={o.id} order={o} mode="floor" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
