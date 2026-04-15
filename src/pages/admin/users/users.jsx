import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, UserRound, UserX } from "lucide-react";
import "./users.css";
import { authFetch, API_BASE } from "../../../lib/api";
import ConfirmDialog from "../../../components/ConfirmDialog";
import ToastStack from "../../../components/ToastStack";
import { useToastQueue } from "../../../hooks/useToastQueue";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function Users() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState({ users: [], roles: [] });
  const [busyId, setBusyId] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const { toasts, pushToast, removeToast } = useToastQueue();

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (role) params.set("role", role);
        if (status) params.set("status", status);
        const query = params.toString() ? `?${params.toString()}` : "";
        const res = await authFetch(`${API_BASE}/api/admin/dashboard/users/${query}`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (!res.ok) {
            pushToast("error", json.error || "Could not load users.");
            return;
          }
          setData({
            users: Array.isArray(json.users) ? json.users : [],
            roles: Array.isArray(json.roles) ? json.roles : [],
          });
        }
      } catch {
        if (!cancelled) pushToast("error", "Network error while loading users.");
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, role, status]);

  const users = data.users || [];

  const totals = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.is_active).length,
      inactive: users.filter((user) => !user.is_active).length,
    }),
    [users]
  );

  const toggleUser = async (user) => {
    setBusyId(`toggle:${user.id}`);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/dashboard/users/${user.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast("error", json.error || "Could not update user.");
        return;
      }
      pushToast("success", `${json.email} is now ${json.is_active ? "active" : "inactive"}.`);
      setData((current) => ({
        ...current,
        users: current.users.map((item) => (item.id === user.id ? json : item)),
      }));
    } catch {
      pushToast("error", "Network error while updating user.");
    } finally {
      setBusyId("");
    }
  };

  const deleteUser = async (user) => {
    setBusyId(`delete:${user.id}`);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/dashboard/users/${user.id}/`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast("error", json.error || "Could not delete user.");
        return;
      }
      pushToast("success", json.message || `${user.email} deleted.`);
      setData((current) => ({
        ...current,
        users: current.users.filter((item) => item.id !== user.id),
      }));
    } catch {
      pushToast("error", "Network error while deleting user.");
    } finally {
      setBusyId("");
    }
  };

  const openConfirm = (action, user) => {
    const isDelete = action === "delete";
    const isRestaurantAdmin = user.role === "restaurant_admin";
    setConfirmState({
      action,
      user,
      title: isDelete ? "Delete this account?" : `${user.is_active ? "Deactivate" : "Reactivate"} this account?`,
      description: isDelete
        ? isRestaurantAdmin
          ? `Deleting ${user.email} will also remove the restaurant and linked staff accounts. This cannot be undone.`
          : `Deleting ${user.email} cannot be undone.`
        : user.is_active
        ? `${user.email} will lose access until you reactivate the account.`
        : `${user.email} will be able to log in again immediately.`,
      confirmLabel: isDelete ? "Delete account" : user.is_active ? "Deactivate" : "Reactivate",
      tone: isDelete ? "danger" : user.is_active ? "warning" : "success",
    });
  };

  const closeConfirm = () => {
    if (busyId) return;
    setConfirmState(null);
  };

  const handleConfirmedAction = async () => {
    if (!confirmState) return;
    const { action, user } = confirmState;
    if (action === "delete") {
      await deleteUser(user);
    } else {
      await toggleUser(user);
    }
    setConfirmState(null);
  };

  return (
    <div className="pa-users">
      <header className="pa-users__hero">
        <div>
          <p className="pa-users__eyebrow">Access management</p>
          <h1>Users</h1>
          <p className="pa-users__lead">
            Search across all platform accounts and quickly suspend or restore access.
          </p>
        </div>
        <div className="pa-users__stats">
          <div className="pa-users__stat">
            <UserRound size={18} />
            <div>
              <strong>{totals.total}</strong>
              <span>Total</span>
            </div>
          </div>
          <div className="pa-users__stat">
            <ShieldCheck size={18} />
            <div>
              <strong>{totals.active}</strong>
              <span>Active</span>
            </div>
          </div>
          <div className="pa-users__stat">
            <UserX size={18} />
            <div>
              <strong>{totals.inactive}</strong>
              <span>Inactive</span>
            </div>
          </div>
        </div>
      </header>

      <section className="pa-users__controls">
        <label className="pa-users__search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search name, email, or restaurant"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {data.roles.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </section>

      <section className="pa-users__panel">
        <div className="pa-users__table-wrap">
          <table className="pa-users__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Restaurant</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Last login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="8" className="pa-users__empty">
                    No users match the current filters.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`pa-users__badge role-${user.role}`}>{user.role.replaceAll("_", " ")}</span>
                    </td>
                    <td>{user.restaurant_name || "—"}</td>
                    <td>
                      <span className={`pa-users__badge ${user.is_active ? "is-active" : "is-inactive"}`}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{formatDateTime(user.created_at)}</td>
                    <td>{formatDateTime(user.last_login)}</td>
                    <td>
                      <div className="pa-users__actions">
                        <button
                          type="button"
                          className={`pa-users__action ${user.is_active ? "is-danger" : "is-okay"}`}
                          disabled={busyId !== "" && busyId !== `toggle:${user.id}`}
                          onClick={() => openConfirm("toggle", user)}
                        >
                          {busyId === `toggle:${user.id}` ? "Saving…" : user.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button
                          type="button"
                          className="pa-users__action is-delete"
                          disabled={busyId !== "" && busyId !== `delete:${user.id}`}
                          onClick={() => openConfirm("delete", user)}
                        >
                          {busyId === `delete:${user.id}` ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        meta={
          confirmState
            ? [
                confirmState.user.full_name,
                confirmState.user.email,
                confirmState.user.role.replaceAll("_", " "),
              ]
            : []
        }
        busy={Boolean(busyId)}
        onCancel={closeConfirm}
        onConfirm={handleConfirmedAction}
      />

      <ToastStack toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
