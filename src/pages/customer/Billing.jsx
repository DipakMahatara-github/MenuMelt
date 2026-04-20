import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { authFetch, API_BASE } from "../../lib/api";
import "./Billing.css";

export default function Billing() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (order || !orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/orders/my/`);
        const list = await res.json();
        if (!res.ok || cancelled) return;
        const found = Array.isArray(list) ? list.find((item) => String(item.id) === String(orderId)) : null;
        if (found) setOrder(found);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, order]);

  const payCash = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await authFetch(`${API_BASE}/api/orders/${orderId}/pay-cash/`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || data.error || "Could not confirm.");
        return;
      }
      setOrder(data);
      navigate("/my-orders", {
        replace: true,
        state: { flash: "Cash payment is awaiting the cashier. Show your order number at the counter." },
      });
    } catch (e) {
      console.error(e);
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const payKhalti = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await authFetch(`${API_BASE}/api/orders/${orderId}/pay-khalti/`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.detail || "Khalti is not available.");
        return;
      }

      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        setError("Invalid response from server. Missing payment URL.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error.");
    } finally {
      // Don't setBusy(false) if we are redirecting
    }
  };

  if (!sessionStorage.getItem("table_token")) {
    return (
      <div className="cx-shell">
        <div className="cx-phone">
          <div className="cx-gate">
            <p>Scan the table QR to continue.</p>
            <Link to="/" className="cx-link">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="cx-shell">
        <div className="cx-phone">
          <div className="cx-loading-inline">Loading order…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="cx-shell">
      <div className="cx-phone">
        <section className="cx-card">
          <header className="cx-page-header">
            <button type="button" className="cx-icon-btn" onClick={() => navigate("/my-orders")} aria-label="Back">
              <ChevronLeft size={20} strokeWidth={2.2} />
            </button>
            <h1>Payment</h1>
            <span className="cx-page-spacer" aria-hidden />
          </header>

          <div className="cx-billing-summary">
            <p className="cx-billing-order-line">
              Order <strong>#{order.id}</strong> · Table {order.table_number}
            </p>
            {Number(order.discount_total || 0) > 0 ? (
              <p className="cx-billing-order-line">
                Subtotal <strong>Rs. {Number(order.subtotal_price).toFixed(2)}</strong>
              </p>
            ) : null}
            <p className="cx-billing-total">
              Rs. <span>{Number(order.total_price).toFixed(2)}</span>
            </p>
            {Number(order.tax_total || 0) > 0 ? (
              <p className="cx-billing-order-line">
                VAT (13%) <strong>+ Rs. {Number(order.tax_total).toFixed(2)}</strong>
              </p>
            ) : null}
            {Number(order.discount_total || 0) > 0 ? (
              <p className="cx-billing-order-line">
                Discounts <strong>- Rs. {Number(order.discount_total).toFixed(2)}</strong>
              </p>
            ) : null}
            <p className="cx-billing-order-line">
              Billing status <strong>{String(order.billing_status || "unbilled").replaceAll("_", " ")}</strong>
            </p>
          </div>

          <ul className="cx-line-items">
            {(order.items || []).map((item) => (
              <li key={item.id} className="cx-line-item">
                <div>
                  <span>
                    {item.item_name} × {item.quantity}
                  </span>
                  {item.selected_options?.length ? (
                    <div className="cx-billing-option-list">
                      {item.selected_options.map((option) => (
                        <span key={`${item.id}-${option.group_name}-${option.option_name}`}>
                          {option.group_name}: {option.option_name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span>Rs. {Number(item.line_total).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          {order.applied_offers?.length ? (
            <div className="cx-billing-offers">
              {order.applied_offers.map((offer) => (
                <p key={`${offer.offer_type}-${offer.name}`}>
                  {offer.badge_text || offer.name} saved Rs. {Number(offer.discount_amount).toFixed(2)}
                </p>
              ))}
            </div>
          ) : null}

          {error ? <p className="cx-billing-error">{error}</p> : null}

          <div className="cx-billing-actions">
            <button
              type="button"
              className="cx-btn-secondary"
              disabled={busy || order.billing_status === "paid" || order.billing_status === "refunded"}
              onClick={payCash}
            >
              Pay at counter
            </button>
            <button
              type="button"
              className="cx-btn-block"
              disabled={busy || order.billing_status === "paid" || order.billing_status === "refunded"}
              onClick={payKhalti}
            >
              Pay with Khalti
            </button>
            <Link to="/my-orders" className="cx-billing-link">
              View my orders
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
