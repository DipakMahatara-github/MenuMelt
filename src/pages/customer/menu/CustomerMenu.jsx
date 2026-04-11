import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Loader2,
  Minus,
  Plus,
  ScanLine,
  Search,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { authFetch, API_BASE } from "../../../lib/api";
import "./CustomerMenu.css";

const ORDERS_PLACE_API = `${API_BASE}/api/orders/place/`;

function dishImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

function itemLabel(item) {
  if (item?.display_name) return item.display_name;
  const v = (item?.variant_label || "").trim();
  return v ? `${item.name} · ${v}` : item.name;
}

function formatRs(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "0.00";
  return x.toFixed(2);
}

export default function CustomerMenu() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [hasTableToken, setHasTableToken] = useState(
    () => typeof sessionStorage !== "undefined" && !!sessionStorage.getItem("table_token")
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [detailItem, setDetailItem] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const showToast = useCallback((type, text) => {
    setToast(text ? { type, text } : null);
    if (text) window.setTimeout(() => setToast(null), 5200);
  }, []);

  useEffect(() => {
    const token = searchParams.get("table_token");
    const tableFromUrl = searchParams.get("table") || id;

    if (token) sessionStorage.setItem("table_token", token);
    if (tableFromUrl) sessionStorage.setItem("table", tableFromUrl);
    setHasTableToken(!!sessionStorage.getItem("table_token"));
  }, [id, searchParams]);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setLoading(true);
        const res = await authFetch(`${API_BASE}/api/menu/`);
        const data = await res.json();

        if (Array.isArray(data)) {
          setItems(data);
        } else if (Array.isArray(data?.results)) {
          setItems(data.results);
        } else {
          setItems([]);
        }
      } catch (error) {
        console.error("Menu fetch error:", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    if (!sessionStorage.getItem("table_token")) {
      setLoading(false);
      return;
    }

    fetchMenu();
  }, [hasTableToken]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setDetailItem(null);
        setCartOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const categories = useMemo(() => {
    const map = new Map();
    for (const row of items) {
      const cid = row.category;
      const name = (row.category_name || "Menu").trim() || "Menu";
      if (cid != null && !map.has(cid)) map.set(cid, { id: cid, name });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeCategory !== "all") {
      list = list.filter((i) => String(i.category) === String(activeCategory));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          (i.name || "").toLowerCase().includes(q) ||
          (i.variant_label || "").toLowerCase().includes(q) ||
          (i.display_name || "").toLowerCase().includes(q) ||
          (i.description || "").toLowerCase().includes(q) ||
          (i.category_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, activeCategory, searchQuery]);

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const totalAmount = cart.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);

  const getQtyInCart = (menuItemId) => cart.find((c) => c.lineKey === String(menuItemId))?.quantity || 0;

  const addToCart = (item, delta = 1) => {
    const lineKey = String(item.id);
    const unit = Number(item.price);
    const existing = cart.find((c) => c.lineKey === lineKey);
    if (delta < 0 && existing) {
      const next = existing.quantity + delta;
      if (next <= 0) {
        setCart(cart.filter((c) => c.lineKey !== lineKey));
        return;
      }
      setCart(cart.map((c) => (c.lineKey === lineKey ? { ...c, quantity: next } : c)));
      return;
    }
    if (existing) {
      setCart(
        cart.map((c) => (c.lineKey === lineKey ? { ...c, quantity: c.quantity + delta } : c))
      );
      return;
    }
    if (delta > 0) {
      setCart([
        ...cart,
        {
          lineKey,
          id: item.id,
          label: itemLabel(item),
          image: item.image,
          price: unit,
          quantity: delta,
        },
      ]);
    }
  };

  const setLineQuantity = (lineKey, qty) => {
    const q = Math.max(0, Math.min(99, Math.floor(Number(qty))));
    if (q === 0) {
      setCart(cart.filter((c) => c.lineKey !== lineKey));
      return;
    }
    setCart(cart.map((c) => (c.lineKey === lineKey ? { ...c, quantity: q } : c)));
  };

  const submitOrder = async () => {
    if (!cart.length || orderSubmitting) return;
    setOrderSubmitting(true);
    try {
      const res = await authFetch(ORDERS_PLACE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((c) => ({ menu_item: c.id, quantity: c.quantity })),
        }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        /* ignore */
      }
      if (res.ok) {
        setCart([]);
        setCartOpen(false);
        showToast("success", `Order #${data.order_id} sent. The kitchen has your order.`);
      } else {
        showToast("error", data.error || data.detail || "Could not place order.");
      }
    } catch {
      showToast("error", "Network error. Try again.");
    } finally {
      setOrderSubmitting(false);
    }
  };

  const tableHint = sessionStorage.getItem("table");

  if (!hasTableToken) {
    return (
      <div className="cm-page">
        <div className="cm-mesh" aria-hidden />
        <div className="cm-gate">
          <div className="cm-gate-icon">
            <ScanLine size={40} strokeWidth={1.25} />
          </div>
          <h1 className="cm-gate-title">Scan to order</h1>
          <p className="cm-gate-text">
            Open this page using the QR code on your table so we know where to bring your food.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cm-page">
        <div className="cm-mesh" aria-hidden />
        <div className="cm-loading">
          <div className="cm-loading-orbit" aria-hidden />
          <Loader2 className="cm-loading-icon" size={28} aria-hidden />
          <p className="cm-loading-text">Loading your menu…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cm-page">
      <div className="cm-mesh" aria-hidden />
      <div className="cm-grid-bg" aria-hidden />

      {toast ? (
        <div className={`cm-toast cm-toast--${toast.type}`} role="status">
          {toast.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{toast.text}</span>
        </div>
      ) : null}

      <div className="cm-shell">
        <header className="cm-header">
          <div className="cm-brand">
            <span className="cm-brand-mark">
              <UtensilsCrossed size={20} strokeWidth={2} />
            </span>
            <div>
              <p className="cm-brand-kicker">MenuMelt</p>
              <h1 className="cm-brand-title">Taste mode</h1>
            </div>
          </div>
          {tableHint ? (
            <div className="cm-table-pill">
              <span className="cm-table-pill-label">Table</span>
              <span className="cm-table-pill-value">{tableHint}</span>
            </div>
          ) : null}
        </header>

        {items.length === 0 ? (
          <div className="cm-empty">
            <Sparkles size={36} strokeWidth={1.2} className="cm-empty-icon" />
            <h2 className="cm-empty-title">Menu coming online</h2>
            <p className="cm-empty-text">Nothing is available to order yet. Check back in a moment.</p>
          </div>
        ) : (
          <>
            <div className="cm-search-row">
              <div className="cm-search">
                <Search className="cm-search-icon" size={18} aria-hidden />
                <input
                  type="search"
                  className="cm-search-input"
                  placeholder="Search dishes, ingredients…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="cm-chips" role="tablist" aria-label="Categories">
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === "all"}
                className={`cm-chip ${activeCategory === "all" ? "cm-chip--active" : ""}`}
                onClick={() => setActiveCategory("all")}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={String(activeCategory) === String(c.id)}
                  className={`cm-chip ${String(activeCategory) === String(c.id) ? "cm-chip--active" : ""}`}
                  onClick={() => setActiveCategory(String(c.id))}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <section className="cm-menu" aria-label="Menu items">
              {filteredItems.length === 0 ? (
                <div className="cm-empty cm-empty--soft">
                  <p className="cm-empty-text">No matches. Try another category or search.</p>
                </div>
              ) : (
                <ul className="cm-cards">
                  {filteredItems.map((item) => {
                    const qty = getQtyInCart(item.id);
                    return (
                      <li key={item.id}>
                        <article className="cm-card">
                          <button
                            type="button"
                            className="cm-card-main"
                            onClick={() => setDetailItem(item)}
                          >
                            <div className="cm-card-visual">
                              {item.image ? (
                                <img src={dishImageUrl(item.image)} alt="" className="cm-card-img" />
                              ) : (
                                <div className="cm-card-img cm-card-img--ph" aria-hidden />
                              )}
                              <div className="cm-card-shine" aria-hidden />
                            </div>
                            <div className="cm-card-info">
                              <h2 className="cm-card-name">{itemLabel(item)}</h2>
                              {item.description?.trim() ? (
                                <p className="cm-card-desc">{item.description.trim()}</p>
                              ) : null}
                              <div className="cm-card-meta">
                                <span className="cm-card-price">Rs. {formatRs(item.price)}</span>
                                {item.category_name ? (
                                  <span className="cm-card-tag">{item.category_name}</span>
                                ) : null}
                              </div>
                            </div>
                          </button>
                          <div className="cm-card-actions">
                            {qty > 0 ? (
                              <div className="cm-stepper">
                                <button
                                  type="button"
                                  className="cm-stepper-btn"
                                  aria-label="Decrease"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCart(item, -1);
                                  }}
                                >
                                  <Minus size={16} />
                                </button>
                                <span className="cm-stepper-val">{qty}</span>
                                <button
                                  type="button"
                                  className="cm-stepper-btn"
                                  aria-label="Increase"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCart(item, 1);
                                  }}
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="cm-btn-add"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(item, 1);
                                }}
                              >
                                <Plus size={18} />
                                Add
                              </button>
                            )}
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {cartCount > 0 ? (
        <div className="cm-dock">
          <button type="button" className="cm-dock-btn" onClick={() => setCartOpen(true)}>
            <span className="cm-dock-bag">
              <ShoppingBag size={22} />
              <span className="cm-dock-badge">{cartCount}</span>
            </span>
            <span className="cm-dock-mid">
              <span className="cm-dock-label">Your order</span>
              <span className="cm-dock-total">Rs. {formatRs(totalAmount)}</span>
            </span>
            <span className="cm-dock-cta">Review</span>
          </button>
        </div>
      ) : null}

      {detailItem ? (
        <div
          className="cm-sheet-backdrop"
          role="presentation"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="cm-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cm-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="cm-detail-close" onClick={() => setDetailItem(null)} aria-label="Close">
              <X size={22} />
            </button>
            <div className="cm-detail-visual">
              {detailItem.image ? (
                <img src={dishImageUrl(detailItem.image)} alt="" className="cm-detail-img" />
              ) : (
                <div className="cm-detail-img cm-detail-img--ph" aria-hidden />
              )}
            </div>
            <div className="cm-detail-body">
              <p className="cm-detail-tag">{detailItem.category_name || "Special"}</p>
              <h2 id="cm-detail-title" className="cm-detail-title">
                {itemLabel(detailItem)}
              </h2>
              <p className="cm-detail-desc">
                {detailItem.description?.trim() ||
                  "Crafted in-house with fresh ingredients. Add to your order below."}
              </p>
              <p className="cm-detail-price">Rs. {formatRs(detailItem.price)}</p>
              <div className="cm-detail-footer">
                {getQtyInCart(detailItem.id) > 0 ? (
                  <div className="cm-stepper cm-stepper--lg">
                    <button
                      type="button"
                      className="cm-stepper-btn"
                      aria-label="Decrease"
                      onClick={() => addToCart(detailItem, -1)}
                    >
                      <Minus size={18} />
                    </button>
                    <span className="cm-stepper-val">{getQtyInCart(detailItem.id)}</span>
                    <button
                      type="button"
                      className="cm-stepper-btn"
                      aria-label="Increase"
                      onClick={() => addToCart(detailItem, 1)}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                ) : (
                  <button type="button" className="cm-btn-primary" onClick={() => addToCart(detailItem, 1)}>
                    <Plus size={20} />
                    Add to order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {cartOpen ? (
        <div className="cm-sheet-backdrop" role="presentation" onClick={() => setCartOpen(false)}>
          <div
            className="cm-cart-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Your order"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-cart-head">
              <h2 className="cm-cart-title">Your order</h2>
              <button type="button" className="cm-detail-close" onClick={() => setCartOpen(false)} aria-label="Close">
                <X size={22} />
              </button>
            </div>
            <ul className="cm-cart-list">
              {cart.map((line) => (
                <li key={line.lineKey} className="cm-cart-line">
                  <div className="cm-cart-thumb-wrap">
                    {line.image ? (
                      <img src={dishImageUrl(line.image)} alt="" className="cm-cart-thumb" />
                    ) : (
                      <div className="cm-cart-thumb cm-cart-thumb--ph" aria-hidden />
                    )}
                  </div>
                  <div className="cm-cart-line-meta">
                    <p className="cm-cart-line-name">{line.label}</p>
                    <p className="cm-cart-line-price">Rs. {formatRs(line.price)} each</p>
                    <div className="cm-stepper cm-stepper--compact">
                      <button
                        type="button"
                        className="cm-stepper-btn"
                        onClick={() => setLineQuantity(line.lineKey, line.quantity - 1)}
                        aria-label="Decrease"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="cm-stepper-val">{line.quantity}</span>
                      <button
                        type="button"
                        className="cm-stepper-btn"
                        onClick={() => setLineQuantity(line.lineKey, line.quantity + 1)}
                        aria-label="Increase"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="cm-cart-line-sub">Rs. {formatRs(Number(line.price) * line.quantity)}</p>
                </li>
              ))}
            </ul>
            <div className="cm-cart-summary">
              <div className="cm-cart-summary-row">
                <span>Total</span>
                <strong>Rs. {formatRs(totalAmount)}</strong>
              </div>
              <button
                type="button"
                className="cm-btn-primary cm-btn-primary--block"
                disabled={orderSubmitting || !cart.length}
                onClick={submitOrder}
              >
                {orderSubmitting ? (
                  <>
                    <Loader2 className="cm-spin" size={20} aria-hidden />
                    Sending…
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    Confirm order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
