import { useCallback, useEffect, useMemo, useState } from "react";
import "./adminKitchen.css";
import { authFetch, API_BASE } from "../../../lib/api";

export default function AdminKitchen() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/orders/`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    if (filter === "all") return orders;
    if (filter === "served") return orders.filter((o) => o.status === "served");
    return orders.filter((o) => o.status !== "served");
  }, [orders, filter]);

  const confirmKitchen = async (id) => {
    setBusyId(id);
    try {
      await authFetch(`${API_BASE}/api/orders/${id}/confirm-kitchen/`, { method: "POST" });
      fetchOrders();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const updateStatus = async (id, next) => {
    setBusyId(id);
    try {
      await authFetch(`${API_BASE}/api/orders/${id}/status/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      fetchOrders();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mm-adm-kitchen">
      <header className="mm-adm-kitchen__head">
        <div>
          <p className="mm-adm-kitchen__eyebrow">Monitor</p>
          <h1 className="mm-adm-kitchen__title">Kitchen board</h1>
          <p className="mm-adm-kitchen__sub">Same data as floor staff — unreleased tickets stay off the line.</p>
        </div>
        <div className="mm-adm-kitchen__filters">
          {["active", "served", "all"].map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? "is-on" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "active" ? "Active" : f === "served" ? "Served" : "All"}
            </button>
          ))}
        </div>
      </header>

      {loading && <p className="mm-adm-kitchen__muted">Loading…</p>}
      {!loading && filteredOrders.length === 0 && (
        <p className="mm-adm-kitchen__muted">No orders in this view.</p>
      )}

      <div className="mm-adm-kitchen__grid">
        {filteredOrders.map((order) => (
          <article key={order.id} className={`mm-adm-kitchen__card mm-adm-kitchen__card--${order.status}`}>
            <div className="mm-adm-kitchen__top">
              <div>
                <span className="mm-adm-kitchen__table">Table {order.table_number}</span>
                <h2>#{order.id}</h2>
              </div>
              <span className="mm-adm-kitchen__badge">{order.status}</span>
            </div>
            {!order.confirmed_for_kitchen ? (
              <p className="mm-adm-kitchen__flag">Awaiting staff release</p>
            ) : null}
            <p className="mm-adm-kitchen__time">{new Date(order.created_at).toLocaleTimeString()}</p>
            <div className="mm-adm-kitchen__items">
              {order.items.map((item, i) => (
                <div key={i} className="mm-adm-kitchen__row">
                  <span>{item.item_name}</span>
                  <span>x{item.quantity}</span>
                </div>
              ))}
            </div>
            <div className="mm-adm-kitchen__actions">
              {!order.confirmed_for_kitchen && order.status === "pending" && (
                <button
                  type="button"
                  className="mm-adm-kitchen__btn mm-adm-kitchen__btn--primary"
                  disabled={busyId === order.id}
                  onClick={() => confirmKitchen(order.id)}
                >
                  {busyId === order.id ? "…" : "Send to kitchen"}
                </button>
              )}
              {order.confirmed_for_kitchen && order.status === "preparing" && (
                <button
                  type="button"
                  className="mm-adm-kitchen__btn mm-adm-kitchen__btn--mint"
                  disabled={busyId === order.id}
                  onClick={() => updateStatus(order.id, "served")}
                >
                  Served
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
