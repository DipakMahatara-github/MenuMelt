import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import "../../admin/menu/menu.css";

export default function CustomerMenu() {

  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);

  // ✅ GET TABLE FROM URL (both ways)
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const table = searchParams.get("table") || id;

  // ✅ FETCH MENU
  const fetchMenu = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/menu/");
    const data = await res.json();

    // ✅ Only available items
    setItems(data.filter(item => item.available));
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  // ✅ ADD TO CART
  const addToCart = (item) => {

    const existing = cart.find((c) => c.id === item.id);

    if (existing) {
      setCart(
        cart.map((c) =>
          c.id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      );
    } else {
      setCart([
        ...cart,
        { ...item, quantity: 1 }
      ]);
    }
  };

  // ✅ PLACE ORDER
  const placeOrder = async () => {

    if (cart.length === 0) {
      alert("Cart is empty");
      return;
    }

    const orderData = {
      table: Number(table),
      items: cart.map((item) => ({
        menu_item: item.id,
        quantity: item.quantity
      }))
    };

    try {

      const res = await fetch("http://127.0.0.1:8000/api/orders/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderData)
      });

      if (res.ok) {
        alert("Order placed successfully!");
        setCart([]);
      } else {
        alert("Failed to place order");
      }

    } catch (error) {
      console.error(error);
      alert("Server error");
    }

  };

  return (

    <div className="customer-menu">

      <h1>Restaurant Menu</h1>

      {/* ✅ TABLE DISPLAY */}
      {table && (
        <p style={{ marginBottom: "20px" }}>
          Table Number: <strong>{table}</strong>
        </p>
      )}

      {/* ================= MENU ================= */}

      <div className="menu-grid">

        {items.map((item) => (

          <div className="menu-card" key={item.id}>

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

            <p>{item.category}</p>

            <p className="price">
              Rs. {item.price}
            </p>

            <button
              className="order-btn"
              onClick={() => addToCart(item)}
            >
              Add to Order
            </button>

          </div>

        ))}

      </div>

      {/* ================= CART ================= */}

      <div className="cart-section">

        <h2>Your Order</h2>

        {cart.length === 0 && <p>No items added</p>}

        {cart.map((item) => (

          <div key={item.id} className="cart-item">

            <span>{item.name}</span>

            <span>x {item.quantity}</span>

            <span>Rs {item.price * item.quantity}</span>

          </div>

        ))}

        {cart.length > 0 && (

          <>
            <h3 className="total">
              Total Rs{" "}
              {cart.reduce(
                (sum, item) =>
                  sum + item.price * item.quantity,
                0
              )}
            </h3>

            <button
              className="place-order-btn"
              onClick={placeOrder}
            >
              Place Order
            </button>
          </>

        )}

      </div>

    </div>

  );
}