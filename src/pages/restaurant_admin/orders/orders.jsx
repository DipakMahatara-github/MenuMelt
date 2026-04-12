import { useEffect, useMemo, useState } from "react";
import "./orders.css";
import { authFetch, API_BASE } from "../../../lib/api";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState(null);

  const fetchOrders = async () => {
    try {
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await authFetch(`${API_BASE}/api/orders/${q}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [statusFilter]);

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

  const stats = useMemo(() => {
    const total = orders.length;
    const awaitingRelease = orders.filter(
      (o) => !o.confirmed_for_kitchen && o.status === "pending"
    ).length;
    const pending = orders.filter((o) => o.status === "pending").length;
    const preparing = orders.filter((o) => o.status === "preparing").length;
    const served = orders.filter((o) => o.status === "served").length;
    return { total, awaitingRelease, pending, preparing, served };
  }, [orders]);

  return (
    <div className="orders-page mm-orders-pro">
      <header className="mm-orders-pro__head">
        <div>
          <p className="mm-orders-pro__eyebrow">Operations</p>
          <h1 className="page-title">Orders</h1>
          <p className="mm-orders-pro__sub">Release orders to the kitchen after you verify payment or service.</p>
        </div>
        <label className="mm-orders-pro__filter">
          <span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="served">Served</option>
          </select>
        </label>
      </header>

      <div className="stats mm-orders-stats">
        <div className="stat-card">
          <h2>{stats.total}</h2>
          <p>Total</p>
        </div>
        <div className="stat-card stat-card--alert">
          <h2>{stats.awaitingRelease}</h2>
          <p>Awaiting kitchen release</p>
        </div>
        <div className="stat-card pending">
          <h2>{stats.pending}</h2>
          <p>Pending</p>
        </div>
        <div className="stat-card pending">
          <h2>{stats.preparing}</h2>
          <p>Preparing</p>
        </div>
        <div className="stat-card completed">
          <h2>{stats.served}</h2>
          <p>Served</p>
        </div>
      </div>

      <div className="orders-grid">
        {orders.map((order) => (
          <div key={order.id} className={`order-card ${order.status}`}>
            <div className="order-head">
              <h3>Order #{order.id}</h3>
              <span className="badge">{order.status}</span>
            </div>
            {!order.confirmed_for_kitchen ? (
              <div className="mm-orders-chip mm-orders-chip--warn">Not sent to kitchen</div>
            ) : (
              <div className="mm-orders-chip mm-orders-chip--ok">Kitchen queue</div>
            )}

            <div className="meta">
              <p>Table {order.table_number}</p>
              <p>{order.customer_name}</p>
              <p>
                Payment: {order.payment_status} {order.payment_method ? `· ${order.payment_method}` : ""}
              </p>
              <p>Rs. {Number(order.total_price).toFixed(2)}</p>
              <p>{new Date(order.created_at).toLocaleTimeString()}</p>
            </div>

            <div className="items">
              {order.items.map((item, i) => (
                <div key={i} className="item">
                  <span>{item.item_name}</span>
                  <span>
                    x{item.quantity} @ Rs. {Number(item.price).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="actions">
              {!order.confirmed_for_kitchen && order.status === "pending" && (
                <button
                  type="button"
                  className="btn accept"
                  disabled={busyId === order.id}
                  onClick={() => confirmKitchen(order.id)}
                >
                  {busyId === order.id ? "Sending…" : "Send to kitchen"}
                </button>
              )}

              {order.confirmed_for_kitchen && order.status === "preparing" && (
                <button
                  type="button"
                  className="btn done"
                  disabled={busyId === order.id}
                  onClick={() => updateStatus(order.id, "served")}
                >
                  Mark served
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
