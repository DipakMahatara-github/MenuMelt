import "./dashboard.css";

export default function Dashboard() {
  return (
    <div className="admin-dashboard">

      {/* HEADER */}
      <div className="dashboard-header">
        <h1>Platform Overview</h1>
        <span className="subtitle">Monitor system performance</span>
      </div>

      {/* STATS */}
      <div className="cards">

        <div className="card blue">
          <div className="card-top">
            <span>Total Users</span>
            <span>👥</span>
          </div>
          <h2>5</h2>
        </div>

        <div className="card green">
          <div className="card-top">
            <span>Restaurants</span>
            <span>🍽</span>
          </div>
          <h2>2</h2>
        </div>

        <div className="card orange">
          <div className="card-top">
            <span>Total Orders</span>
            <span>🧾</span>
          </div>
          <h2>18</h2>
        </div>

      </div>

      {/* TABLE */}
      <div className="recent">
        <div className="recent-header">
          <h2>Recent Users</h2>
        </div>

        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>admin@menumelt.com</td>
              <td>Admin</td>
              <td><span className="badge active">Active</span></td>
            </tr>

            <tr>
              <td>restaurant@menumelt.com</td>
              <td>Restaurant</td>
              <td><span className="badge active">Active</span></td>
            </tr>

            <tr>
              <td>waiter@menumelt.com</td>
              <td>Waiter</td>
              <td><span className="badge pending">Pending</span></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}
