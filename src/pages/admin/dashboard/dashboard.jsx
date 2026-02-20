import "./dashboard.css";

export default function Dashboard() {
  return (
    <>
      {/* ===== STATS ===== */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Today Orders</h3>
          <p>24</p>
        </div>

        <div className="stat-card">
          <h3>Active Tables</h3>
          <p>12</p>
        </div>

        <div className="stat-card">
          <h3>Total Revenue</h3>
          <p>Rs. 18,500</p>
        </div>

        <div className="stat-card">
          <h3>Pending Orders</h3>
          <p>5</p>
        </div>
      </div>

      {/* ===== LOWER GRID ===== */}
      <div className="dashboard-grid">

        {/* ORDERS TABLE */}
        <div className="section">
          <h2>Recent Orders</h2>

          <table className="orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Table</th>
                <th>Items</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>#1023</td>
                <td>Table 4</td>
                <td>Burger, Coke</td>
                <td><span className="status pending">Pending</span></td>
                <td>Rs. 650</td>
              </tr>

              <tr>
                <td>#1022</td>
                <td>Table 2</td>
                <td>Pizza</td>
                <td><span className="status completed">Completed</span></td>
                <td>Rs. 900</td>
              </tr>

              <tr>
                <td>#1021</td>
                <td>Table 1</td>
                <td>Momo, Tea</td>
                <td><span className="status completed">Completed</span></td>
                <td>Rs. 350</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ACTIVITY PANEL */}
        <div className="section">
          <h2>Live Activity</h2>

          <div className="activity-list">

            <div className="activity-item">
              <p>New Order #1024</p>
              <span>2 min ago</span>
            </div>

            <div className="activity-item">
              <p>Table 3 Paid Bill</p>
              <span>10 min ago</span>
            </div>

            <div className="activity-item">
              <p>Menu Updated</p>
              <span>30 min ago</span>
            </div>

            <div className="activity-item">
              <p>Kitchen Completed #1022</p>
              <span>1 hr ago</span>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
