import "./dashboard.css";

export default function Dashboard() {
  return (
    <div className="admin-container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2 className="brand">QR Dine</h2>

        <ul className="menu">
          <li className="active">Dashboard</li>
          <li>Orders</li>
          <li>Menu</li>
          <li>Tables</li>
          <li>Kitchen</li>
          <li>Reports</li>
          <li>Settings</li>
        </ul>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {/* HEADER */}
        <div className="top-bar">
          <h1>Admin Dashboard</h1>
          <div className="admin-profile">Owner</div>
        </div>

        {/* STATS */}
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

        {/* RECENT ORDERS */}
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
                <td className="pending">Pending</td>
                <td>Rs. 650</td>
              </tr>

              <tr>
                <td>#1022</td>
                <td>Table 2</td>
                <td>Pizza</td>
                <td className="completed">Completed</td>
                <td>Rs. 900</td>
              </tr>

              <tr>
                <td>#1021</td>
                <td>Table 1</td>
                <td>Momo, Tea</td>
                <td className="completed">Completed</td>
                <td>Rs. 350</td>
              </tr>

              <tr>
                <td>#1020</td>
                <td>Table 6</td>
                <td>Chowmein</td>
                <td className="pending">Pending</td>
                <td>Rs. 250</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
