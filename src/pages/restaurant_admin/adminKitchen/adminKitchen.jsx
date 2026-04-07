import { useEffect, useState } from "react";
import "./adminKitchen.css";
import { authFetch, API_BASE } from "../../../lib/api";

export default function AdminKitchen() {

  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("active"); // active | completed | all
  const [loading, setLoading] = useState(true);

  // 🔥 FETCH ORDERS
  const fetchOrders = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/orders/`);
      const data = await res.json();

      setOrders(data);
      setLoading(false);

    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 FILTER LOGIC
  const filteredOrders =
    filter === "all"
      ? orders
      : filter === "completed"
      ? orders.filter(o => o.status === "completed")
      : orders.filter(o => o.status !== "completed");

  // 🔥 UPDATE STATUS
  const updateStatus = async (id, status) => {
    try {
      await authFetch(`${API_BASE}/api/orders/${id}/status/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="admin-kitchen">

      <h1 className="title">Kitchen Monitor (Admin)</h1>

      {/* 🔥 FILTER BUTTONS */}
      <div className="filters">
        <button
          className={filter === "active" ? "active" : ""}
          onClick={() => setFilter("active")}
        >
          Active
        </button>

        <button
          className={filter === "completed" ? "active" : ""}
          onClick={() => setFilter("completed")}
        >
          Completed
        </button>

        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All
        </button>
      </div>

      {/* 🔥 LOADING */}
      {loading && <p className="loading">Loading orders...</p>}

      {/* 🔥 EMPTY STATE */}
      {!loading && filteredOrders.length === 0 && (
        <p className="empty">No orders found</p>
      )}

      {/* 🔥 ORDERS GRID */}
      <div className="kitchen-grid">

        {filteredOrders.map(order => (
          <div key={order.id} className={`kitchen-card ${order.status}`}>

            <div className="top">
              <h2>Table {order.table}</h2>
              <span className={`status ${order.status}`}>
                {order.status}
              </span>
            </div>

            <p className="time">
              {new Date(order.created_at).toLocaleTimeString()}
            </p>

            <div className="items">
              {order.items.map((item, i) => (
                <div key={i} className="item">
                  <span>{item.item_name}</span>
                  <span>x{item.quantity}</span>
                </div>
              ))}
            </div>

            {/* 🔥 ACTION BUTTONS */}
            <div className="actions">

              {order.status === "pending" && (
                <button
                  className="btn accept"
                  onClick={() => updateStatus(order.id, "processing")}
                >
                  Accept
                </button>
              )}

              {order.status !== "completed" && (
                <button
                  className="btn complete"
                  onClick={() => updateStatus(order.id, "completed")}
                >
                  Complete
                </button>
              )}

            </div>

          </div>
        ))}

      </div>

    </div>
  );
}