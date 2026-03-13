import { useEffect, useState } from "react";

export default function Orders() {

  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {

    try {

      const res = await fetch("http://127.0.0.1:8000/api/orders/");
      const data = await res.json();

      setOrders(data);

    } catch (error) {
      console.error(error);
    }

  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (

    <div>

      <h1>Orders</h1>

      {orders.length === 0 && <p>No orders yet</p>}

      {orders.map((order) => (

        <div
          key={order.id}
          style={{
            border: "1px solid #ddd",
            padding: "15px",
            marginBottom: "10px",
            borderRadius: "8px"
          }}
        >

          <h3>Order #{order.id}</h3>

          <p>Table: {order.table}</p>

          <p>Status: {order.status}</p>

          <h4>Items</h4>

          {order.items.map((item, index) => (

            <p key={index}>
              Menu Item ID: {item.menu_item} × {item.quantity}
            </p>

          ))}

        </div>

      ))}

    </div>

  );
}