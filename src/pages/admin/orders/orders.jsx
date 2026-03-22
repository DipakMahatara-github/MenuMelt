import { useEffect, useState } from "react";

export default function Orders() {

  const [orders, setOrders] = useState([]);

  // FETCH ORDERS
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

    // 🔥 Auto refresh every 5 sec (important for demo)
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);

  }, []);

  return (

    <div style={{ padding: "20px" }}>

      <h1 style={{ marginBottom: "20px" }}>Orders Dashboard</h1>

      {orders.length === 0 && <p>No orders yet</p>}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "20px"
      }}>

        {orders.map((order) => (

          <div
            key={order.id}
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "15px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.05)"
            }}
          >

            <h3>Order #{order.id}</h3>

            <p><strong>Table:</strong> {order.table}</p>

            <p>
              <strong>Status:</strong>{" "}
              <span style={{
                padding: "4px 10px",
                borderRadius: "20px",
                background:
                  order.status === "pending"
                    ? "#fef3c7"
                    : order.status === "completed"
                    ? "#dcfce7"
                    : "#e0e7ff",
                color:
                  order.status === "pending"
                    ? "#92400e"
                    : order.status === "completed"
                    ? "#166534"
                    : "#3730a3"
              }}>
                {order.status}
              </span>
            </p>

            <p style={{ fontSize: "12px", color: "#64748b" }}>
              {new Date(order.created_at).toLocaleString()}
            </p>

            <hr />

            <h4>Items</h4>

            {order.items.map((item, index) => (

              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "5px"
                }}
              >

                <span>Item #{item.menu_item}</span>
                <span>x {item.quantity}</span>

              </div>

            ))}

          </div>

        ))}

      </div>

    </div>
  );
}