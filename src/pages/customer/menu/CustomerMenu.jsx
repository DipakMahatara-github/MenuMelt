import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, Minus, Plus, Search, ShoppingCart } from "lucide-react";
import { authFetch, API_BASE } from "../../../lib/api";
import { loadCart, saveCart } from "../../../lib/customerCart";
import { ensureCustomerSession, getCustomerRestaurantName, setCustomerRestaurantName } from "../../../lib/customerSession";
import "./CustomerMenu.css";

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

function categoryLabel(item) {
  return (item?.category_name || "Other").trim() || "Other";
}

export default function CustomerMenu() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(() => loadCart());
  const [tableTokenReady, setTableTokenReady] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [restaurantName, setRestaurantName] = useState(() => getCustomerRestaurantName());

  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("table_token");
    const tableFromUrl = searchParams.get("table") || id;

    if (token) sessionStorage.setItem("table_token", token);
    if (tableFromUrl) sessionStorage.setItem("table", tableFromUrl);
    ensureCustomerSession();
    setTableTokenReady(true);
  }, [id, searchParams]);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setLoading(true);
        const res = await authFetch(`${API_BASE}/api/menu/`);
        const data = await res.json();

        let list = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (data?.items && Array.isArray(data.items)) {
          list = data.items;
          if (data.restaurant?.name) {
            setCustomerRestaurantName(data.restaurant.name);
            setRestaurantName(data.restaurant.name);
          }
        } else if (Array.isArray(data?.results)) {
          list = data.results;
        }
        setItems(list);
      } catch (error) {
        console.error("Menu fetch error:", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    if (!tableTokenReady || !sessionStorage.getItem("table_token")) {
      setLoading(false);
      return;
    }

    fetchMenu();
  }, [tableTokenReady]);

  const categories = useMemo(() => {
    const names = new Set();
    items.forEach((it) => names.add(categoryLabel(it)));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((it) => {
      if (activeCategory !== "all" && categoryLabel(it) !== activeCategory) {
        return false;
      }
      if (!q) return true;
      const label = itemLabel(it).toLowerCase();
      const desc = (it.description || "").toLowerCase();
      const cat = categoryLabel(it).toLowerCase();
      return label.includes(q) || desc.includes(q) || cat.includes(q);
    });
  }, [items, searchQuery, activeCategory]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedItemId(null);
      return;
    }
    if (!selectedItemId || !filteredItems.some((i) => i.id === selectedItemId)) {
      setSelectedItemId(filteredItems[0].id);
    }
  }, [filteredItems, selectedItemId]);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedItemId) || filteredItems[0] || null;

  const activeLineKey = selectedItem ? String(selectedItem.id) : null;

  const getQuantity = (lineKey) => cart.find((c) => c.lineKey === lineKey)?.quantity || 0;

  const addToCart = (item) => {
    const lineKey = String(item.id);
    const unit = Number(item.price);
    const existing = cart.find((c) => c.lineKey === lineKey);
    if (existing) {
      setCart(cart.map((c) => (c.lineKey === lineKey ? { ...c, quantity: c.quantity + 1 } : c)));
      return;
    }
    setCart([
      ...cart,
      {
        lineKey,
        id: item.id,
        label: itemLabel(item),
        image: item.image,
        price: unit,
        quantity: 1,
      },
    ]);
  };

  const increaseQuantity = (lineKey) => {
    setCart(cart.map((item) => (item.lineKey === lineKey ? { ...item, quantity: item.quantity + 1 } : item)));
  };

  const decreaseQuantity = (lineKey) => {
    setCart(
      cart
        .map((item) => (item.lineKey === lineKey ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  if (loading) {
    return (
      <div className="cx-shell">
        <div className="cx-phone">
          <div className="cx-loading">
            <div className="cx-spinner" aria-hidden />
            <p>Loading your menu…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionStorage.getItem("table_token")) {
    return (
      <div className="cx-shell">
        <div className="cx-phone">
          <div className="cx-gate">
            <p>Scan the QR code on your table to open the menu for this restaurant.</p>
            <Link to="/" className="cx-link">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cx-shell">
      <div className="cx-phone">
        <header className="cx-menu-topbar">
          <Link to="/my-orders" className="cx-icon-btn" aria-label="Your orders">
            <ChevronLeft size={20} strokeWidth={2.2} />
          </Link>
          <div className="cx-menu-brand">
            <span className="cx-menu-brand-tag">Table order</span>
            <h1 className="cx-menu-brand-title">{restaurantName || "Menu"}</h1>
          </div>
          <Link to="/cart" className="cx-icon-btn" aria-label="Shopping cart">
            <ShoppingCart size={20} strokeWidth={2.2} />
            {cartCount > 0 ? <span className="cx-badge">{cartCount > 99 ? "99+" : cartCount}</span> : null}
          </Link>
        </header>

        <div className="cx-search-wrap">
          <Search className="cx-search-icon" strokeWidth={2} aria-hidden />
          <input
            type="search"
            className="cx-search-input"
            placeholder="Search dishes, ingredients, categories…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>

        <div className="cx-chips-row" role="tablist" aria-label="Menu categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "all"}
            className={`cx-chip ${activeCategory === "all" ? "cx-chip--active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            All
          </button>
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={activeCategory === name}
              className={`cx-chip ${activeCategory === name ? "cx-chip--active" : ""}`}
              onClick={() => setActiveCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>

        {selectedItem ? (
          <section className="cx-detail" aria-label="Selected dish">
            <p className="cx-detail-cat">{categoryLabel(selectedItem)}</p>
            <div className="cx-detail-image-wrap">
              {selectedItem.image ? (
                <img
                  src={dishImageUrl(selectedItem.image)}
                  alt={itemLabel(selectedItem)}
                  className="cx-detail-image"
                />
              ) : (
                <div className="cx-detail-image--ph" aria-hidden />
              )}
            </div>
            <h2 className="cx-detail-title">{itemLabel(selectedItem)}</h2>
            <p className="cx-detail-desc">
              {selectedItem.description || "Freshly prepared with quality ingredients and bold flavors."}
            </p>
            <p className="cx-detail-price">Rs. {Number(selectedItem.price).toFixed(2)}</p>
            <div className="cx-detail-actions">
              <div className="cx-qty">
                <button type="button" onClick={() => activeLineKey && decreaseQuantity(activeLineKey)} aria-label="Decrease quantity">
                  <Minus size={16} />
                </button>
                <span>{activeLineKey ? getQuantity(activeLineKey) : 0}</span>
                <button type="button" onClick={() => activeLineKey && increaseQuantity(activeLineKey)} aria-label="Increase quantity">
                  <Plus size={16} />
                </button>
              </div>
              <button type="button" className="cx-btn-primary" onClick={() => addToCart(selectedItem)}>
                Add to cart
              </button>
            </div>
          </section>
        ) : (
          <section className="cx-detail cx-empty-grid">No dishes match your filters. Try another search or category.</section>
        )}

        <section aria-label="Menu items">
          <h2 className="cx-section-label">
            {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
            {searchQuery.trim() ? " · filtered" : ""}
          </h2>
          <div className="cx-menu-grid">
            {filteredItems.length === 0 ? (
              <div className="cx-empty-grid">No items found. Clear search or pick &quot;All&quot; categories.</div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`cx-menu-tile ${selectedItem?.id === item.id ? "cx-menu-tile--active" : ""}`}
                  onClick={() => setSelectedItemId(item.id)}
                >
                  {item.image ? (
                    <img src={dishImageUrl(item.image)} alt="" className="cx-menu-tile-img" />
                  ) : (
                    <div className="cx-menu-tile-img--ph" aria-hidden />
                  )}
                  <div className="cx-menu-tile-body">
                    <p className="cx-menu-tile-name">{itemLabel(item)}</p>
                    <p className="cx-menu-tile-price">Rs. {Number(item.price).toFixed(2)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="cx-cart-card" aria-label="Cart summary">
          <div className="cx-cart-header">
            <h2>My order</h2>
            <div className="cx-cart-pill">
              <ShoppingCart size={16} />
              <span>{cartCount}</span>
            </div>
          </div>

          <div className="cx-cart-lines">
            {cart.length === 0 ? (
              <p className="cx-cart-empty">Your cart is empty — add items from the menu above.</p>
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
                      <button type="button" onClick={() => decreaseQuantity(item.lineKey)} aria-label="Decrease">
                        <Minus size={14} />
                      </button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => increaseQuantity(item.lineKey)} aria-label="Increase">
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
            <strong>Rs. {totalAmount.toFixed(2)}</strong>
          </div>

          <button type="button" className="cx-btn-block" onClick={() => navigate("/cart")}>
            Review cart &amp; checkout
          </button>
        </section>
      </div>
    </div>
  );
}
