import { useEffect, useState } from "react";
import "./staff.css";

export default function Staff() {

  const [orders, setOrders] = useState([]);

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

    const interval = setInterval(fetchOrders, 3000); // auto refresh
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/orders/${id}/status/`, {
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
    <div className="staff-container">

      <div className="staff-header">
        <h1> Staff Dashboard</h1>
        <p>Manage incoming orders in real-time</p>
      </div>

      <div className="orders-grid">

        {orders.map(order => (
          <div key={order.id} className="order-card">

            <div className="order-top">
              <h2>Table {order.table}</h2>
              <span className={`status ${order.status}`}>
                {order.status}
              </span>
            </div>

            <div className="order-items">
              {order.items.map((item, index) => (
                <div key={index} className="item-row">
                  <span>{item.item_name}</span>
                  <span>x{item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="order-actions">

              {order.status === "pending" && (
                <button
                  className="btn accept"
                  onClick={() => updateStatus(order.id, "accepted")}
                >
                  Accept
                </button>
              )}

              {order.status === "accepted" && (
                <button
                  className="btn prepare"
                  onClick={() => updateStatus(order.id, "preparing")}
                >
                  Send to Kitchen
                </button>
              )}

              {order.status === "preparing" && (
                <button
                  className="btn done"
                  onClick={() => updateStatus(order.id, "done")}
                >
                  Mark Ready
                </button>
              )}

            </div>

          </div>
        ))}

      </div>

    </div>
  );
}