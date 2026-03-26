import { useEffect, useState } from "react";
import "./orders.css";

export default function Orders() {

  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/orders/");
      const data = await res.json();
      setOrders(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 stats
  const total = orders.length;
  const pending = orders.filter(o => o.status === "pending").length;
  const completed = orders.filter(o => o.status === "completed").length;

  return (
    <div className="orders-page">

      <h1 className="page-title">Orders Dashboard</h1>

      {/* 🔥 STATS */}
      <div className="stats">
        <div className="stat-card">
          <h2>{total}</h2>
          <p>Total Orders</p>
        </div>

        <div className="stat-card pending">
          <h2>{pending}</h2>
          <p>Pending</p>
        </div>

        <div className="stat-card completed">
          <h2>{completed}</h2>
          <p>Completed</p>
        </div>
      </div>

      {/* 🔥 ORDERS */}
      <div className="orders-grid">

        {orders.map(order => (
          <div key={order.id} className={`order-card ${order.status}`}>

            <div className="order-head">
              <h3>Order #{order.id}</h3>
              <span className="badge">{order.status}</span>
            </div>

            <div className="meta">
              <p>🍽 Table {order.table}</p>
              <p>🕒 {new Date(order.created_at).toLocaleTimeString()}</p>
            </div>

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
              <button className="btn accept">Accept</button>
              <button className="btn done">Complete</button>
            </div>

          </div>
        ))}

      </div>
    </div>
  );
}