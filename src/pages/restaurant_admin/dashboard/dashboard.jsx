import { useEffect, useState } from "react";
import "./dashboard.css";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Banknote, ShoppingCart, Receipt, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";

import notificationSound from "../../../assets/notification.mp3";
import { authFetch, API_BASE } from "../../../lib/api";

const OCCUPANCY_COLORS = ["#A1BDAB", "#F0F4F1"];
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [lastOrderCount, setLastOrderCount] = useState(0);

  const fetchDashboard = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/dashboard/`);
      const json = await res.json();

      if (json.recent_orders?.length > lastOrderCount) {
        const audio = new Audio(notificationSound);
        audio.play().catch(() => {});
      }

      setLastOrderCount(json.recent_orders?.length || 0);
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

  // Use real data where possible, with fallbacks/calculations for the new design metrics
  const totalRevenue = data.revenue;
  const avgOrderValue = data.avg_order_value || 0;
  
  const occupancyData = [
    { name: "Occupied", value: data.table_occupancy?.occupied || 0 },
    { name: "Empty", value: data.table_occupancy?.empty || 0 }
  ];
  
  const totalTables = (data.table_occupancy?.occupied || 0) + (data.table_occupancy?.empty || 0);

  const formatYAxis = (val) => {
    if (val === 0) return "Rs. 0";
    if (val >= 100000) return `Rs ${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `Rs ${(val / 1000).toFixed(1)}k`;
    return `Rs ${val}`;
  };

  return (
    <div className="dashboard">

      {/* ===== STATS ROW ===== */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Total Revenue</h3>
            <Banknote className="stat-icon" size={32} />
          </div>
          <p className="value">Rs. {totalRevenue.toLocaleString()}</p>
          <span className="stat-change positive"><ArrowUpRight size={14}/> 12.5%</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Total Orders</h3>
            <ShoppingCart className="stat-icon" size={32} />
          </div>
          <p className="value">{data.today_orders}</p>
          <span className="stat-change negative"><ArrowDownRight size={14}/> 2.8%</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Avg. Order Value</h3>
            <Receipt className="stat-icon" size={32} />
          </div>
          <p className="value">Rs. {avgOrderValue.toFixed(2)}</p>
          <span className="stat-change positive"><ArrowUpRight size={14}/> 8.1%</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>New Customers</h3>
            <Users className="stat-icon" size={32} />
          </div>
          <p className="value">{data.new_customers || 0}</p>
          <span className="stat-change positive"><ArrowUpRight size={14}/> 14.2%</span>
        </div>
      </div>

      {/* ===== MIDDLE ROW ===== */}
      <div className="middle-grid">
        <div className="widget">
          <div className="widget-header">
            <div>
              <h2 className="widget-title">Sales Overview</h2>
              <span className="subtitle">revenue vs days</span>
            </div>
            <select className="select-dropdown">
              <option>Last 30 Days</option>
              <option>This Week</option>
            </select>
          </div>
          
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.chart_data || []}>
              <defs>
                <linearGradient id="colorReveu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A1BDAB" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#A1BDAB" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{fontSize: 12, fill: '#57735D'}} tickLine={false} axisLine={false} />
              <YAxis tick={{fontSize: 12, fill: '#57735D'}} tickLine={false} axisLine={false} width={80} tickFormatter={formatYAxis} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="revenue" stroke="#3C6647" strokeWidth={3} fillOpacity={1} fill="url(#colorReveu)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="widget">
          <div className="widget-header">
            <h2 className="widget-title">Recent Orders</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Table</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders?.slice(0, 5).map(order => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.table}</td>
                    <td>{order.items}</td>
                    <td>Rs. {order.amount}</td>
                    <td>
                      <span className={`status ${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM ROW ===== */}
      <div className="bottom-grid">
        <div className="widget">
          <div className="widget-header">
            <h2 className="widget-title">Popular Items</h2>
          </div>
          <div className="popular-grid">
            {data.popular_items?.map(item => (
              <div key={item.id} className="popular-card">
                <img src={item.image ? `${API_BASE}${item.image}` : FALLBACK_IMAGE} alt={item.name} />
                <div className="popular-info">
                  <h4>{item.name}</h4>
                  <p>Rs. {item.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="widget">
          <div className="widget-header">
            <h2 className="widget-title">Today's Table Occupancy</h2>
          </div>
          <div className="occupancy-wrapper">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={occupancyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  {occupancyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={OCCUPANCY_COLORS[index % OCCUPANCY_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="occupancy-text">
              {data.table_occupancy?.occupied || 0}/{totalTables}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}