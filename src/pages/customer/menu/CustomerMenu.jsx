import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, Minus, Plus, Search, ShoppingCart, Star, Sparkles, TrendingUp } from "lucide-react";
import { authFetch, API_BASE } from "../../../lib/api";
import { buildCartLineKey, loadCart, saveCart } from "../../../lib/customerCart";
import {
  ensureCustomerSession,
  getCustomerRestaurantName,
  setCustomerRestaurantName,
} from "../../../lib/customerSession";
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

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function priceDeltaLabel(value) {
  const amount = Number(value || 0);
  if (amount <= 0) return "Included";
  return `+ Rs. ${amount.toFixed(2)}`;
}

function offerValueLabel(offer) {
  if (offer?.offer_type === "fixed") {
    return `Save Rs. ${formatMoney(offer.fixed_discount_amount)}`;
  }
  if (offer?.offer_type === "percentage") {
    return `${Number(offer.percentage_discount || 0).toFixed(0)}% off`;
  }
  return `Combo meal · Rs. ${formatMoney(offer.combo_price)}`;
}

function offerHelperCopy(offer) {
  if (offer?.offer_type === "combo") {
    return "Add all included dishes to unlock the combo price at checkout.";
  }
  return "This offer is applied by the restaurant automatically during checkout.";
}

function buildSelectedOptions(item, selectionMap) {
  if (!item?.customization_groups?.length) return [];
  const selected = [];
  item.customization_groups.forEach((group) => {
    const groupSelections = selectionMap?.[group.id] || [];
    group.options.forEach((option) => {
      if (groupSelections.includes(option.id)) {
        selected.push({
          id: option.id,
          group_name: group.name,
          option_name: option.name,
          price_delta: Number(option.price_delta || 0),
        });
      }
    });
  });
  return selected;
}

function validateSelections(item, selectionMap) {
  for (const group of item?.customization_groups || []) {
    const selected = selectionMap?.[group.id] || [];
    if (group.is_required && selected.length === 0) {
      return `${group.name} is required.`;
    }
    if (group.selection_mode === "single" && selected.length > 1) {
      return `Choose only one option for ${group.name}.`;
    }
    if (group.selection_mode === "multiple" && selected.length > Number(group.max_select || 1)) {
      return `Choose at most ${group.max_select} options for ${group.name}.`;
    }
  }
  return "";
}

