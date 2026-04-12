import { useEffect, useLayoutEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { authFetch, API_BASE } from "../../lib/api";
import "./Billing.css";

/** Coalesce duplicate submits in the same JS turn (e.g. React 18 Strict Mode double layout effect). */
let esewaSubmitCoalesce = false;

/**
 * Full-page redirect to eSewa ePay v2: POST via a real HTML form (not fetch / not window.location).
 * All field names and values must match the backend signature exactly.
 *
 * @param {{ bypassSubmitGuard?: boolean }} [opts] — use bypassSubmitGuard: true for a manual retry so
 *        coalescing does not skip the second intentional submit.
 */
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

    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value == null ? "" : String(value);
      form.appendChild(input);
    }

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
  /** Set after /pay-esewa/ succeeds; triggers DOM form + submit (avoids SPA re-render racing navigation). */
  const [epayPayload, setEpayPayload] = useState(null);
  /** Bumps when a new eSewa payload arrives so the <form> remounts (fresh hidden fields; safe Strict Mode + retries). */
  const [epayFormNonce, setEpayFormNonce] = useState(0);

  useEffect(() => {
    if (order || !orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/orders/my/`);
        const list = await res.json();
        if (!res.ok || cancelled) return;
        const found = Array.isArray(list) ? list.find((o) => String(o.id) === String(orderId)) : null;
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
        state: { flash: "You chose pay at counter. Show staff your order number." },
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
        const w = data.warnings.join(" ");
        console.warn("eSewa:", w);
        setEsewaWarning(w);
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
      // Render a real <form> in the document, then submit in useLayoutEffect so navigation
      // is not interrupted by React state updates (e.g. setBusy(false) in finally).
      setEpayFormNonce((n) => n + 1);
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
            <p className="cx-billing-total">
              Rs. <span>{Number(order.total_price).toFixed(2)}</span>
            </p>
          </div>

          <ul className="cx-line-items">
            {(order.items || []).map((it) => (
              <li key={it.id} className="cx-line-item">
                <span>
                  {it.item_name} × {it.quantity}
                </span>
                <span>Rs. {(Number(it.price) * it.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>

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
            <button type="button" className="cx-btn-secondary" disabled={busy} onClick={payCash}>
              Pay at counter
            </button>
            <button type="button" className="cx-btn-block" disabled={busy} onClick={payEsewa}>
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
