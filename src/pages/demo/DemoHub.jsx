import React, { useState, useEffect } from "react";
import { MoveRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DemoCustomer from "./DemoCustomer";
import DemoKitchen from "./DemoKitchen";
import "./DemoHub.css";

export default function DemoHub() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([
    {
      id: 8421,
      table_number: 2,
      status: "ready",
      created_at: new Date(Date.now() - 600000).toISOString(),
      items: [{ name: "Chicken Burger", quantity: 1, price: 350 }]
    }
  ]);
  const [cart, setCart] = useState([]);
  const [view, setView] = useState("split");
  const [isSyncing, setIsSyncing] = useState(false);

  const handlePlaceOrder = (newOrder) => {
    const orderWithId = {
      ...newOrder,
      id: Math.floor(1000 + Math.random() * 9000),
      status: "preparing",
      created_at: new Date().toISOString(),
      table_number: 4
    };
    
    setIsSyncing(true);
    setTimeout(() => {
      setOrders((prev) => [orderWithId, ...prev]);
      setIsSyncing(false);
    }, 800); 
  };

  const handleMarkReady = (orderId) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "ready" } : o))
    );
  };

  return (
    <div className="demo-stage">
      <nav className="demo-nav">
        <button className="demo-back" onClick={() => navigate("/")}>
          <ArrowLeft size={18} />
          <span>Exit Demo</span>
        </button>
        <div className="demo-title">
          <h1>Interactive Demo</h1>
          <p>Real-time Sync Experience</p>
        </div>
        <div className="demo-controls">
           <button 
            className={`demo-view-btn ${view === 'customer' ? 'active' : ''}`}
            onClick={() => setView('customer')}
           >Mobile</button>
           <button 
            className={`demo-view-btn ${view === 'split' ? 'active' : ''}`}
            onClick={() => setView('split')}
           >Split View</button>
           <button 
            className={`demo-view-btn ${view === 'kitchen' ? 'active' : ''}`}
            onClick={() => setView('kitchen')}
           >Kitchen</button>
        </div>
      </nav>

      <div className={`demo-workspace ${view}`}>
        {(view === "split" || view === "customer") && (
          <div className="demo-pane demo-pane-customer">
            <div className="device-frame-phone">
              <div className="device-screen">
                <DemoCustomer 
                  onPlaceOrder={handlePlaceOrder} 
                  cart={cart}
                  setCart={setCart}
                />
              </div>
            </div>
            <div className="pane-label">Customer View (Phone)</div>
          </div>
        )}

        {view === "split" && (
          <div className="demo-sync-indicator">
            <div className={`sync-line ${isSyncing ? 'pulse' : ''}`}>
              <MoveRight className="sync-arrow" />
              {isSyncing && <div className="sync-packet"></div>}
            </div>
            <span className="sync-text">{isSyncing ? 'Transmitting...' : 'Real-time Data Transfer'}</span>
          </div>
        )}

        {(view === "split" || view === "kitchen") && (
          <div className="demo-pane demo-pane-kitchen">
             <div className="device-frame-tablet">
                <div className="device-screen">
                  <DemoKitchen 
                    orders={orders} 
                    onMarkReady={handleMarkReady} 
                  />
                </div>
             </div>
             <div className="pane-label">Kitchen Display (Tablet/Monitor)</div>
          </div>
        )}
      </div>
    </div>
  );
}
