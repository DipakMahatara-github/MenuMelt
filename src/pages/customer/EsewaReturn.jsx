import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { authFetch, API_BASE } from "../../lib/api";
import "./EsewaReturn.css";

const POLL_MS = 2000;
const MAX_POLL_ATTEMPTS = 45;

const PENDING_ORDER_STORAGE_KEY = "mm_esewa_pending_order_id";

function readPendingOrderIdFromSession() {
  try {
    if (typeof sessionStorage === "undefined") return "";
    return (sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

/** Prefer real browser query string after eSewa redirect (full page load). */
function readRedirectQueryString(routerSearch) {
  if (typeof window !== "undefined" && window.location.search) {
    return window.location.search;
  }
  return routerSearch || "";
}

function parseRedirectParams(routerSearch) {
  const raw = readRedirectQueryString(routerSearch);
  const q = raw.startsWith("?") ? raw.slice(1) : raw;
  return new URLSearchParams(q);
}

export default function EsewaReturn({ variant }) {
  const { search: routerSearch } = useLocation();

  const { canVerify, resolvedOrderId } = useMemo(() => {
    const p = parseRedirectParams(routerSearch);
    const encodedDataFromURL = (p.get("data") || "").trim();
    const txn = (p.get("transaction_uuid") || p.get("transactionUuid") || "").trim();
    const oidFromUrl = (p.get("order_id") || "").trim();
    const oidFromSession = oidFromUrl ? "" : readPendingOrderIdFromSession();
    const resolved = oidFromUrl || oidFromSession;
    return {
      resolvedOrderId: resolved,
      canVerify:
        variant === "success" &&
        (Boolean(encodedDataFromURL) || Boolean(txn) || Boolean(resolved)),
    };
  }, [variant, routerSearch]);

  const [phase, setPhase] = useState(canVerify ? "verifying" : "failed");
  const [msg, setMsg] = useState(() => {
    if (variant !== "success") return "Payment was not completed.";
    if (!canVerify) {
      return "Missing payment reference (eSewa did not return data in the URL). Open My orders to check status, or try paying again after updating the app.";
    }
    return "Verifying payment…";
  });
  const [detail, setDetail] = useState(null);
  const attemptRef = useRef(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!canVerify) return;

    let cancelled = false;

    const clearTimer = () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const scheduleRetry = () => {
      if (cancelled) return;
      if (attemptRef.current >= MAX_POLL_ATTEMPTS) {
        clearTimer();
        try {
          sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setPhase("failed");
        setMsg(
          "We could not confirm your payment in time. Check My orders or ask staff if the amount was deducted."
        );
        return;
      }
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        runVerify();
      }, POLL_MS);
    };

    const runVerify = async () => {
      if (cancelled) return;
      attemptRef.current += 1;
      setPhase("verifying");
      setMsg(
        attemptRef.current > 1
          ? "Still confirming payment with eSewa…"
          : "Verifying payment…"
      );

      const p = parseRedirectParams(routerSearch);
      const encodedDataFromURL = (p.get("data") || "").trim();
      const txn = (p.get("transaction_uuid") || p.get("transactionUuid") || "").trim();
      const oidFromUrl = (p.get("order_id") || "").trim();
      const oid = (oidFromUrl || readPendingOrderIdFromSession() || resolvedOrderId || "").trim();

      let body;
      if (encodedDataFromURL) {
        body = JSON.stringify({ data: encodedDataFromURL });
      } else if (txn) {
        body = JSON.stringify({
          transaction_uuid: txn,
          total_amount: p.get("total_amount") || p.get("totalAmount") || undefined,
          product_code: p.get("product_code") || p.get("productCode") || undefined,
        });
      } else {
        body = "{}";
      }

      const useGlobal = Boolean(encodedDataFromURL || txn);
      if (!useGlobal && !oid) {
        clearTimer();
        setPhase("failed");
        setMsg(
          "Missing payment reference. Open My orders to check status, or pay again from Billing."
        );
        return;
      }

      const verifyUrl = useGlobal
        ? `${API_BASE}/api/orders/verify-esewa/`
        : `${API_BASE}/api/orders/${encodeURIComponent(oid)}/verify-esewa/`;

      try {
        const res = await authFetch(verifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (data.paid === true) {
          clearTimer();
          try {
            sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          setPhase("paid");
          setMsg("Payment successful. Thank you!");
          setDetail(data.order || null);
          return;
        }

        if (data.pending === true) {
          scheduleRetry();
          return;
        }

        if (!res.ok && (res.status === 400 || res.status === 403)) {
          clearTimer();
          try {
            sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          setPhase("failed");
          setMsg(
            data.detail ||
              data.error ||
              "Could not verify this payment (missing table session or wrong order). Open My orders from the table QR menu, or pay again from Billing."
          );
          return;
        }

        if (!res.ok && res.status >= 500) {
          if (attemptRef.current >= MAX_POLL_ATTEMPTS) {
            clearTimer();
            try {
              sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
            } catch {
              /* ignore */
            }
            setPhase("failed");
            setMsg(data.error || "Could not verify payment. Check My orders or ask staff.");
            return;
          }
          scheduleRetry();
          return;
        }

        clearTimer();
        try {
          sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setPhase("failed");
        let text =
          data.error ||
          (!res.ok
            ? `Verification failed (${res.status}).`
            : "Payment not confirmed. You can retry from your order or ask staff.");
        if (data.debug && typeof data.debug === "object") {
          text = `${text} (${JSON.stringify(data.debug)})`;
        }
        setMsg(text);
      } catch {
        if (cancelled) return;
        if (attemptRef.current >= MAX_POLL_ATTEMPTS) {
          try {
            sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          setPhase("failed");
          setMsg("Could not verify payment. Check My orders or ask staff.");
          return;
        }
        scheduleRetry();
      }
    };

    attemptRef.current = 0;
    runVerify();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [variant, canVerify, routerSearch, resolvedOrderId]);

  return (
    <div className="cx-shell">
      <div className="cx-phone cx-esewa-center">
        <section className="cx-card cx-esewa-card" aria-busy={phase === "verifying"}>
          <h1 className="cx-esewa-title">{variant === "success" ? "eSewa" : "Payment"}</h1>
          <p className="cx-esewa-msg">{msg}</p>
          {phase === "verifying" ? (
            <p className="cx-esewa-hint" role="status">
              This can take a few seconds after you return from eSewa.
            </p>
          ) : null}
          {detail ? (
            <p className="cx-esewa-detail">
              Order #{detail.id} · Rs. {Number(detail.total_price).toFixed(2)}
            </p>
          ) : null}
          <div className="cx-esewa-actions">
            <Link to="/my-orders" className="cx-btn-block">
              My orders
            </Link>
            <Link to="/menu" className="cx-esewa-secondary">
              Back to menu
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
