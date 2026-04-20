import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Minus, Plus, ShoppingCart } from "lucide-react";
import { loadCart, saveCart } from "../../lib/customerCart";
import { authFetch, API_BASE } from "../../lib/api";
import { ensureCustomerSession, getCustomerRestaurantName } from "../../lib/customerSession";
import "./Cart.css";

function dishImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

export default function Cart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [restaurantName, setRestaurantName] = useState(() => getCustomerRestaurantName());
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");

  useEffect(() => {
    ensureCustomerSession();
    setRestaurantName(getCustomerRestaurantName());
    setCart(loadCart());
  }, []);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!cart.length) {
        setQuote(null);
        setQuoteError("");
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
        if (!res.ok) {
          setQuote(null);
          setQuoteError(data.error || data.detail || "Could not calculate the latest total.");
          return;
        }
        setQuote(data);
        setQuoteError("");
      } catch (error) {
        console.error(error);
        setQuote(null);
        setQuoteError("Could not calculate the latest total.");
      }
    };

    fetchQuote();
  }, [cart]);

  const persist = (next) => {
    setCart(next);
    saveCart(next);
  };

  const localTotal = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0),
    [cart]
  );

  const adjust = (lineKey, delta) => {
    persist(
      cart
        .map((line) => (line.lineKey === lineKey ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0)
    );
  };

  if (!sessionStorage.getItem("table_token")) {
    return (
      <div className="cx-shell">
        <div className="cx-phone">
          <div className="cx-gate">
            <p>Scan your table QR code to start ordering.</p>
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
      <div className="cx-phone cx-cart-page">
        <section className="cx-card">
          <header className="cx-page-header">
            <button type="button" className="cx-icon-btn" onClick={() => navigate(-1)} aria-label="Back">
              <ChevronLeft size={20} strokeWidth={2.2} />
            </button>
            <div className="cx-cart-heading">
              {restaurantName ? <p className="cx-cart-restaurant">{restaurantName}</p> : null}
              <h1>Your cart</h1>
            </div>
            <span className="cx-page-spacer" aria-hidden />
          </header>

          <div className="cx-cart-lines">
            {cart.length === 0 ? (
              <p className="cx-cart-empty">Your cart is empty.</p>
            ) : (
              cart.map((item) => (
                <article key={item.lineKey} className="cx-cart-line">
                  {item.image ? (
                    <img src={dishImageUrl(item.image)} alt="" />
                  ) : (
                    <div className="cx-cart-line-ph" aria-hidden />
                  )}
                  <div className="cx-cart-line-meta">
                    <p className="cx-cart-line-name">{item.label}</p>
                    {item.selectedOptions?.length ? (
                      <div className="cx-cart-line-options">
                        {item.selectedOptions.map((option) => (
                          <span key={`${item.lineKey}-${option.group_name}-${option.option_name}`}>
                            {option.group_name}: {option.option_name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="cx-cart-line-price">Rs. {Number(item.price).toFixed(2)} each</p>
                    <div className="cx-cart-qty">
                      <button type="button" onClick={() => adjust(item.lineKey, -1)} aria-label="Decrease">
                        <Minus size={14} />
                      </button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => adjust(item.lineKey, 1)} aria-label="Increase">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          {quoteError ? <p className="cx-form-error">{quoteError}</p> : null}

          <div className="cx-cart-total">
            <span>Subtotal</span>
            <strong>Rs. {Number(quote?.subtotal_price || localTotal).toFixed(2)}</strong>
          </div>
          {(quote?.discount_total || 0) > 0 ? (
            <div className="cx-cart-total cx-cart-total--discount">
              <span>Offers applied</span>
              <strong>- Rs. {Number(quote.discount_total).toFixed(2)}</strong>
            </div>
          ) : null}
          {(quote?.tax_total || 0) > 0 ? (
            <div className="cx-cart-total">
              <span>VAT (13%)</span>
              <strong>+ Rs. {Number(quote.tax_total).toFixed(2)}</strong>
            </div>
          ) : null}
          <div className="cx-cart-total">
            <span>Total</span>
            <strong>Rs. {Number(quote?.total_price || localTotal).toFixed(2)}</strong>
          </div>

          {quote?.applied_offers?.length ? (
            <div className="cx-cart-offers">
              {quote.applied_offers.map((offer) => (
                <p key={`${offer.offer_type}-${offer.name}`}>
                  {offer.badge_text || offer.name} saved Rs. {Number(offer.discount_amount).toFixed(2)}
                </p>
              ))}
            </div>
          ) : null}

          <div className="cx-secondary-actions">
            <button
              type="button"
              className="cx-btn-block"
              disabled={cart.length === 0}
              onClick={() => navigate("/checkout", { state: { quote } })}
            >
              Checkout
            </button>
            <Link to="/menu" className="cx-link-quiet">
              Continue browsing menu
            </Link>
          </div>
        </section>

        <div className="cx-footer-pill">
          <Link to="/my-orders">
            <ShoppingCart size={18} strokeWidth={2.2} />
            <span>My orders</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
