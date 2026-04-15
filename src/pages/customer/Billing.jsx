import { useEffect, useLayoutEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { authFetch, API_BASE } from "../../lib/api";
import "./Billing.css";

let esewaSubmitCoalesce = false;

export function submitEpayV2Form(formUrl, fields, opts = {}) {
  if (!formUrl || typeof formUrl !== "string") {
    throw new Error("Missing eSewa form URL");
  }
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new Error("Missing or invalid eSewa form fields");
  }

  const run = () => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = formUrl;
    form.enctype = "application/x-www-form-urlencoded";
    form.acceptCharset = "UTF-8";
    form.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;opacity:0;";
    form.setAttribute("target", "_self");

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value == null ? "" : String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  };

  if (opts.bypassSubmitGuard) {
    run();
    return;
  }

  if (esewaSubmitCoalesce) {
    return;
  }
  esewaSubmitCoalesce = true;
  queueMicrotask(() => {
    esewaSubmitCoalesce = false;
    run();
  });
}

export default function Billing() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [error, setError] = useState("");
  const [esewaWarning, setEsewaWarning] = useState("");
  const [busy, setBusy] = useState(false);
  const [epayPayload, setEpayPayload] = useState(null);
  const [epayFormNonce, setEpayFormNonce] = useState(0);

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

  useLayoutEffect(() => {
    if (!epayPayload) return;
    try {
      submitEpayV2Form(epayPayload.formUrl, epayPayload.fields);
    } catch (e) {
      console.error(e);
    }
  }, [epayPayload, epayFormNonce]);

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

  const payEsewa = async () => {
    setError("");
    setEsewaWarning("");
    setEpayPayload(null);
    setBusy(true);
    let redirecting = false;
    try {
      const res = await authFetch(`${API_BASE}/api/orders/${orderId}/pay-esewa/`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.detail || "eSewa is not available.");
        return;
      }

      const formUrl = data.form_url ?? data.formUrl;
      const fields = data.fields;
      const method = String(data.method ?? "POST").toUpperCase();
      if (method !== "POST") {
        setError("Invalid payment configuration.");
        return;
      }
      if (!formUrl || !fields || typeof fields !== "object" || Array.isArray(fields)) {
        setError("Invalid response from server. Missing eSewa form data.");
        return;
      }

      if (Array.isArray(data.warnings) && data.warnings.length) {
        setEsewaWarning(data.warnings.join(" "));
      }

      try {
        const oid = String(data.order_id ?? orderId ?? "").trim();
        if (oid) {
          sessionStorage.setItem("mm_esewa_pending_order_id", oid);
        }
      } catch {
        /* ignore */
      }

      redirecting = true;
      setEpayFormNonce((current) => current + 1);
      setEpayPayload({ formUrl, fields });
    } catch (e) {
      console.error(e);
      setError("Network error.");
    } finally {
      if (!redirecting) setBusy(false);
    }
  };

  const handleEsewaContinueClick = () => {
    if (!epayPayload) return;
    try {
      submitEpayV2Form(epayPayload.formUrl, epayPayload.fields, { bypassSubmitGuard: true });
    } catch (e) {
      console.error(e);
      setError("Could not open eSewa. Please try again.");
      setEpayPayload(null);
      setBusy(false);
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
          {esewaWarning ? (
            <p className="cx-billing-error" role="status">
              {esewaWarning}
            </p>
          ) : null}

          {epayPayload ? (
            <p className="cx-billing-esewa-wait" role="status">
              Redirecting to eSewa…
            </p>
          ) : null}

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
              onClick={payEsewa}
            >
              Pay with eSewa
            </button>
            {epayPayload ? (
              <button type="button" className="cx-btn-secondary" onClick={handleEsewaContinueClick}>
                Open eSewa (if you were not redirected)
              </button>
            ) : null}
            <Link to="/my-orders" className="cx-billing-link">
              View my orders
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
