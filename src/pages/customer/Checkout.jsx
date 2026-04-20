import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { authFetch, API_BASE } from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { clearCart, loadCart } from "../../lib/customerCart";
import { ensureCustomerSession, getCustomerRestaurantName } from "../../lib/customerSession";
import "./Checkout.css";

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restaurantName, setRestaurantName] = useState(() => getCustomerRestaurantName());
  const [quote, setQuote] = useState(location.state?.quote || null);

  useEffect(() => {
    ensureCustomerSession();
    setRestaurantName(getCustomerRestaurantName());
  }, []);

  const cart = loadCart();
  const localTotal = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0),
    [cart]
  );

  useEffect(() => {
    const fetchQuote = async () => {
      if (!cart.length) {
        setQuote(null);
        return;
      }
      try {
        const res = await authFetch(`${API_BASE}/api/orders/quote/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart.map((line) => ({
              menu_item: Number(line.id),
              quantity: line.quantity,
              selected_option_ids: line.selectedOptionIds || [],
            })),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setQuote(data);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchQuote();
  }, [cart]);

  const placeOrder = async (e) => {
    e.preventDefault();
    setError("");
    if (!sessionStorage.getItem("table_token")) {
      setError("Missing table. Scan the QR code again.");
      return;
    }
    if (!cart.length) {
      setError("Your cart is empty.");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name.");
      return;
    }

    setBusy(true);
    ensureCustomerSession();
    try {
      const res = await authFetch(`${API_BASE}/api/orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: trimmed,
          items: cart.map((line) => ({
            menu_item: Number(line.id),
            quantity: line.quantity,
            selected_option_ids: line.selectedOptionIds || [],
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiError(data));
        return;
      }
      clearCart();
      navigate(`/billing/${data.id}`, { state: { order: data } });
    } catch (err) {
      console.error(err);
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!sessionStorage.getItem("table_token")) {
    return (
      <div className="cx-shell">
        <div className="cx-phone">
          <div className="cx-gate">
            <p>Scan the table QR to place an order.</p>
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
      <div className="cx-phone">
        <section className="cx-card">
          <header className="cx-page-header">
            <button type="button" className="cx-icon-btn" onClick={() => navigate(-1)} aria-label="Back">
              <ChevronLeft size={20} strokeWidth={2.2} />
            </button>
            <div className="cx-checkout-heading">
              {restaurantName ? <p className="cx-checkout-restaurant">{restaurantName}</p> : null}
              <h1>Checkout</h1>
            </div>
            <span className="cx-page-spacer" aria-hidden />
          </header>

          <div className="cx-checkout-summary">
            Total <strong>Rs. {Number(quote?.total_price || localTotal).toFixed(2)}</strong>
            <br />
            <span>
              {cart.length} line{cart.length === 1 ? "" : "s"} in your cart
            </span>
          </div>

          {(quote?.discount_total || 0) > 0 ? (
            <div className="cx-checkout-discount">
              <span>Offers applied</span>
              <strong>- Rs. {Number(quote.discount_total).toFixed(2)}</strong>
            </div>
          ) : null}

          {(quote?.tax_total || 0) > 0 ? (
            <div className="cx-checkout-discount">
              <span>VAT (13%)</span>
              <strong>+ Rs. {Number(quote.tax_total).toFixed(2)}</strong>
            </div>
          ) : null}

          <div className="cx-checkout-lines">
            {cart.map((line) => (
              <div key={line.lineKey} className="cx-checkout-line">
                <div>
                  <strong>{line.label}</strong>
                  {line.selectedOptions?.length ? (
                    <p>
                      {line.selectedOptions.map((option) => `${option.group_name}: ${option.option_name}`).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <span>x {line.quantity}</span>
              </div>
            ))}
          </div>

          <form className="cx-form" onSubmit={placeOrder}>
            <label className="cx-label" htmlFor="checkout-name">
              Name on the order
              <input
                id="checkout-name"
                className="cx-input"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="How should we call you?"
                autoComplete="name"
              />
            </label>
            {error ? <p className="cx-form-error">{error}</p> : null}
            <button type="submit" className="cx-btn-block" disabled={busy}>
              {busy ? "Placing order…" : "Place order"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
