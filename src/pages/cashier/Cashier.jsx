import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Cashier.css";
import { authFetch, API_BASE } from "../../lib/api";
import { clearAuth } from "../../lib/auth";

const SECTIONS = [
  { key: "unbilled", label: "Unbilled" },
  { key: "billed", label: "Billed" },
  { key: "pending_payment", label: "Pending Payment" },
  { key: "failed", label: "Failed" },
  { key: "paid", label: "Paid" },
  { key: "refunded", label: "Refunded" },
];

export default function Cashier() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/orders/`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.detail || "Could not load billing queue.");
        setOrders([]);
        return;
      }
      setError("");
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setError("Network error.");
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const grouped = useMemo(() => {
    const base = Object.fromEntries(SECTIONS.map((section) => [section.key, []]));
    for (const order of orders) {
      const key = order.billing_status || "unbilled";
      if (!base[key]) base[key] = [];
      base[key].push(order);
    }
    return base;
  }, [orders]);

  const totals = useMemo(() => {
    const paidOrders = grouped.paid || [];
    const paidQueueAmount = paidOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    return {
      unbilled: grouped.unbilled?.length || 0,
      pending: grouped.pending_payment?.length || 0,
      failed: grouped.failed?.length || 0,
      paidQueueAmount,
    };
  }, [grouped]);

  const patchBilling = async (orderId, payload) => {
    const marker = `${orderId}:${payload.billing_status}:${payload.payment_method || ""}`;
    setBusyKey(marker);
    try {
      const res = await authFetch(`${API_BASE}/api/orders/${orderId}/billing/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.detail || "Could not update billing.");
        return;
      }
      setError("");
      load();
    } catch {
      setError("Network error.");
    } finally {
      setBusyKey("");
    }
  };

  const verifyEsewa = async (orderId) => {
    const marker = `${orderId}:verify`;
    setBusyKey(marker);
    try {
      const res = await authFetch(`${API_BASE}/api/orders/${orderId}/verify-esewa-status/`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.detail || "Could not verify eSewa payment.");
        return;
      }
      setError("");
      load();
    } catch {
      setError("Network error.");
    } finally {
      setBusyKey("");
    }
  };

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  const actionsForOrder = (order) => {
    const actions = [];
    if (order.billing_status === "unbilled") {
      actions.push({
        label: "Prepare bill",
        kind: "primary",
        onClick: () => patchBilling(order.id, { billing_status: "billed" }),
        busy: `${order.id}:billed:`,
      });
    }
    if (order.billing_status === "billed") {
      actions.push({
        label: "Await cash",
        kind: "warn",
        onClick: () => patchBilling(order.id, { billing_status: "pending_payment", payment_method: "cash" }),
        busy: `${order.id}:pending_payment:cash`,
      });
      actions.push({
        label: "Await eSewa",
        kind: "ghost",
        onClick: () => patchBilling(order.id, { billing_status: "pending_payment", payment_method: "esewa" }),
        busy: `${order.id}:pending_payment:esewa`,
      });
      actions.push({
        label: "Mark cash paid",
        kind: "success",
        onClick: () => patchBilling(order.id, { billing_status: "paid", payment_method: "cash" }),
        busy: `${order.id}:paid:cash`,
      });
    }
    if (order.billing_status === "pending_payment") {
      if (order.payment_method === "cash") {
        actions.push({
          label: "Confirm cash received",
          kind: "success",
          onClick: () => patchBilling(order.id, { billing_status: "paid", payment_method: "cash" }),
          busy: `${order.id}:paid:cash`,
        });
      }
      if (order.payment_method === "esewa") {
        actions.push({
          label: "Verify eSewa",
          kind: "primary",
          onClick: () => verifyEsewa(order.id),
          busy: `${order.id}:verify`,
        });
        actions.push({
          label: "Mark eSewa paid",
          kind: "success",
          onClick: () => patchBilling(order.id, { billing_status: "paid", payment_method: "esewa" }),
          busy: `${order.id}:paid:esewa`,
        });
      }
      actions.push({
        label: "Mark failed",
        kind: "ghost",
        onClick: () => patchBilling(order.id, { billing_status: "failed", payment_method: order.payment_method }),
        busy: `${order.id}:failed:${order.payment_method || ""}`,
      });
    }
    if (order.billing_status === "failed") {
      actions.push({
        label: "Retry cash",
        kind: "warn",
        onClick: () => patchBilling(order.id, { billing_status: "pending_payment", payment_method: "cash" }),
        busy: `${order.id}:pending_payment:cash`,
      });
      actions.push({
        label: "Retry eSewa",
        kind: "ghost",
        onClick: () => patchBilling(order.id, { billing_status: "pending_payment", payment_method: "esewa" }),
        busy: `${order.id}:pending_payment:esewa`,
      });
    }
    if (order.billing_status === "paid") {
      actions.push({
        label: "Refund",
        kind: "ghost",
        onClick: () => patchBilling(order.id, { billing_status: "refunded", payment_method: order.payment_method }),
        busy: `${order.id}:refunded:${order.payment_method || ""}`,
      });
    }
    return actions;
  };

  return (
    <div className="mm-cashier">
      <header className="mm-cashier__hero">
        <div>
          <p className="mm-cashier__eyebrow">Cashier</p>
          <h1>Billing console</h1>
          <p className="mm-cashier__lead">
            Manage billing states, accept cash, verify eSewa, and keep payment closure separate from kitchen flow.
          </p>
        </div>
        <button type="button" className="mm-cashier__logout" onClick={logout}>
          Log out
        </button>
      </header>

      {error ? <div className="mm-cashier__alert">{error}</div> : null}

      <section className="mm-cashier__stats">
        <div className="mm-cashier__stat">
          <strong>{totals.unbilled}</strong>
          <span>Unbilled</span>
        </div>
        <div className="mm-cashier__stat">
          <strong>{totals.pending}</strong>
          <span>Pending Payment</span>
        </div>
        <div className="mm-cashier__stat">
          <strong>{totals.failed}</strong>
          <span>Failed</span>
        </div>
        <div className="mm-cashier__stat">
          <strong>Rs. {totals.paidQueueAmount.toFixed(2)}</strong>
          <span>Paid in queue</span>
        </div>
      </section>

      <div className="mm-cashier__sections">
        {SECTIONS.map((section) => (
          <section key={section.key} className="mm-cashier__section">
            <div className="mm-cashier__section-head">
              <h2>{section.label}</h2>
              <span>{grouped[section.key]?.length || 0}</span>
            </div>
            {grouped[section.key]?.length ? (
              <div className="mm-cashier__grid">
                {grouped[section.key].map((order) => (
                  <article key={order.id} className={`mm-cashier__card is-${order.billing_status}`}>
                    <header className="mm-cashier__card-head">
                      <div>
                        <p>Order #{order.id}</p>
                        <h3>Table {order.table_number}</h3>
                      </div>
                      <span>{order.billing_status.replaceAll("_", " ")}</span>
                    </header>
                    <p className="mm-cashier__meta">{order.customer_name}</p>
                    <p className="mm-cashier__meta">
                      Service {order.status} {order.payment_method ? `· ${order.payment_method}` : ""}
                    </p>
                    <p className="mm-cashier__amount">Rs. {Number(order.total_price).toFixed(2)}</p>
                    <ul className="mm-cashier__items">
                      {(order.items || []).map((item) => (
                        <li key={item.id ?? `${item.menu_item}-${item.quantity}`}>
                          <span>{item.item_name}</span>
                          <span>×{item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mm-cashier__actions">
                      {actionsForOrder(order).map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className={`mm-cashier__btn mm-cashier__btn--${action.kind}`}
                          disabled={busyKey === action.busy}
                          onClick={action.onClick}
                        >
                          {busyKey === action.busy ? "Saving…" : action.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mm-cashier__empty">No orders in this billing stage.</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
