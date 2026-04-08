import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, Minus, MoreVertical, Plus, ShoppingCart } from "lucide-react";
import { authFetch, API_BASE } from "../../../lib/api";
import "./CustomerMenu.css";

export default function CustomerMenu() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [tableTokenReady, setTableTokenReady] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);

  const { id } = useParams();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("table_token");
    const tableFromUrl = searchParams.get("table") || id;

    if (token) sessionStorage.setItem("table_token", token);
    if (tableFromUrl) sessionStorage.setItem("table", tableFromUrl);
    setTableTokenReady(true);
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

    if (!tableTokenReady || !sessionStorage.getItem("table_token")) {
      setLoading(false);
      return;
    }

    fetchMenu();
  }, [tableTokenReady]);

  useEffect(() => {
    if (items.length > 0 && !selectedItemId) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  const getQuantity = (itemId) => cart.find((item) => item.id === itemId)?.quantity || 0;
  const selectedItem = items.find((item) => item.id === selectedItemId) || items[0];

  const addToCart = (item) => {
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      setCart(cart.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)));
      return;
    }
    setCart([...cart, { ...item, quantity: 1 }]);
  };

  const increaseQuantity = (itemId) => {
    setCart(cart.map((item) => (item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item)));
  };

  const decreaseQuantity = (itemId) => {
    setCart(
      cart
        .map((item) => (item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] text-sm text-slate-500">
        Loading menu...
      </div>
    );
  }

  return (
    <div className="customer-shell">
      <div className="customer-phone">
        <section className="focus-card">
          <header className="focus-header">
            <button className="icon-btn">
              <ChevronLeft size={18} />
            </button>
            <h1>Add to cart</h1>
            <button className="icon-btn">
              <MoreVertical size={18} />
            </button>
          </header>

          {selectedItem ? (
            <>
              <div className="focus-image-wrap">
                <img src={selectedItem.image} alt={selectedItem.name} className="focus-image" />
              </div>

              <h2 className="focus-title">{selectedItem.name}</h2>
              <p className="focus-desc">
                {selectedItem.description || "Freshly prepared with quality ingredients and premium flavors."}
              </p>
              <p className="focus-price">Rs. {selectedItem.price}</p>

              <div className="thumb-row">
                {items.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`thumb-btn ${selectedItem.id === item.id ? "active" : ""}`}
                  >
                    <img src={item.image} alt={item.name} />
                  </button>
                ))}
              </div>

              <div className="focus-actions">
                <div className="qty-box">
                  <button onClick={() => decreaseQuantity(selectedItem.id)} className="qty-btn">
                    <Minus size={14} />
                  </button>
                  <span>{getQuantity(selectedItem.id)}</span>
                  <button onClick={() => increaseQuantity(selectedItem.id)} className="qty-btn">
                    <Plus size={14} />
                  </button>
                </div>

                <button onClick={() => addToCart(selectedItem)} className="add-btn">
                  Add to cart
                </button>
              </div>
            </>
          ) : (
            <p className="empty-text">No menu items available</p>
          )}
        </section>

        <section className="order-card">
          <div className="order-header">
            <h3>My order</h3>
            <div className="cart-pill">
              <ShoppingCart size={14} />
              <span>{cartCount}</span>
            </div>
          </div>

          <div className="order-list">
            {cart.length === 0 ? (
              <p className="empty-text">Your cart is empty</p>
            ) : (
              cart.map((item) => (
                <article key={item.id} className="order-item">
                  <img src={item.image} alt={item.name} />
                  <div className="order-meta">
                    <p className="name">{item.name}</p>
                    <p className="price">Rs. {item.price}</p>
                    <div className="qty-mini">
                      <button onClick={() => decreaseQuantity(item.id)}>
                        <Minus size={13} />
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => increaseQuantity(item.id)}>
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="total-row">
            <span>Total</span>
            <strong>Rs. {totalAmount.toFixed(2)}</strong>
          </div>

          <button className="confirm-btn">Confirm order</button>
        </section>
      </div>
    </div>
  );
}