import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./AdminLayout.css";

export default function PlatformAdminLayout() {

  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);

  const navigate = useNavigate();

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

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="admin-container">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <h2 className="brand">MenuMelt</h2>

        <ul className="menu">

          <span className="menu-title">PLATFORM</span>

          <li>
            <NavLink to="/admin" end>
              Dashboard
            </NavLink>
          </li>

          <li>
            <NavLink to="/admin/users">
              Users
            </NavLink>
          </li>

          <li>
            <NavLink to="/admin/restaurants">
              Restaurants
            </NavLink>
          </li>

          <li>
            <NavLink to="/admin/subscriptions">
              Subscriptions
            </NavLink>
          </li>

          <div className="divider"></div>

          <span className="menu-title">SYSTEM</span>

          <li>
            <NavLink to="/admin/settings">
              Settings
            </NavLink>
          </li>

        </ul>

      </aside>

      {/* MAIN */}
      <main className="main-content">

        <div className="top-bar">

          <h1>Platform Admin</h1>

          {/* 🔥 SAME PROFILE DROPDOWN */}
          <div className="admin-profile-wrapper">

            <div
              className="admin-profile"
              onClick={() => setOpen(!open)}
            >
              👤 {user?.full_name || "Admin"} ▾
            </div>

            {open && (
              <div className="dropdown">

                <p onClick={() => navigate("/admin/settings")}>
                  Settings
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