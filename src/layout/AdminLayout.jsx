import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./adminLayout.css";

export default function AdminLayout() {

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

      <aside className="sidebar">

        <h2 className="brand">MenuMelt</h2>

        <ul className="menu">

          <span className="menu-title">MAIN</span>

          <li>
            <NavLink to="/restaurant-admin" end>
              Dashboard
            </NavLink>
          </li>

          <li>
            <NavLink to="/restaurant-admin/orders">
              Orders
            </NavLink>
          </li>

          <li>
            <NavLink to="/restaurant-admin/menu">
              Menu
            </NavLink>
          </li>

          <li>
            <NavLink to="/restaurant-admin/tables">
              QR Tables
            </NavLink>
          </li>

          <li>
            <NavLink to="/restaurant-admin/kitchen">
              Kitchen
            </NavLink>
          </li>

          <div className="divider"></div>
          <span className="menu-title">BUSINESS</span>

          <li>
            <NavLink to="/restaurant-admin/subscription">
              Subscription
            </NavLink>
          </li>

          <div className="divider"></div>
          <span className="menu-title">ACCOUNT</span>

          <li>
            <NavLink to="/restaurant-admin/profile">
              Profile
            </NavLink>
          </li>

        </ul>

      </aside>

      <main className="main-content">

        <div className="top-bar">

          <h1>Restaurant Admin Panel</h1>

          <div className="admin-profile-wrapper">

            <div
              className="admin-profile"
              onClick={() => setOpen(!open)}
            >
              👤 {user?.full_name || "User"} ▾
            </div>

            {open && (
              <div className="dropdown">

                <p onClick={() => navigate("/restaurant-admin/profile")}>
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