import { useEffect, useState } from "react";
import "./kitchen.css";

export default function Kitchen() {

  const [orders, setOrders] = useState([]);

  // 🔥 FETCH ORDERS
  const fetchOrders = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/orders/");
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, []);

  // ✅ MARK ORDER COMPLETED
  const markCompleted = async (id) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/orders/${id}/status/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "completed"
        })
      });

      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ SAFE TIMER
  const getTime = (created_at) => {
    if (!created_at) return "0m";

    const created = new Date(created_at);
    if (isNaN(created.getTime())) return "0m";

    const diff = Math.floor((Date.now() - created.getTime()) / 1000);

    const min = Math.floor(diff / 60);
    const sec = diff % 60;

    return `${min}m ${sec}s`;
  };

  // 🔥 SPLIT ORDERS
  const activeOrders = orders.filter(o => o.status !== "completed");
  const completedOrders = orders.filter(o => o.status === "completed");

  return (
    <div className="kitchen">

      {/* HEADER */}
      <div className="kitchen-header">
        <h1>🍳 Kitchen Live</h1>
        <span>{activeOrders.length} Active Orders</span>
      </div>

      {/* ================= ACTIVE ================= */}
      <h2 className="section-title"> Active Orders</h2>

      <div className="kitchen-grid">
        {activeOrders.length === 0 ? (
          <p className="empty">No active orders</p>
        ) : (
          activeOrders.map(order => (
            <div key={order.id} className={`order-card ${order.status}`}>

              {/* TOP */}
              <div className="order-top">
                <h2>Table {order.table}</h2>
                <span className="timer">
                  ⏱ {getTime(order.created_at)}
                </span>
              </div>

              {/* ITEMS */}
              <div className="order-items">
                {order.items?.map((item, index) => (
                  <div key={index} className="item-row">
                    <span className="item-name">
                      {item.item_name}
                    </span>
                    <span className="qty">
                      x{item.quantity}
                    </span>
                  </div>
                ))}
              </div>

              {/* ACTION */}
              <button
                className="complete-btn"
                onClick={() => markCompleted(order.id)}
              >
                ✔ Mark Ready
              </button>

            </div>
          ))
        )}
      </div>

      {/* ================= COMPLETED ================= */}
      <h2 className="section-title completed-title"> Completed Orders</h2>

      <div className="kitchen-grid">
        {completedOrders.length === 0 ? (
          <p className="empty">No completed orders</p>
        ) : (
          completedOrders.map(order => (
            <div key={order.id} className="order-card completed">

              <div className="order-top">
                <h2>Table {order.table}</h2>
                <span className="timer">
                  ⏱ {getTime(order.created_at)}
                </span>
              </div>

              <div className="order-items">
                {order.items?.map((item, index) => (
                  <div key={index} className="item-row">
                    <span>{item.item_name}</span>
                    <span>x{item.quantity}</span>
                  </div>
                ))}
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
}