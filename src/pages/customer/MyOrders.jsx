import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { authFetch, API_BASE } from "../../lib/api";
import { SERVICE_STATUS_FLOW, SERVICE_STATUS_LABELS, subscribeToOrderStream, upsertOrder } from "../../lib/orderLive";
import "./MyOrders.css";

function formatBillingLabel(value) {
  return String(value || "unbilled").replaceAll("_", " ");
}

function LivePill({ state }) {
  const label =
    state === "connected"
      ? "Live updates on"
      : state === "reconnecting"
        ? "Reconnecting live updates…"
        : state === "error"
          ? "Live updates interrupted"
          : "Connecting live updates…";
  return <div className={`cx-live-pill cx-live-pill--${state}`}>{label}</div>;
}

function StatusTimeline({ status }) {
  const currentIndex = Math.max(SERVICE_STATUS_FLOW.indexOf(status), 0);
  return (
    <ol className="cx-status-track" aria-label="Order progress">
      {SERVICE_STATUS_FLOW.map((step, index) => {
        const done = index <= currentIndex;
        return (
          <li key={step} className={`cx-status-step ${done ? "is-done" : ""}`}>
            <span className="cx-status-dot" aria-hidden />
            <span className="cx-status-label">{SERVICE_STATUS_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function MyOrders() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [liveState, setLiveState] = useState("connecting");

  const fetchOrders = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/orders/my/`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setOrders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (flash) {
      const t = setTimeout(() => setFlash(""), 6000);
      return () => clearTimeout(t);
    }
  }, [flash]);

  useEffect(() => {
    if (!sessionStorage.getItem("table_token")) {
      setLoading(false);
      return;
    }
    fetchOrders();
    const unsubscribe = subscribeToOrderStream({
      audience: "customer",
      onStateChange: setLiveState,
      onEvent: (event) => {
        const incoming = event?.customer_order;
        if (!incoming) return;
        setOrders((current) => {
          const previous = current.find((item) => item.id === incoming.id);
          if (previous && previous.status !== incoming.status && incoming.status === "ready") {
            setFlash(`Order #${incoming.id} is ready for service.`);
          }
          return upsertOrder(current, incoming);
        });
      },
    });
    return unsubscribe;
  }, [fetchOrders]);

  if (!sessionStorage.getItem("table_token")) {
    return (
      <div className="cx-shell">
        <div className="cx-phone">
          <div className="cx-gate">
            <p>Scan your table QR to see orders for this table.</p>
            <Link to="/" className="cx-link">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cx-shell">
      <div className="cx-phone cx-orders-page">
        <section className="cx-card">
          <header className="cx-page-header">
            <Link to="/menu" className="cx-icon-btn" aria-label="Back to menu">
              <ChevronLeft size={20} strokeWidth={2.2} />
            </Link>
            <h1>Your orders</h1>
            <span className="cx-page-spacer" aria-hidden />
          </header>

          <LivePill state={liveState} />
          {flash ? <div className="cx-flash">{flash}</div> : null}

          {loading ? (
            <p className="cx-orders-muted">Loading your orders…</p>
          ) : orders.length === 0 ? (
            <div className="cx-orders-muted">
              <p>No orders yet.</p>
              <p style={{ marginTop: 8, fontSize: "0.85rem", opacity: 0.85 }}>
                Open the menu and add dishes to your cart to place your first order.
              </p>
            </div>
          ) : (
            <ul className="cx-orders-list">
              {orders.map((o) => (
                <li key={o.id} className="cx-order-card">
                  <div className="cx-order-card-head">
                    <div>
                      <p className="cx-order-id">Order #{o.id}</p>
                      <p className="cx-order-sub">
                        {o.customer_name} · Table {o.table_number}
                      </p>
                      <div className="cx-order-meta-row">
                        <span className={`cx-order-status cx-order-status--${o.status}`}>{SERVICE_STATUS_LABELS[o.status] || o.status}</span>
                        <span className="cx-order-meta">
                          Billing: {formatBillingLabel(o.billing_status)}
                          {o.payment_method ? ` (${o.payment_method})` : ""}
                        </span>
                      </div>
                    </div>
                    <span className="cx-order-price">Rs. {Number(o.total_price).toFixed(2)}</span>
                  </div>
                  <StatusTimeline status={o.status} />
                  <ul className="cx-order-items">
                    {(o.items || []).map((it) => (
                      <li key={it.id}>
                        {it.item_name} × {it.quantity}
                      </li>
                    ))}
                  </ul>
                  {o.billing_status !== "paid" && o.billing_status !== "refunded" ? (
                    <Link to={`/billing/${o.id}`} state={{ order: o }} className="cx-order-pay-link">
                      Payment / receipt →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <nav className="cx-orders-footer" aria-label="Order actions">
            <Link to="/cart" className="cx-orders-footer-btn cx-orders-footer-btn--primary">
              <ShoppingCart size={18} strokeWidth={2.2} aria-hidden />
              <span>Cart</span>
            </Link>
            <Link to="/menu" className="cx-orders-footer-btn cx-orders-footer-btn--ghost">
              Back to menu
            </Link>
          </nav>
        </section>
      </div>
    </div>
  );
}
