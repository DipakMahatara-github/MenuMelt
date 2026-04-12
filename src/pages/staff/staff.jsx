import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./staff.css";
import { authFetch, API_BASE } from "../../lib/api";
import { clearAuth } from "../../lib/auth";

export default function Staff() {
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

  const { awaiting, inKitchen } = useMemo(() => {
    const awaitingList = orders.filter((o) => !o.confirmed_for_kitchen);
    const inKitchenList = orders.filter((o) => o.confirmed_for_kitchen);
    return { awaiting: awaitingList, inKitchen: inKitchenList };
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
    if (o.payment_method === "esewa") return o.payment_status === "paid" ? "eSewa · paid" : "eSewa · pending";
    if (o.payment_method === "cash") return "Pay at counter";
    return "Payment pending";
  };

  const OrderCard = ({ order, mode }) => (
    <article className="mm-staff-card" key={order.id}>
      <header className="mm-staff-card__head">
        <div>
          <span className="mm-staff-card__table">Table {order.table_number}</span>
          <h3 className="mm-staff-card__title">Order #{order.id}</h3>
        </div>
        <span className={`mm-staff-badge mm-staff-badge--${order.status}`}>{order.status}</span>
      </header>
      <p className="mm-staff-card__who">{order.customer_name}</p>
      <p className="mm-staff-card__pay">{payLabel(order)}</p>
      <p className="mm-staff-card__amt">Rs. {Number(order.total_price).toFixed(2)}</p>
      <ul className="mm-staff-items">
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
          className="mm-staff-btn mm-staff-btn--primary"
          disabled={busyId === order.id}
          onClick={() => confirmForKitchen(order.id)}
        >
          {busyId === order.id ? "Sending…" : "Send to kitchen"}
        </button>
      ) : (
        <div className="mm-staff-card__actions">
          {order.status === "preparing" && (
            <button
              type="button"
              className="mm-staff-btn mm-staff-btn--ghost"
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
    <div className="mm-ops mm-staff">
      <header className="mm-ops-top">
        <div>
          <p className="mm-ops-eyebrow">Floor</p>
          <h1 className="mm-ops-title">Staff console</h1>
          <p className="mm-ops-sub">Confirm new orders before the kitchen sees them.</p>
        </div>
        <button type="button" className="mm-ops-logout" onClick={logout}>
          Log out
        </button>
      </header>

      {error ? <div className="mm-ops-alert">{error}</div> : null}

      <section className="mm-staff-section">
        <div className="mm-staff-section__head">
          <h2>Awaiting your confirmation</h2>
          <span className="mm-staff-count">{awaiting.length}</span>
        </div>
        {awaiting.length === 0 ? (
          <p className="mm-staff-empty">No new orders right now.</p>
        ) : (
          <div className="mm-staff-grid">
            {awaiting.map((o) => (
              <OrderCard key={o.id} order={o} mode="await" />
            ))}
          </div>
        )}
      </section>

      <section className="mm-staff-section mm-staff-section--dim">
        <div className="mm-staff-section__head">
          <h2>In service · kitchen queue</h2>
          <span className="mm-staff-count">{inKitchen.length}</span>
        </div>
        {inKitchen.length === 0 ? (
          <p className="mm-staff-empty">Nothing sent to the kitchen yet.</p>
        ) : (
          <div className="mm-staff-grid">
            {inKitchen.map((o) => (
              <OrderCard key={o.id} order={o} mode="floor" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
