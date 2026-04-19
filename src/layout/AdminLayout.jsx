import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import "./adminLayout.css";
import { authFetch, API_BASE } from "../lib/api";
import { clearAuth } from "../lib/auth";
import { subscribeToOrderStream } from "../lib/orderLive";
import ToastStack from "../components/ToastStack";
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
  Bell,
  ShoppingBag
} from "lucide-react";

const MAX_NOTIFICATIONS = 10;
const TOAST_DURATION_MS = 5000;

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // ── Notification state ──
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const notifRef = useRef(null);
  const toastTimers = useRef({});

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dismissToast = useCallback((id) => {
    clearTimeout(toastTimers.current[id]);
    delete toastTimers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((text, tone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, tone }]);
    toastTimers.current[id] = setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
  }, [dismissToast]);

  // ── WebSocket subscription for new orders ──
  useEffect(() => {
    const unsubscribe = subscribeToOrderStream({
      audience: "staff",
      onStateChange: () => {},
      onEvent: (event) => {
        // Only react to brand-new (created) orders
        if (event?.type !== "order.created") return;
        const order = event?.staff_order;
        if (!order) return;

        const itemCount = order.items?.length ?? 0;
        const tableNum = order.table_number ?? order.table ?? "?";
        const text = `New order at Table ${tableNum} · ${itemCount} item${itemCount !== 1 ? "s" : ""}`;

        // Add to notification history (keep last MAX_NOTIFICATIONS)
        const notif = {
          id: order.id,
          text,
          time: order.created_at || new Date().toISOString(),
          orderId: order.id,
        };
        setNotifications((prev) => [notif, ...prev].slice(0, MAX_NOTIFICATIONS));
        setUnreadCount((prev) => prev + 1);

        // Show a toast
        addToast(text, "info");
      },
    });
    return unsubscribe;
  }, [addToast]);

  const handleBellClick = () => {
    setNotifOpen((prev) => !prev);
    setUnreadCount(0); // mark all as read
  };

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
              <Users /> Team
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
            {/* ── Bell + Dropdown ── */}
            <div className="notif-wrapper" ref={notifRef}>
              <button
                className="notification-btn"
                aria-label="Notifications"
                onClick={handleBellClick}
              >
                <Bell size={24} />
                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown__header">
                    <span>Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        className="notif-dropdown__clear"
                        onClick={() => setNotifications([])}
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="notif-dropdown__list">
                    {notifications.length === 0 ? (
                      <div className="notif-dropdown__empty">
                        <Bell size={32} strokeWidth={1.5} />
                        <p>No new notifications</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={`${notif.id}-${notif.time}`}
                          className="notif-item"
                          onClick={() => {
                            setNotifOpen(false);
                            navigate("/restaurant-admin/orders");
                          }}
                        >
                          <span className="notif-item__icon">
                            <ShoppingBag size={16} />
                          </span>
                          <div className="notif-item__body">
                            <p>{notif.text}</p>
                            <span>{timeAgo(notif.time)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

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

      {/* ── Global Toast Stack ── */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
