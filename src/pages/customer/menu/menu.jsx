import { useEffect, useState } from "react";
import "./menu.css";

export default function CustomerMenu() {

  const [items, setItems] = useState([]);

  const fetchMenu = async () => {

    const res = await fetch("http://127.0.0.1:8000/api/menu/");
    const data = await res.json();

    setItems(data);

  };

  useEffect(() => {
    fetchMenu();
  }, []);

  return (

    <div className="customer-menu">

      <h1>Restaurant Menu</h1>

      <div className="menu-grid">

        {items.map((item) => (

          <div className="menu-card" key={item.id}>

            {item.image && (
              <img
                src={item.image}
                alt={item.name}
              />
            )}

            <h3>{item.name}</h3>

            <p>{item.category}</p>

            <p className="price">
              Rs. {item.price}
            </p>

            {item.available ? (
              <button className="order-btn">
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

    </div>

  );
}