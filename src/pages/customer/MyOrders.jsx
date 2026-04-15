import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ShoppingCart, Star } from "lucide-react";
import { authFetch, API_BASE } from "../../lib/api";
import {
  SERVICE_STATUS_FLOW,
  SERVICE_STATUS_LABELS,
  subscribeToOrderStream,
  upsertOrder,
} from "../../lib/orderLive";
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

const initialReviewForm = {
  food_quality: 5,
  service: 5,
  overall_experience: 5,
  comment: "",
};

function parseReviewErrorPayload(data) {
  if (!data || typeof data !== "object") return "Could not submit your review.";
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
  const parts = [];
  Object.values(data).forEach((value) => {
    if (Array.isArray(value)) parts.push(value.join(", "));
    else if (typeof value === "string") parts.push(value);
  });
  return parts.join(" ").trim() || "Could not submit your review.";
}

export default function MyOrders() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [liveState, setLiveState] = useState("connecting");
  const [reviewingOrder, setReviewingOrder] = useState(null);
  const [reviewForm, setReviewForm] = useState(initialReviewForm);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");

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

  const openReview = (order) => {
    setReviewingOrder(order);
    setReviewForm(initialReviewForm);
    setReviewError("");
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!reviewingOrder) return;
    setReviewBusy(true);
    setReviewError("");
    try {
      const res = await authFetch(`${API_BASE}/api/orders/${reviewingOrder.id}/review/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReviewError(parseReviewErrorPayload(data));
        return;
      }
      if (data?.id) {
        setOrders((current) => upsertOrder(current, data));
      } else {
        await fetchOrders();
      }
      setFlash("Thanks for sharing your feedback.");
      setReviewingOrder(null);
      setReviewForm(initialReviewForm);
    } catch (error) {
      console.error(error);
      setReviewError("Could not submit your review.");
    } finally {
      setReviewBusy(false);
    }
  };

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
              {orders.map((order) => (
                <li key={order.id} className="cx-order-card">
                  <div className="cx-order-card-head">
                    <div>
                      <p className="cx-order-id">Order #{order.id}</p>
                      <p className="cx-order-sub">
                        {order.customer_name} · Table {order.table_number}
                      </p>
                      <div className="cx-order-meta-row">
                        <span className={`cx-order-status cx-order-status--${order.status}`}>
                          {SERVICE_STATUS_LABELS[order.status] || order.status}
                        </span>
                        <span className="cx-order-meta">
                          Billing: {formatBillingLabel(order.billing_status)}
                          {order.payment_method ? ` (${order.payment_method})` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="cx-order-price-stack">
                      {Number(order.discount_total || 0) > 0 ? (
                        <span className="cx-order-price-note">Saved Rs. {Number(order.discount_total).toFixed(2)}</span>
                      ) : null}
                      <span className="cx-order-price">Rs. {Number(order.total_price).toFixed(2)}</span>
                    </div>
                  </div>
                  <StatusTimeline status={order.status} />
                  <ul className="cx-order-items">
                    {(order.items || []).map((item) => (
                      <li key={item.id}>
                        <div>
                          <span>
                            {item.item_name} × {item.quantity}
                          </span>
                          {item.selected_options?.length ? (
                            <div className="cx-order-item-options">
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
                    <div className="cx-order-offers">
                      {order.applied_offers.map((offer) => (
                        <p key={`${order.id}-${offer.offer_type}-${offer.name}`}>
                          {offer.badge_text || offer.name} saved Rs. {Number(offer.discount_amount).toFixed(2)}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {order.review ? (
                    <div className="cx-review-card">
                      <div className="cx-review-card-head">
                        <Star size={16} strokeWidth={2.1} />
                        <strong>{Number(order.review.average_rating).toFixed(1)} / 5</strong>
                      </div>
                      <p>
                        Food {order.review.food_quality}/5 · Service {order.review.service}/5 · Overall{" "}
                        {order.review.overall_experience}/5
                      </p>
                      {order.review.comment ? <p>{order.review.comment}</p> : null}
                    </div>
                  ) : null}
                  <div className="cx-order-actions">
                    {order.billing_status !== "paid" && order.billing_status !== "refunded" ? (
                      <Link to={`/billing/${order.id}`} state={{ order }} className="cx-order-pay-link">
                        Payment / receipt →
                      </Link>
                    ) : null}
                    {order.status === "served" && !order.review ? (
                      <button type="button" className="cx-order-review-btn" onClick={() => openReview(order)}>
                        Leave a review
                      </button>
                    ) : null}
                  </div>
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

      {reviewingOrder ? (
        <div className="cx-modal-backdrop" role="dialog" aria-modal="true">
          <div className="cx-modal-card">
            <div className="cx-modal-head">
              <div>
                <p className="cx-modal-kicker">Review order #{reviewingOrder.id}</p>
                <h2>Share your experience</h2>
              </div>
              <button type="button" className="cx-modal-close" onClick={() => setReviewingOrder(null)} aria-label="Close">
                ×
              </button>
            </div>
            <form className="cx-review-form" onSubmit={submitReview}>
              <label className="cx-review-field">
                <span>Food quality</span>
                <select
                  value={reviewForm.food_quality}
                  onChange={(event) =>
                    setReviewForm((current) => ({ ...current, food_quality: Number(event.target.value) }))
                  }
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label className="cx-review-field">
                <span>Service</span>
                <select
                  value={reviewForm.service}
                  onChange={(event) =>
                    setReviewForm((current) => ({ ...current, service: Number(event.target.value) }))
                  }
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label className="cx-review-field">
                <span>Overall experience</span>
                <select
                  value={reviewForm.overall_experience}
                  onChange={(event) =>
                    setReviewForm((current) => ({ ...current, overall_experience: Number(event.target.value) }))
                  }
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label className="cx-review-field">
                <span>Comment (optional)</span>
                <textarea
                  rows={4}
                  value={reviewForm.comment}
                  onChange={(event) =>
                    setReviewForm((current) => ({ ...current, comment: event.target.value }))
                  }
                  placeholder="Tell the restaurant what stood out."
                />
              </label>
              {reviewError ? <p className="cx-form-error">{reviewError}</p> : null}
              <div className="cx-review-actions">
                <button type="button" className="cx-btn-secondary" onClick={() => setReviewingOrder(null)}>
                  Cancel
                </button>
                <button type="submit" className="cx-btn-block" disabled={reviewBusy}>
                  {reviewBusy ? "Submitting…" : "Submit review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
