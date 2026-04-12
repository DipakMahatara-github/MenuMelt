import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Minus, Plus, ShoppingCart } from "lucide-react";
import { loadCart, saveCart } from "../../lib/customerCart";
import { API_BASE } from "../../lib/api";
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

  useEffect(() => {
    ensureCustomerSession();
    setRestaurantName(getCustomerRestaurantName());
    setCart(loadCart());
  }, []);

  const persist = (next) => {
    setCart(next);
    saveCart(next);
  };

  const total = useMemo(
    () => cart.reduce((s, l) => s + Number(l.price) * l.quantity, 0),
    [cart]
  );

  const adjust = (lineKey, delta) => {
    persist(
      cart
        .map((l) => (l.lineKey === lineKey ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
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

          <div className="cx-cart-total">
            <span>Total</span>
            <strong>Rs. {total.toFixed(2)}</strong>
          </div>

          <div className="cx-secondary-actions">
            <button
              type="button"
              className="cx-btn-block"
              disabled={cart.length === 0}
              onClick={() => navigate("/checkout")}
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