export default function CustomerMenu() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(() => loadCart());
  const [tableTokenReady, setTableTokenReady] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState("recommended");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [popularOnly, setPopularOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [restaurantMeta, setRestaurantMeta] = useState({
    name: getCustomerRestaurantName(),
    average_rating: null,
    review_count: 0,
  });
  const [menuFilters, setMenuFilters] = useState({ categories: [], price_range: { min: "0.00", max: "0.00" } });
  const [selectionDrafts, setSelectionDrafts] = useState({});
  const [selectionError, setSelectionError] = useState("");
  const [specialOffers, setSpecialOffers] = useState([]);

  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const deferredSearch = useDeferredValue(searchQuery);

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
        const params = new URLSearchParams();
        if (activeCategory !== "all") params.set("category", activeCategory);
        if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
        if (sortBy !== "recommended") params.set("sort", sortBy);
        if (minPrice.trim()) params.set("min_price", minPrice.trim());
        if (maxPrice.trim()) params.set("max_price", maxPrice.trim());
        if (popularOnly) params.set("popular_only", "true");
        if (newOnly) params.set("new_only", "true");

        const url = `${API_BASE}/api/menu/${params.toString() ? `?${params.toString()}` : ""}`;
        const res = await authFetch(url);
        const data = await res.json();

        let list = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (data?.items && Array.isArray(data.items)) {
          list = data.items;
          if (data.restaurant?.name) {
            setCustomerRestaurantName(data.restaurant.name);
          }
          setRestaurantMeta({
            name: data.restaurant?.name || getCustomerRestaurantName(),
            average_rating: data.restaurant?.average_rating ?? null,
            review_count: Number(data.restaurant?.review_count || 0),
          });
          setMenuFilters(
            data.filters || { categories: [], price_range: { min: "0.00", max: "0.00" } }
          );
          setSpecialOffers(Array.isArray(data.special_offers) ? data.special_offers : []);
        } else if (Array.isArray(data?.results)) {
          list = data.results;
          setSpecialOffers([]);
        }
        setItems(list);
      } catch (error) {
        console.error("Menu fetch error:", error);
        setItems([]);
        setSpecialOffers([]);
      } finally {
        setLoading(false);
      }
    };

    if (!tableTokenReady || !sessionStorage.getItem("table_token")) {
      setLoading(false);
      return;
    }

    fetchMenu();
  }, [tableTokenReady, activeCategory, deferredSearch, sortBy, minPrice, maxPrice, popularOnly, newOnly]);

  useEffect(() => {
    if (menuFilters.categories?.length && activeCategory !== "all") {
      const stillExists = menuFilters.categories.some((category) => String(category.id) === String(activeCategory));
      if (!stillExists) {
        setActiveCategory("all");
      }
    }
  }, [menuFilters, activeCategory]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedItemId(null);
      return;
    }
    if (!selectedItemId || !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    setSelectionError("");
  }, [selectedItemId]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) || items[0] || null,
    [items, selectedItemId]
  );
  const specialOfferMap = useMemo(
    () =>
      new Map(
        specialOffers.map((offer) => [
          offer.id,
          (offer.items || []).map((offerItem) => Number(offerItem.menu_item)).filter(Boolean),
        ])
      ),
    [specialOffers]
  );

  const currentSelectionMap = selectedItem ? selectionDrafts[selectedItem.id] || {} : {};
  const currentSelectedOptions = selectedItem ? buildSelectedOptions(selectedItem, currentSelectionMap) : [];
  const currentSelectedOptionIds = currentSelectedOptions.map((option) => option.id);
  const currentCustomizationDelta = currentSelectedOptions.reduce(
    (sum, option) => sum + Number(option.price_delta || 0),
    0
  );
  const activeLineKey = selectedItem ? buildCartLineKey(selectedItem.id, currentSelectedOptionIds) : null;

  const getQuantity = (lineKey) => cart.find((c) => c.lineKey === lineKey)?.quantity || 0;

  const updateSelection = (group, optionId, checked) => {
    if (!selectedItem) return;
    setSelectionDrafts((current) => {
      const itemSelections = { ...(current[selectedItem.id] || {}) };
      const currentGroupSelections = [...(itemSelections[group.id] || [])];

      if (group.selection_mode === "single") {
        itemSelections[group.id] = checked ? [optionId] : [];
      } else {
        const hasOption = currentGroupSelections.includes(optionId);
        let nextSelections = currentGroupSelections;
        if (checked && !hasOption) {
          nextSelections = [...currentGroupSelections, optionId];
        } else if (!checked && hasOption) {
          nextSelections = currentGroupSelections.filter((id) => id !== optionId);
        }
        if (nextSelections.length > Number(group.max_select || 1)) {
          setSelectionError(`Choose at most ${group.max_select} options for ${group.name}.`);
          return current;
        }
        itemSelections[group.id] = nextSelections;
      }

      setSelectionError("");
      return {
        ...current,
        [selectedItem.id]: itemSelections,
      };
    });
  };

  const addToCart = (item) => {
    const itemSelections = selectionDrafts[item.id] || {};
    const validationError = validateSelections(item, itemSelections);
    if (validationError) {
      setSelectionError(validationError);
      return;
    }

    const selectedOptions = buildSelectedOptions(item, itemSelections);
    const selectedOptionIds = selectedOptions.map((option) => option.id);
    const lineKey = buildCartLineKey(item.id, selectedOptionIds);
    const baseCustomerPrice = Number(item.customer_price ?? item.price ?? 0);
    const unitPriceEstimate =
      baseCustomerPrice + selectedOptions.reduce((sum, option) => sum + Number(option.price_delta || 0), 0);

    const existing = cart.find((line) => line.lineKey === lineKey);
    if (existing) {
      setCart(
        cart.map((line) =>
          line.lineKey === lineKey ? { ...line, quantity: line.quantity + 1 } : line
        )
      );
      return;
    }

    setCart([
      ...cart,
      {
        lineKey,
        id: item.id,
        label: itemLabel(item),
        image: item.image,
        price: unitPriceEstimate,
        basePrice: baseCustomerPrice,
        quantity: 1,
        selectedOptionIds,
        selectedOptions,
      },
    ]);
  };

  const increaseQuantity = (lineKey) => {
    if (!lineKey) return;
    const existing = cart.find((item) => item.lineKey === lineKey);
    if (!existing && selectedItem) {
      addToCart(selectedItem);
      return;
    }
    setCart(
      cart.map((item) =>
        item.lineKey === lineKey ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const decreaseQuantity = (lineKey) => {
    if (!lineKey) return;
    setCart(
      cart
        .map((item) =>
          item.lineKey === lineKey ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const categories = menuFilters.categories || [];

  const openOffer = (offer) => {
    const linkedItemIds = specialOfferMap.get(offer.id) || [];
    const firstVisibleItem = items.find((item) => linkedItemIds.includes(item.id));
    if (firstVisibleItem) {
      setSelectedItemId(firstVisibleItem.id);
      window.requestAnimationFrame(() => {
        document.querySelector(".cx-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

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
            <h1 className="cx-menu-brand-title">{restaurantMeta.name || "Menu"}</h1>
            {restaurantMeta.average_rating ? (
              <p className="cx-menu-rating">
                <Star size={14} strokeWidth={2} />
                <span>{Number(restaurantMeta.average_rating).toFixed(1)}</span>
                <span>·</span>
                <span>{restaurantMeta.review_count} reviews</span>
              </p>
            ) : null}
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

        <section className="cx-filter-card" aria-label="Menu filters">
          <div className="cx-filter-grid">
            <label className="cx-filter-field">
              <span>Sort</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="popular">Popular</option>
                <option value="newest">Newest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
            <label className="cx-filter-field">
              <span>Min price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder={menuFilters.price_range?.min || "0.00"}
              />
            </label>
            <label className="cx-filter-field">
              <span>Max price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder={menuFilters.price_range?.max || "0.00"}
              />
            </label>
          </div>
          <div className="cx-chip-toggle-row">
            <button
              type="button"
              className={`cx-chip-toggle ${popularOnly ? "is-on" : ""}`}
              onClick={() => setPopularOnly((current) => !current)}
            >
              <TrendingUp size={14} strokeWidth={2.1} />
              Popular
            </button>
            <button
              type="button"
              className={`cx-chip-toggle ${newOnly ? "is-on" : ""}`}
              onClick={() => setNewOnly((current) => !current)}
            >
              <Sparkles size={14} strokeWidth={2.1} />
              New items
            </button>
          </div>
        </section>

        {specialOffers.length ? (
          <section className="cx-specials-section" aria-label="Special offers and meals">
            <div className="cx-specials-head">
              <h2 className="cx-section-label">Special offers & meals</h2>
              <span className="cx-specials-count">{specialOffers.length} live</span>
            </div>
            <div className="cx-specials-list">
              {specialOffers.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  className="cx-special-card"
                  onClick={() => openOffer(offer)}
                >
                  <div className="cx-special-card-top">
                    <div>
                      <p className="cx-special-kicker">{offer.badge_text || "Live special"}</p>
                      <h3>{offer.name}</h3>
                    </div>
                    <span className="cx-special-value">{offerValueLabel(offer)}</span>
                  </div>
                  <div className="cx-special-state-row">
                    <span className={`cx-special-state ${offer.is_currently_valid ? "is-live" : "is-scheduled"}`}>
                      {offer.is_currently_valid ? "Available now" : "Starts later"}
                    </span>
                    <span className="cx-special-open">Open special</span>
                  </div>
                  {offer.description ? <p className="cx-special-desc">{offer.description}</p> : null}
                  <p className="cx-special-copy">{offerHelperCopy(offer)}</p>
                  <div className="cx-special-tags">
                    {(offer.items || []).map((offerItem) => (
                      <span key={`${offer.id}-${offerItem.id || offerItem.menu_item}`} className="cx-special-tag">
                        {offerItem.menu_item_display_name} x {offerItem.quantity}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

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
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={String(activeCategory) === String(category.id)}
              className={`cx-chip ${String(activeCategory) === String(category.id) ? "cx-chip--active" : ""}`}
              onClick={() => setActiveCategory(String(category.id))}
            >
              {category.name}
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
            <div className="cx-offer-badges">
              {(selectedItem.offer_badges || []).slice(0, 3).map((badge) => (
                <span key={`${selectedItem.id}-${badge.offer_type}-${badge.label}`} className="cx-offer-badge">
                  {badge.label}
                </span>
              ))}
            </div>
            <h2 className="cx-detail-title">{itemLabel(selectedItem)}</h2>
            <p className="cx-detail-desc">
              {selectedItem.description || "Freshly prepared with quality ingredients and bold flavors."}
            </p>
            <div className="cx-detail-price-wrap">
              <p className="cx-detail-price">Rs. {formatMoney(Number(selectedItem.customer_price || selectedItem.price) + currentCustomizationDelta)}</p>
              {Number(selectedItem.customer_price || selectedItem.price) < Number(selectedItem.price) ? (
                <p className="cx-detail-price-note">
                  <span>Was Rs. {formatMoney(selectedItem.price)}</span>
                </p>
              ) : null}
            </div>

            {selectedItem.customization_groups?.length ? (
              <div className="cx-customization-stack">
                {selectedItem.customization_groups.map((group) => {
                  const selectedValues = currentSelectionMap[group.id] || [];
                  return (
                    <section key={group.id} className="cx-customization-card">
                      <div className="cx-customization-head">
                        <div>
                          <h3>{group.name}</h3>
                          <p>
                            {group.is_required ? "Required" : "Optional"}
                            {group.selection_mode === "multiple" ? ` · Choose up to ${group.max_select}` : " · Choose one"}
                          </p>
                        </div>
                      </div>
                      <div className="cx-customization-options">
                        {group.options.map((option) => {
                          const checked = selectedValues.includes(option.id);
                          return (
                            <label key={option.id} className={`cx-option-pill ${checked ? "is-checked" : ""}`}>
                              <input
                                type={group.selection_mode === "single" ? "radio" : "checkbox"}
                                name={`group-${group.id}`}
                                checked={checked}
                                onChange={(e) => updateSelection(group, option.id, e.target.checked)}
                              />
                              <span>{option.name}</span>
                              <strong>{priceDeltaLabel(option.price_delta)}</strong>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : null}

            {selectionError ? <p className="cx-selection-error">{selectionError}</p> : null}

            {currentSelectedOptions.length ? (
              <div className="cx-picked-options">
                {currentSelectedOptions.map((option) => (
                  <span key={`${option.group_name}-${option.option_name}`} className="cx-picked-option">
                    {option.group_name}: {option.option_name}
                  </span>
                ))}
              </div>
            ) : null}

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
            {items.length} item{items.length === 1 ? "" : "s"}
            {deferredSearch.trim() ? " · filtered" : ""}
          </h2>
          <div className="cx-menu-grid">
            {items.length === 0 ? (
              <div className="cx-empty-grid">No items found. Adjust your filters and try again.</div>
            ) : (
              items.map((item) => {
                const tilePrice = Number(item.customer_price ?? item.price);
                const originalPrice = Number(item.price || 0);
                return (
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
                      <div className="cx-menu-tile-top">
                        <p className="cx-menu-tile-name">{itemLabel(item)}</p>
                        <div className="cx-menu-tile-flags">
                          {item.is_popular ? <span className="cx-menu-flag">Popular</span> : null}
                          {item.is_new ? <span className="cx-menu-flag cx-menu-flag--new">New</span> : null}
                        </div>
                      </div>
                      <div className="cx-menu-tile-price-wrap">
                        <p className="cx-menu-tile-price">Rs. {tilePrice.toFixed(2)}</p>
                        {tilePrice < originalPrice ? (
                          <p className="cx-menu-tile-price-old">Rs. {originalPrice.toFixed(2)}</p>
                        ) : null}
                      </div>
                      {(item.offer_badges || []).length ? (
                        <div className="cx-menu-tile-badges">
                          {item.offer_badges.slice(0, 2).map((badge) => (
                            <span key={`${item.id}-${badge.offer_type}-${badge.label}`} className="cx-offer-badge cx-offer-badge--small">
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })
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
          <p className="cx-cart-total-copy">
            Estimated total <strong>Rs. {totalAmount.toFixed(2)}</strong>
          </p>
          <p className="cx-cart-note">
            Final total, combo discounts, and special offers are confirmed by the server at checkout.
          </p>
          <div className="cx-secondary-actions">
            <Link to="/cart" className="cx-btn-block">
              Review cart
            </Link>
            <Link to="/my-orders" className="cx-link-quiet">
              View active orders
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
