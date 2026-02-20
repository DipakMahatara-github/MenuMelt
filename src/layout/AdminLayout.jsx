import { NavLink, Outlet } from "react-router-dom";
import "../pages/admin/dashboard.css";

export default function AdminLayout() {
  return (
    <div className="admin-container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2 className="brand">MenuMelt</h2>

        <ul className="menu">
          <li><NavLink to="/admin" end>Dashboard</NavLink></li>
          <li><NavLink to="/admin/orders">Orders</NavLink></li>
          <li><NavLink to="/admin/menu">Menu</NavLink></li>
          <li><NavLink to="/admin/tables">Tables</NavLink></li>
          <li><NavLink to="/admin/kitchen">Kitchen</NavLink></li>
          <li><NavLink to="/admin/reports">Reports</NavLink></li>
          <li><NavLink to="/admin/settings">Settings</NavLink></li>
        </ul>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <div className="top-bar">
          <h1>Admin Panel</h1>
          <div className="admin-profile">Owner</div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
