import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import "./CustomerMenu.css";
import { authFetch, API_BASE } from "../../../lib/api";

export default function CustomerMenu() {

  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);

  const { id } = useParams();
  const [searchParams] = useSearchParams();

  // ✅ Table logic (persistent)
  const tableFromUrl = searchParams.get("table") || id;
  const table = tableFromUrl || localStorage.getItem("table");

  useEffect(() => {
    if (tableFromUrl) {
      localStorage.setItem("table", tableFromUrl);
    }
  }, [tableFromUrl]);

  // ✅ Fetch menu
  const fetchMenu = async () => {
    const res = await authFetch(`${API_BASE}/api/menu/`);
    const data = await res.json();
    setItems(data.filter(item => item.available));
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  // ✅ Add to cart
  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);

    if (existing) {
      setCart(cart.map(c =>
        c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  // ✅ Place order
  const placeOrder = async () => {

    if (!table) {
      alert("Table not found");
      return;
    }

    if (cart.length === 0) {
      alert("Cart is empty");
      return;
    }

    const orderData = {
      table: Number(table),
      items: cart.map(item => ({
        menu_item: item.id,
        quantity: item.quantity
      }))
    };

    const res = await authFetch(`${API_BASE}/api/orders/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData)
    });

    if (res.ok) {
      alert("Order placed!");
      setCart([]);
    } else {
      alert("Error placing order");
    }
  };

  return (
    <div className="customer-menu">

      <h1>Restaurant Menu</h1>

      {/* ✅ Table display */}
      {table && (
        <div style={{ marginBottom: "10px", fontWeight: "bold" }}>
          🍽️ Table {table}
        </div>
      )}

      {/* ✅ MENU */}
      <div className="menu-grid">
        {items.map(item => (
          <div key={item.id} className="menu-card">

            {/* ✅ Safe image handling */}
            {item.image && (
              <img
                src={
                  item.image.startsWith("http")
                    ? item.image
                    : `http://127.0.0.1:8000${item.image}`
                }
                alt={item.name}
              />
            )}

            <h3>{item.name}</h3>
            <p>Rs {item.price}</p>

            <button onClick={() => addToCart(item)}>
              Add
            </button>

          </div>
        ))}
      </div>

      {/* ✅ CART */}
      <div className="cart">

        {cart.map(item => (
          <p key={item.id}>
            {item.name} x {item.quantity}
          </p>
        ))}

        {cart.length > 0 && (
          <button onClick={placeOrder}>
            Place Order
          </button>
        )}

      </div>

    </div>
  );
}