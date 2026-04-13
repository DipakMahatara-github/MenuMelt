import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, Search, Store, UnlockKeyhole } from "lucide-react";
import "./restaurants.css";
import { authFetch, API_BASE } from "../../../lib/api";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function Restaurants() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [restaurants, setRestaurants] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (status) params.set("status", status);
        const query = params.toString() ? `?${params.toString()}` : "";
        const res = await authFetch(`${API_BASE}/api/admin/dashboard/restaurants/${query}`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (!res.ok) {
            setError(json.error || "Could not load restaurants.");
            return;
          }
          setError("");
          setRestaurants(Array.isArray(json.restaurants) ? json.restaurants : []);
        }
      } catch {
        if (!cancelled) setError("Network error while loading restaurants.");
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, status]);

  const stats = useMemo(
    () => ({
      total: restaurants.length,
      active: restaurants.filter((restaurant) => restaurant.is_active).length,
      locked: restaurants.filter((restaurant) => !restaurant.is_active).length,
    }),
    [restaurants]
  );

  const runAction = async (restaurant, action) => {
    setBusyId(String(restaurant.id));
    try {
      const res = await authFetch(`${API_BASE}/api/admin/dashboard/restaurants/${restaurant.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not update restaurant access.");
        return;
      }
      setError("");
      setRestaurants((current) => current.map((item) => (item.id === restaurant.id ? json : item)));
    } catch {
      setError("Network error while updating restaurant access.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="pa-restaurants">
      <header className="pa-restaurants__hero">
        <div>
          <p className="pa-restaurants__eyebrow">Restaurant access</p>
          <h1>Restaurants</h1>
          <p className="pa-restaurants__lead">
            Unlock restaurants manually while the payment gateway is unstable, or lock them again later from here.
          </p>
        </div>

        <div className="pa-restaurants__stats">
          <div className="pa-restaurants__stat">
            <Store size={18} />
            <div>
              <strong>{stats.total}</strong>
              <span>Total</span>
            </div>
          </div>
          <div className="pa-restaurants__stat">
            <UnlockKeyhole size={18} />
            <div>
              <strong>{stats.active}</strong>
              <span>Unlocked</span>
            </div>
          </div>
          <div className="pa-restaurants__stat">
            <LockKeyhole size={18} />
            <div>
              <strong>{stats.locked}</strong>
              <span>Locked</span>
            </div>
          </div>
        </div>
      </header>

      {error ? <div className="pa-restaurants__alert">{error}</div> : null}

      <section className="pa-restaurants__controls">
        <label className="pa-restaurants__search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search restaurant, owner, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All access states</option>
          <option value="active">Unlocked</option>
          <option value="inactive">Locked</option>
        </select>
      </section>

      <section className="pa-restaurants__grid">
        {restaurants.length === 0 ? (
          <article className="pa-restaurants__empty">
            No restaurants match the current filters.
          </article>
        ) : (
          restaurants.map((restaurant) => (
            <article key={restaurant.id} className="pa-restaurants__card">
              <header className="pa-restaurants__card-head">
                <div>
                  <h2>{restaurant.name}</h2>
                  <p>{restaurant.owner_name}</p>
                  <span>{restaurant.owner_email}</span>
                </div>
                <span className={`pa-restaurants__badge ${restaurant.is_active ? "is-active" : "is-inactive"}`}>
                  {restaurant.is_active ? "Unlocked" : "Locked"}
                </span>
              </header>

              <div className="pa-restaurants__meta">
                <div>
                  <span>Subscription</span>
                  <strong>{restaurant.current_subscription_status.replaceAll("_", " ")}</strong>
                </div>
                <div>
                  <span>Plan</span>
                  <strong>{restaurant.current_plan_name || "No plan yet"}</strong>
                </div>
                <div>
                  <span>Tables</span>
                  <strong>{restaurant.tables_count || 0}</strong>
                </div>
                <div>
                  <span>Team</span>
                  <strong>{restaurant.team_size || 0}</strong>
                </div>
                <div>
                  <span>Orders</span>
                  <strong>{restaurant.orders_count || 0}</strong>
                </div>
                <div>
                  <span>Created</span>
                  <strong>{formatDateTime(restaurant.created_at)}</strong>
                </div>
              </div>

              <p className="pa-restaurants__address">{restaurant.address || "No address provided yet."}</p>

              <div className="pa-restaurants__actions">
                <button
                  type="button"
                  className="pa-restaurants__btn is-okay"
                  disabled={busyId === String(restaurant.id) || restaurant.is_active}
                  onClick={() => runAction(restaurant, "unlock")}
                >
                  {busyId === String(restaurant.id) ? "Saving…" : "Unlock access"}
                </button>
                <button
                  type="button"
                  className="pa-restaurants__btn is-danger"
                  disabled={busyId === String(restaurant.id) || !restaurant.is_active}
                  onClick={() => runAction(restaurant, "lock")}
                >
                  {busyId === String(restaurant.id) ? "Saving…" : "Lock access"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
