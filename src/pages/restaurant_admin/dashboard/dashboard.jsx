import { useEffect, useState } from "react";
import "./dashboard.css";

// 📊 CHART
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

// 🔔 SOUND
import notificationSound from "../../../assets/notification.mp3";

export default function Dashboard() {

  const [data, setData] = useState(null);
  const [lastOrderCount, setLastOrderCount] = useState(0);

  const fetchDashboard = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/dashboard/");
      const json = await res.json();

      // 🔔 SOUND ALERT
      if (json.recent_orders.length > lastOrderCount) {
        const audio = new Audio(notificationSound);
        audio.play();
      }

      setLastOrderCount(json.recent_orders.length);
      setData(json);

    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboard();

    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return <p>Loading dashboard...</p>;

  return (
    <div className="dashboard">

      {/* ===== STATS ===== */}
      <div className="stats-grid">

        <div className="stat-card">
          <h3>Today Orders</h3>
          <p>{data.today_orders}</p>
        </div>

        <div className="stat-card">
          <h3>Active Tables</h3>
          <p>{data.active_tables}</p>
        </div>

        <div className="stat-card">
          <h3>Total Revenue</h3>
          <p>Rs. {data.revenue}</p>
        </div>

        <div className="stat-card">
          <h3>Pending Orders</h3>
          <p>{data.pending_orders}</p>
        </div>

      </div>

      {/* ===== CHART ===== */}
      <div className="chart-section">
        <h2>Revenue Overview</h2>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.chart_data}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#2563eb"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ===== LOWER GRID ===== */}
      <div className="dashboard-grid">

        {/* ORDERS */}
        <div className="section">
          <h2>Recent Orders</h2>

          <table className="orders-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Table</th>
                <th>Items</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {data.recent_orders.map(order => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{order.table}</td>
                  <td>{order.items}</td>
                  <td>
                    <span className={`status ${order.status}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>Rs. {order.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ACTIVITY */}
        <div className="section">
          <h2>Live Activity</h2>

          <div className="activity-list">
            {data.recent_orders.map(order => (
              <div key={order.id} className="activity-item">
                <p>Order #{order.id} - {order.status}</p>
                <span>Just now</span>
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
}