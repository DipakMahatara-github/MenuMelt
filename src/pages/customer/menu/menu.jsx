import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "../../admin/menu/menu.css";

export default function CustomerMenu() {

  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);

  // GET TABLE NUMBER FROM URL
  const [searchParams] = useSearchParams();
  const table = searchParams.get("table");

  // FETCH MENU
  const fetchMenu = async () => {

    const res = await fetch("http://127.0.0.1:8000/api/menu/");
    const data = await res.json();

    setItems(data);

  };

  useEffect(() => {
    fetchMenu();
  }, []);

  // ADD ITEM TO CART
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

  // PLACE ORDER
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

      {/* SHOW TABLE NUMBER */}
      {table && (
        <p style={{ marginBottom: "20px" }}>
          Table Number: <strong>{table}</strong>
        </p>
      )}

      {/* MENU GRID */}

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

            {item.available ? (
              <button
                className="order-btn"
                onClick={() => addToCart(item)}
              >
                Add to Order
              </button>
            ) : (
              <span className="unavailable">
                Not Available
              </span>
            )}

          </div>

        ))}

      </div>

      {/* CART SECTION */}

      <div style={{ marginTop: "40px" }}>

        <h2>Your Order</h2>

        {cart.length === 0 && <p>No items added</p>}

        {cart.map((item) => (

          <div
            key={item.id}
            style={{
              display: "flex",
              gap: "20px",
              marginBottom: "10px"
            }}
          >

            <span>{item.name}</span>

            <span>x {item.quantity}</span>

            <span>Rs {item.price * item.quantity}</span>

          </div>

        ))}

        {cart.length > 0 && (

          <>
            <h3>

              Total Rs{" "}
              {cart.reduce(
                (sum, item) =>
                  sum + item.price * item.quantity,
                0
              )}

            </h3>

            <button
              style={{
                marginTop: "10px",
                padding: "10px 20px",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
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