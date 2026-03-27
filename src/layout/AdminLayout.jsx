import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./adminLayout.css";

export default function AdminLayout() {

  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);

  const navigate = useNavigate();

  const role = localStorage.getItem("role");

  // 🔥 FETCH USER PROFILE
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/auth/profile/", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    })
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(err => console.error(err));
  }, []);

  // 🔥 LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  return (
    <div className="admin-container">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <h2 className="brand">MenuMelt</h2>

        <ul className="menu">

          <li><NavLink to="/admin" end>Dashboard</NavLink></li>

          {/* ADMIN ONLY */}
          {role === "admin" && (
            <>
              <li><NavLink to="/admin/orders">Live Orders</NavLink></li>
              <li><NavLink to="/admin/menu">Menu</NavLink></li>
              <li><NavLink to="/admin/tables">QR Tables</NavLink></li>
            </>
          )}

          {/* ADMIN + KITCHEN */}
          {(role === "admin" || role === "kitchen") && (
            <li><NavLink to="/admin/kitchen">Kitchen Monitor</NavLink></li>
          )}

          {/* ALL */}
          <li><NavLink to="/admin/profile">Profile</NavLink></li>

        </ul>

      </aside>

      {/* MAIN */}
      <main className="main-content">

        {/* TOP BAR */}
        <div className="top-bar">

          <h1>Admin Panel</h1>

          <div className="admin-profile-wrapper">

            <div
              className="admin-profile"
              onClick={() => setOpen(!open)}
            >
              👤 {user?.full_name || "User"} ▾
            </div>

            {open && (
              <div className="dropdown">

                <p onClick={() => navigate("/admin/profile")}>
                  Profile
                </p>

                <p className="logout" onClick={handleLogout}>
                  Logout
                </p>

              </div>
            )}

          </div>

        </div>

        <Outlet />

      </main>

    </div>
  );
}