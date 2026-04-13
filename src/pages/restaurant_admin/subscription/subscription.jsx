import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./subscription.css";
import { authFetch, API_BASE } from "../../../lib/api";
import { clearAuth, getRestaurantName, getSubscriptionStatus, setUserSession } from "../../../lib/auth";
import { submitEpayV2Form } from "../../customer/Billing";

const PENDING_SUB_PAYMENT_KEY = "mm_subscription_payment_id";

export default function Subscription() {
  const navigate = useNavigate();
  const location = useLocation();
  const restaurantName = getRestaurantName();
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const esewaState = (params.get("esewa") || "").trim();
  const paymentIdFromUrl = (params.get("payment_id") || "").trim();

  const load = async () => {
    try {
      const [plansRes, currentRes] = await Promise.all([
        authFetch(`${API_BASE}/api/restaurants/subscription/plans/`),
        authFetch(`${API_BASE}/api/restaurants/subscription/current/`),
      ]);
      const plansData = await plansRes.json().catch(() => []);
      const currentData = await currentRes.json().catch(() => ({}));
      if (!plansRes.ok || !currentRes.ok) {
        setError(currentData.error || "Could not load subscription details.");
        return;
      }
      setPlans(Array.isArray(plansData) ? plansData : []);
      setSummary(currentData);
      setUserSession({
        restaurant: currentData.restaurant_name,
        restaurant_active: currentData.restaurant_active,
        subscription_status: currentData.subscription_status,
      });
    } catch {
      setError("Network error while loading subscription details.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!esewaState) return;
    const storedPaymentId = sessionStorage.getItem(PENDING_SUB_PAYMENT_KEY) || "";
    const resolvedPaymentId = paymentIdFromUrl || storedPaymentId;
    if (esewaState === "failure") {
      setMessage("Subscription payment was not completed. You can retry anytime.");
      return;
    }
    if (!resolvedPaymentId) {
      setError("Missing subscription payment reference. Please try paying again.");
      return;
    }
    const verify = async () => {
      setBusyId(`verify:${resolvedPaymentId}`);
      try {
        const res = await authFetch(`${API_BASE}/api/restaurants/subscription/verify/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_id: resolvedPaymentId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not verify subscription payment.");
          return;
        }
        setSummary(data);
        setUserSession({
          restaurant: data.restaurant_name,
          restaurant_active: data.restaurant_active,
          subscription_status: data.subscription_status,
        });
        if (data.paid) {
          sessionStorage.removeItem(PENDING_SUB_PAYMENT_KEY);
          setMessage("Subscription activated successfully. Your restaurant is now live.");
        } else if (data.pending) {
          setMessage("Payment is still being confirmed. Refresh or retry verification in a moment.");
        } else {
          setMessage("Payment was not successful. You can choose a plan and try again.");
        }
      } catch {
        setError("Network error while verifying subscription payment.");
      } finally {
        setBusyId("");
      }
    };
    verify();
  }, [esewaState, paymentIdFromUrl]);

  const startCheckout = async (planId) => {
    setBusyId(`checkout:${planId}`);
    setError("");
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/restaurants/subscription/checkout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not start subscription checkout.");
        return;
      }
      sessionStorage.setItem(PENDING_SUB_PAYMENT_KEY, String(data.payment_id));
      submitEpayV2Form(data.form_url ?? data.formUrl, data.fields, { bypassSubmitGuard: true });
    } catch {
      setError("Network error while starting checkout.");
    } finally {
      setBusyId("");
    }
  };

  const goToDashboard = () => navigate("/restaurant-admin");
  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  const currentPlanId = summary?.current_subscription?.plan?.id;
  const isActive = Boolean(summary?.restaurant_active);
  const currentStatus = summary?.subscription_status || getSubscriptionStatus();

  return (
    <div className="mm-subscription">
      <header className="mm-subscription__hero">
        <div>
          <p className="mm-subscription__eyebrow">Subscription</p>
          <h1>Activate your restaurant</h1>
          <p className="mm-subscription__restaurant">{restaurantName || "Your restaurant"}</p>
          <p className="mm-subscription__lead">
            Choose a MenuMelt subscription plan and pay with eSewa to unlock the full restaurant admin experience.
          </p>
        </div>
        <div className="mm-subscription__hero-actions">
          {isActive ? (
            <button type="button" className="mm-subscription__btn mm-subscription__btn--primary" onClick={goToDashboard}>
              Open dashboard
            </button>
          ) : null}
          <button type="button" className="mm-subscription__btn mm-subscription__btn--ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {error ? <div className="mm-subscription__banner mm-subscription__banner--err">{error}</div> : null}
      {message ? <div className="mm-subscription__banner mm-subscription__banner--ok">{message}</div> : null}

      <section className="mm-subscription__status">
        <div className="mm-subscription__status-card">
          <span>Status</span>
          <strong>{String(currentStatus).replaceAll("_", " ")}</strong>
        </div>
        <div className="mm-subscription__status-card">
          <span>Current plan</span>
          <strong>{summary?.current_subscription?.plan?.name || "None yet"}</strong>
        </div>
        <div className="mm-subscription__status-card">
          <span>Access</span>
          <strong>{isActive ? "Unlocked" : "Subscription required"}</strong>
        </div>
      </section>

      <section className="mm-subscription__plans">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id && isActive;
          return (
            <article key={plan.id} className={`mm-subscription__plan ${isCurrent ? "is-current" : ""}`}>
              <div className="mm-subscription__plan-top">
                <div>
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                </div>
                <span>{plan.duration_days} days</span>
              </div>
              <p className="mm-subscription__price">Rs. {Number(plan.price).toFixed(2)}</p>
              <button
                type="button"
                className="mm-subscription__btn mm-subscription__btn--primary"
                disabled={isCurrent || busyId === `checkout:${plan.id}`}
                onClick={() => startCheckout(plan.id)}
              >
                {isCurrent ? "Current plan" : busyId === `checkout:${plan.id}` ? "Redirecting…" : "Pay with eSewa"}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
