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
import { Banknote, ShoppingCart, Receipt, Users, ArrowUpRight, ArrowDownRight, MessageSquare, Star } from "lucide-react";

import notificationSound from "../../../assets/notification.mp3";
import { authFetch, API_BASE } from "../../../lib/api";

const OCCUPANCY_COLORS = ["#A1BDAB", "#F0F4F1"];
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop";

const StatChange = ({ value }) => {
  if (value === undefined || value === null) return null;
  const isPositive = value >= 0;
  return (
    <span className={`stat-change ${isPositive ? "positive" : "negative"}`}>
      {isPositive ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {Math.abs(value).toFixed(1)}%
    </span>
  );
};


export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [chartRange, setChartRange] = useState("month");

  const fetchDashboard = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/dashboard/?range=${chartRange}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || json?.detail || "Could not load dashboard.");
        setData(null);
        return;
      }
      setData(json);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Network error while loading dashboard.");
      setData(null);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, [chartRange]);

  if (error) {
    return (
      <div className="dashboard">
        <div className="widget">
          <div className="widget-header">
            <h2 className="widget-title">Dashboard unavailable</h2>
          </div>
          <p style={{ margin: 0, color: "#7c2d12", fontWeight: 600 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return <p>Loading dashboard...</p>;

  // Use real data where possible, with fallbacks/calculations for the new design metrics
  const totalRevenue = data.revenue;
  const avgOrderValue = data.avg_order_value || 0;
  const reviews = data.reviews || {
    count: 0,
    average_overall: null,
    average_food: null,
    average_service: null,
    recent: [],
  };
  
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
          <StatChange value={data.revenue_change} />
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Total Orders</h3>
            <ShoppingCart className="stat-icon" size={32} />
          </div>
          <p className="value">{data.today_orders}</p>
          <StatChange value={data.orders_change} />
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Avg. Order Value</h3>
            <Receipt className="stat-icon" size={32} />
          </div>
          <p className="value">Rs. {avgOrderValue.toFixed(2)}</p>
          <StatChange value={data.aov_change} />
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>New Customers</h3>
            <Users className="stat-icon" size={32} />
          </div>
          <p className="value">{data.new_customers || 0}</p>
          <StatChange value={data.customers_change} />
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
            <select className="select-dropdown" value={chartRange} onChange={e => setChartRange(e.target.value)}>
              <option value="month">Last 30 Days</option>
              <option value="week">This Week</option>
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

      <div className="reviews-grid">
        <div className="widget">
          <div className="widget-header">
            <h2 className="widget-title">Customer Feedback</h2>
          </div>
          <div className="review-metrics">
            <div className="review-metric-card">
              <Star className="review-metric-icon" size={18} />
              <div>
                <span>Overall rating</span>
                <strong>{reviews.average_overall ? Number(reviews.average_overall).toFixed(1) : "—"}</strong>
              </div>
            </div>
            <div className="review-metric-card">
              <MessageSquare className="review-metric-icon" size={18} />
              <div>
                <span>Total reviews</span>
                <strong>{reviews.count || 0}</strong>
              </div>
            </div>
            <div className="review-metric-card">
              <Star className="review-metric-icon" size={18} />
              <div>
                <span>Food quality</span>
                <strong>{reviews.average_food ? Number(reviews.average_food).toFixed(1) : "—"}</strong>
              </div>
            </div>
            <div className="review-metric-card">
              <Star className="review-metric-icon" size={18} />
              <div>
                <span>Service</span>
                <strong>{reviews.average_service ? Number(reviews.average_service).toFixed(1) : "—"}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="widget">
          <div className="widget-header">
            <h2 className="widget-title">Recent Reviews</h2>
          </div>
          {reviews.recent?.length ? (
            <div className="review-feed">
              {reviews.recent.map((review) => (
                <article key={review.id} className="review-card">
                  <div className="review-card-head">
                    <div>
                      <h3>{review.customer_name || `Order #${review.order_id}`}</h3>
                      <p>Order #{review.order_id}</p>
                    </div>
                    <strong>{Number(review.overall_experience || 0).toFixed(1)} / 5</strong>
                  </div>
                  <p className="review-card-breakdown">
                    Food {review.food_quality}/5 · Service {review.service}/5 · Overall {review.overall_experience}/5
                  </p>
                  <p className="review-card-comment">
                    {review.comment?.trim() || "No written comment, but the customer still left a rating."}
                  </p>
                  <span className="review-card-date">
                    {new Date(review.created_at).toLocaleString()}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="review-empty">Reviews from customers will appear here after served orders are rated.</p>
          )}
        </div>
      </div>

    </div>
  );
}
