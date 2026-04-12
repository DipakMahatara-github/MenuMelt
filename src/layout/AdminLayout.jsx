import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./adminLayout.css";
import { authFetch, API_BASE } from "../lib/api";
import { clearAuth } from "../lib/auth";
import { 
  Leaf, 
  LayoutDashboard, 
  ListOrdered, 
  BookOpen, 
  Armchair, 
  Users, 
  ChefHat, 
  CreditCard, 
  RefreshCw, 
  User, 
  Bell 
} from "lucide-react";

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    authFetch(`${API_BASE}/api/auth/profile/`)
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(err => console.error(err));
  }, []);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <div className="admin-container">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-wrapper">
            <Leaf className="brand-icon" size={28} />
            <h2 title={user?.restaurant_name || "MenuMelt"}>
              {user?.restaurant_name || "Sage Bistro"}
            </h2>
          </div>
          <span className="brand-subtitle">Admin</span>
        </div>

        <ul className="menu">
          <li>
            <NavLink to="/restaurant-admin" end>
              <LayoutDashboard /> Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/restaurant-admin/orders">
              <ListOrdered /> Orders
            </NavLink>
          </li>
          <li>
            <NavLink to="/restaurant-admin/menu">
              <BookOpen /> Menu
            </NavLink>
          </li>
          <li>
            <NavLink to="/restaurant-admin/tables">
              <Armchair /> Tables
            </NavLink>
          </li>
          <li>
            <NavLink to="/restaurant-admin/team">
              <Users /> Staff
            </NavLink>
          </li>
          <li>
            <NavLink to="/restaurant-admin/kitchen">
              <ChefHat /> Kitchen
            </NavLink>
          </li>
          <li>
            <NavLink to="/restaurant-admin/payment">
              <CreditCard /> Payment
            </NavLink>
          </li>
          <li>
            <NavLink to="/restaurant-admin/subscription">
              <RefreshCw /> Subscription
            </NavLink>
          </li>
        </ul>

        <ul className="menu menu-bottom">
          <li>
            <NavLink to="/restaurant-admin/profile">
              <User /> Profile
            </NavLink>
          </li>
        </ul>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <div className="top-bar-left">
            <h1>Welcome, {user?.full_name?.split(" ")[0] || "User"}!</h1>
            <p>Restaurant Admin</p>
          </div>

          <div className="top-bar-right">
            <button className="notification-btn" aria-label="Notifications">
              <Bell size={24} />
              <span className="notification-badge">3</span>
            </button>

            <div className="admin-profile-wrapper">
              <div
                className="admin-profile"
                onClick={() => setOpen(!open)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(!open);
                  }
                }}
                aria-expanded={open}
                aria-haspopup="true"
              >
                <img 
                  src="https://api.dicebear.com/7.x/notionists/svg?seed=Alex&backgroundColor=E8F0EA" 
                  alt="Profile" 
                  className="admin-profile__avatar" 
                />
                <span className="admin-profile__name">{user?.full_name || "Alex Johnson"}</span>
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
        </div>

        <Outlet />
      </main>
    </div>
  );
}