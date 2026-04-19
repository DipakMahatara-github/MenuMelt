import { useEffect, useMemo, useState } from "react";
import {
  CircleDollarSign,
  LockKeyhole,
  ReceiptText,
  Store,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
import "./dashboard.css";
import { authFetch, API_BASE } from "../../../lib/api";

const STAT_CARDS = [
  { key: "total_users", label: "Users", icon: UserRound },
  { key: "active_users", label: "Active users", icon: UserRoundCheck },
  { key: "total_restaurants", label: "Restaurants", icon: Store },
  { key: "locked_restaurants", label: "Locked restaurants", icon: LockKeyhole },
  { key: "total_orders", label: "Orders", icon: ReceiptText },
  { key: "active_subscriptions", label: "Active subscriptions", icon: CircleDollarSign },
];

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/admin/dashboard/`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (!res.ok) {
            setError(json.error || "Could not load platform dashboard.");
            return;
          }
          setError("");
          setData(json);
        }
      } catch {
        if (!cancelled) setError("Network error while loading platform dashboard.");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = data?.stats || {};
  const recentUsers = data?.recent_users || [];
  const recentRestaurants = data?.recent_restaurants || [];

  const statItems = useMemo(
    () =>
      STAT_CARDS.map((card) => ({
        ...card,
        value: Number(stats[card.key] || 0).toLocaleString(),
      })),
    [stats]
  );

  return (
    <div className="pa-dashboard">
      <header className="pa-pagehead">
        <div>
          <p className="pa-pagehead__eyebrow">Platform overview</p>
          <h1>Control center</h1>
          <p className="pa-pagehead__sub">
            Keep an eye on registrations, restaurant access, and the overall health of MenuMelt.
          </p>
        </div>
        <div className={`pa-pill ${stats.registration_open ? "is-open" : "is-closed"}`}>
          {stats.registration_open ? "Registrations open" : "Registrations paused"}
        </div>
      </header>

      {error ? <div className="pa-alert">{error}</div> : null}

      <section className="pa-stats-grid">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.key} className="pa-stat-card">
              <div className="pa-stat-card__icon">
                <Icon size={20} />
              </div>
              <div>
                <p className="pa-stat-card__label">{item.label}</p>
                <h2>{item.value}</h2>
              </div>
            </article>
          );
        })}
      </section>

      <section className="pa-snapshot-grid">
        <article className="pa-panel">
          <header className="pa-panel__head">
            <h2>Live snapshot</h2>
          </header>
          <div className="pa-kpis">
            <div className="pa-kpi">
              <span>Orders today</span>
              <strong>{Number(stats.orders_today || 0).toLocaleString()}</strong>
            </div>
            <div className="pa-kpi">
              <span>Pending subscriptions</span>
              <strong>{Number(stats.pending_subscriptions || 0).toLocaleString()}</strong>
            </div>
            <div className="pa-kpi">
              <span>Failed subscriptions</span>
              <strong>{Number(stats.failed_subscriptions || 0).toLocaleString()}</strong>
            </div>
            <div className="pa-kpi">
              <span>Total tables</span>
              <strong>{Number(stats.total_tables || 0).toLocaleString()}</strong>
            </div>
          </div>
        </article>

        <article className="pa-panel">
          <header className="pa-panel__head">
            <h2>What this unlocks</h2>
          </header>
          <ul className="pa-bullets">
            <li>Use the Restaurants page to manually unlock restaurant access while Khalti is unstable.</li>
            <li>Use the Subscriptions page to activate, extend, expire, or cancel plans.</li>
            <li>Use Settings to pause new registrations without blocking existing restaurant logins.</li>
          </ul>
        </article>
      </section>

      <section className="pa-table-grid">
        <article className="pa-panel">
          <header className="pa-panel__head">
            <h2>Recent users</h2>
          </header>
          <div className="pa-table-wrap">
            <table className="pa-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Restaurant</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="pa-table__empty">
                      No users found yet.
                    </td>
                  </tr>
                ) : (
                  recentUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.full_name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`pa-badge role-${user.role}`}>{user.role.replaceAll("_", " ")}</span>
                      </td>
                      <td>
                        <span className={`pa-badge ${user.is_active ? "state-active" : "state-inactive"}`}>
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{user.restaurant_name || "—"}</td>
                      <td>{formatDateTime(user.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="pa-panel">
          <header className="pa-panel__head">
            <h2>Recent restaurants</h2>
          </header>
          <div className="pa-table-wrap">
            <table className="pa-table">
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Owner</th>
                  <th>Access</th>
                  <th>Subscription</th>
                  <th>Orders</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentRestaurants.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="pa-table__empty">
                      No restaurants found yet.
                    </td>
                  </tr>
                ) : (
                  recentRestaurants.map((restaurant) => (
                    <tr key={restaurant.id}>
                      <td>{restaurant.name}</td>
                      <td>{restaurant.owner_name}</td>
                      <td>
                        <span className={`pa-badge ${restaurant.is_active ? "state-active" : "state-inactive"}`}>
                          {restaurant.is_active ? "Unlocked" : "Locked"}
                        </span>
                      </td>
                      <td>{restaurant.current_subscription_status.replaceAll("_", " ")}</td>
                      <td>{restaurant.orders_count || 0}</td>
                      <td>{formatDateTime(restaurant.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
