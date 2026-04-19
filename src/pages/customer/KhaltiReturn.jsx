import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { authFetch, API_BASE } from "../../lib/api";
import "./KhaltiReturn.css";

const POLL_MS = 2000;
const MAX_POLL_ATTEMPTS = 5;

export default function KhaltiReturn() {
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const pidx = query.get("pidx");
  const purchaseOrderId = query.get("purchase_order_id");

  const [phase, setPhase] = useState(pidx ? "verifying" : "failed");
  const [msg, setMsg] = useState(pidx ? "Verifying payment…" : "Missing payment reference.");
  const [detail, setDetail] = useState(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!pidx) return;

    let cancelled = false;

    const runVerify = async () => {
      if (cancelled) return;
      attemptRef.current += 1;
      setPhase("verifying");

      try {
        const res = await authFetch(`${API_BASE}/api/orders/verify-khalti/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pidx }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (data.paid === true) {
          setPhase("paid");
          setMsg("Payment successful. Thank you!");
          setDetail(data.order || null);
          return;
        }

        if (attemptRef.current < MAX_POLL_ATTEMPTS) {
          setTimeout(runVerify, POLL_MS);
        } else {
          setPhase("failed");
          setMsg("We could not confirm your payment. Please check My Orders or ask the cashier.");
        }
      } catch (e) {
        if (cancelled) return;
        if (attemptRef.current < MAX_POLL_ATTEMPTS) {
          setTimeout(runVerify, POLL_MS);
        } else {
          setPhase("failed");
          setMsg("Network error during verification. Please check My Orders.");
        }
      }
    };

    runVerify();

    return () => {
      cancelled = true;
    };
  }, [pidx]);

  return (
    <div className="cx-shell">
      <div className="cx-phone cx-khalti-center">
        <section className="cx-card cx-khalti-card" aria-busy={phase === "verifying"}>
          <h1 className="cx-khalti-title">Khalti Payment</h1>
          <p className="cx-khalti-msg">{msg}</p>
          {phase === "verifying" ? (
            <p className="cx-khalti-hint" role="status">
              Please wait while we confirm your transaction...
            </p>
          ) : null}
          {detail ? (
            <p className="cx-khalti-detail">
              Order #{detail.id} · Rs. {Number(detail.total_price).toFixed(2)}
            </p>
          ) : null}
          <div className="cx-khalti-actions">
            <Link to="/my-orders" className="cx-btn-block">
              My orders
            </Link>
            <Link to="/menu" className="cx-khalti-secondary">
              Back to menu
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
