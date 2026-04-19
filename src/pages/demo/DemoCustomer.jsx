import React, { useState } from "react";
import { ShoppingCart, Star, Plus, Minus, Search } from "lucide-react";
import { DEMO_CATEGORIES, DEMO_ITEMS } from "./demoData";

export default function DemoCustomer({ onPlaceOrder, cart, setCart }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [showCheckout, setShowCheckout] = useState(false);
  const [hasAddedToCart, setHasAddedToCart] = useState(false);
  const [hasPlacedOrder, setHasPlacedOrder] = useState(false);

  const filteredItems = activeCategory === "all" 
    ? DEMO_ITEMS 
    : DEMO_ITEMS.filter(item => item.category === activeCategory);

  const addToCart = (item) => {
    setHasAddedToCart(true);
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(0, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleOrder = () => {
    onPlaceOrder({ items: cart, total });
    setCart([]);
    setShowCheckout(true);
    setHasPlacedOrder(true);
    setTimeout(() => setShowCheckout(false), 3000);
  };

  return (
    <div className="demo-customer">
      <header className="customer-header">
        <div className="brand">
          <span className="tag">Table 4</span>
          <h2>Sage Bistro Demo</h2>
        </div>
        <div className="cart-badge">
          <ShoppingCart size={20} />
          {cart.length > 0 && <span className="count">{cart.reduce((s,i) => s+i.quantity, 0)}</span>}
        </div>
      </header>

      <div className="customer-search">
        <Search size={18} className="search-icon" />
        <input type="text" placeholder="Search menu..." readOnly />
      </div>

      <div className="category-tabs">
        <button 
          className={activeCategory === 'all' ? 'active' : ''} 
          onClick={() => setActiveCategory('all')}
        >All</button>
        {DEMO_CATEGORIES.map(cat => (
          <button 
            key={cat.id} 
            className={activeCategory === cat.id ? 'active' : ''}
            onClick={() => setActiveCategory(cat.id)}
          >{cat.name}</button>
        ))}
      </div>

      <div className="items-list">
        {filteredItems.map(item => (
          <div key={item.id} className="item-card">
            <img src={item.image} alt={item.name} />
            <div className="item-info">
              <div className="item-top">
                <h3>{item.name}</h3>
                {item.is_popular && <span className="popular">Popular</span>}
              </div>
              <p className="desc">{item.description}</p>
              <div className="item-bottom">
                <span className="price">Rs. {item.price}</span>
                <button className="add-btn" onClick={() => addToCart(item)}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="customer-footer">
          <div className="cart-preview">
             <span>{cart.length} items added</span>
             <strong>Rs. {total}</strong>
          </div>
          <button className="order-btn" onClick={handleOrder}>Place Order</button>
        </div>
      )}

      {showCheckout && (
        <div className="order-success-overlay">
          <div className="success-content">
            <div className="success-icon">✓</div>
            <h3>Order Placed!</h3>
            <p>Sent to the kitchen. Look at the Split View sync!</p>
          </div>
        </div>
      )}

      {/* Onboarding Hints */}
      {!hasAddedToCart && (
        <div className="onboarding-hint">
          <span className="hint-pulse"></span>
          <p>Step 1: Click the ( + ) to add a MoMo!</p>
        </div>
      )}
      {hasAddedToCart && !hasPlacedOrder && cart.length > 0 && (
        <div className="onboarding-hint highlight">
          <span className="hint-pulse"></span>
          <p>Step 2: Click "Place Order" to sync!</p>
        </div>
      )}

      <style>{`
        .demo-customer {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #f8fafc;
          font-family: 'Inter', sans-serif;
          position: relative;
        }
        .customer-header {
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
        }
        .tag { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; font-weight: 700; }
        .brand h2 { margin: 0; font-size: 1.1rem; color: #1e293b; }
        .cart-badge { position: relative; color: #64748b; }
        .count { position: absolute; top: -8px; right: -8px; background: #16a34a; color: white; font-size: 10px; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        
        .customer-search { margin: 0 16px 16px; position: relative; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .customer-search input { width: 100%; padding: 10px 10px 10px 40px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 0.9rem; background: #f1f5f9; }
        
        .category-tabs { display: flex; gap: 8px; overflow-x: auto; padding: 0 16px 16px; scrollbar-width: none; }
        .category-tabs button { border: none; padding: 8px 16px; border-radius: 99px; background: white; color: #64748b; font-weight: 600; font-size: 0.85rem; cursor: pointer; white-space: nowrap; }
        .category-tabs button.active { background: #16a34a; color: white; }
        
        .items-list { flex: 1; overflow-y: auto; padding: 0 16px 100px; display: flex; flex-direction: column; gap: 12px; }
        .item-card { background: white; border-radius: 16px; overflow: hidden; display: flex; gap: 12px; padding: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .item-card img { width: 90px; height: 90px; border-radius: 12px; object-fit: cover; }
        .item-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
        .item-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .item-top h3 { margin: 0; font-size: 0.95rem; color: #1e293b; }
        .popular { font-size: 9px; background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: 700; }
        .desc { margin: 4px 0; font-size: 0.75rem; color: #64748b; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .item-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
        .price { font-weight: 700; color: #16a34a; font-size: 0.95rem; }
        .add-btn { background: #16a34a; color: white; border: none; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        
        .customer-footer { position: absolute; bottom: 0; left: 0; right: 0; background: white; padding: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 -10px 20px rgba(0,0,0,0.05); }
        .cart-preview span { display: block; font-size: 0.75rem; color: #64748b; }
        .cart-preview strong { color: #1e293b; font-size: 1.05rem; }
        .order-btn { background: #16a34a; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; }
        
        .order-success-overlay { position: absolute; inset: 0; background: rgba(255,255,255,0.95); z-index: 50; display: flex; align-items: center; justify-content: center; text-align: center; }
        .success-icon { width: 60px; height: 60px; background: #16a34a; color: white; font-size: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .success-content h3 { margin: 0; color: #1e293b; }
        .success-content p { color: #64748b; font-size: 0.9rem; margin-top: 8px; }

        .onboarding-hint { position: absolute; bottom: 80px; left: 16px; right: 16px; background: #2d3e2d; color: white; padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 12px; animation: slide-up 0.4s ease-out; z-index: 40; box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
        .onboarding-hint.highlight { background: #16a34a; }
        .hint-pulse { width: 10px; height: 10px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); animation: hint-pulse 2s infinite; }
        
        @keyframes hint-pulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .onboarding-hint p { margin: 0; font-size: 0.85rem; font-weight: 600; }
      `}</style>
    </div>
  );
}
