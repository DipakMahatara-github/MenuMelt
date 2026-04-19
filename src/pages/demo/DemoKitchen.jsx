import React from "react";
import { Clock, CheckCircle2 } from "lucide-react";

export default function DemoKitchen({ orders, onMarkReady }) {
  const preparing = orders.filter(o => o.status === 'preparing');
  const ready = orders.filter(o => o.status === 'ready');

  const getTimeAgo = (isoString) => {
    const diff = Math.floor((new Date() - new Date(isoString)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  return (
    <div className="demo-kitchen">
      <header className="kitchen-header">
        <div className="brand">
          <span className="live-dot"></span>
          <h2>Live Kitchen Feed</h2>
        </div>
        <div className="stats">
          <span className="stat-pill">{preparing.length} Preparing</span>
          <span className="stat-pill ready">{ready.length} Ready</span>
        </div>
      </header>

      <div className="kitchen-grid">
        <section className="kitchen-col">
          <h3><Clock size={16} /> Preparing</h3>
          <div className="tickets">
            {preparing.length === 0 ? (
              <div className="empty-state">
                <p>Waiting for orders from the floor...</p>
                <div className="tip">Tip: Place an order on the phone view!</div>
              </div>
            ) : (
              preparing.map(order => (
                <div key={order.id} className="ticket">
                  <div className="ticket-head">
                    <span className="table">Table {order.table_number}</span>
                    <span className="order-id">#{order.id}</span>
                  </div>
                  <ul className="ticket-items">
                    {order.items.map((item, idx) => (
                      <li key={idx}>
                        <span className="qty">{item.quantity}x</span>
                        <span className="name">{item.name}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="ticket-footer">
                     <span className="time">{getTimeAgo(order.created_at)}</span>
                     <button className="ready-btn" onClick={() => onMarkReady(order.id)}>Mark Ready</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="kitchen-col">
          <h3><CheckCircle2 size={16} /> Ready for Service</h3>
          <div className="tickets">
             {ready.map(order => (
                <div key={order.id} className="ticket ready">
                  <div className="ticket-head">
                    <span className="table">Table {order.table_number}</span>
                    <span className="order-id">#{order.id}</span>
                  </div>
                   <ul className="ticket-items">
                    {order.items.map((item, idx) => (
                      <li key={idx}>
                         <span className="qty">{item.quantity}x</span>
                         <span className="name">{item.name}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="ready-badge">Ready for waiter</div>
                </div>
             ))}
          </div>
        </section>
      </div>

      <style>{`
        .demo-kitchen {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #0f172a;
          color: white;
          font-family: 'Inter', sans-serif;
        }
        .kitchen-header {
          padding: 20px;
          border-bottom: 1px solid #1e293b;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .brand { display: flex; align-items: center; gap: 10px; }
        .live-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 10px #22c55e; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        .brand h2 { margin: 0; font-size: 1.1rem; letter-spacing: 0.5px; }
        .stats { display: flex; gap: 8px; }
        .stat-pill { background: #334155; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; color: #94a3b8; }
        .stat-pill.ready { color: #22c55e; }
        
        .kitchen-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; }
        .kitchen-col { display: flex; flex-direction: column; border-right: 1px solid #1e293b; }
        .kitchen-col h3 { padding: 16px; margin: 0; font-size: 0.85rem; text-transform: uppercase; color: #64748b; display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.1); }
        
        .tickets { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
        .ticket { background: #1e293b; border-radius: 12px; padding: 16px; border-left: 4px solid #3b82f6; box-shadow: 0 8px 16px rgba(0,0,0,0.2); }
        .ticket.ready { border-left-color: #22c55e; opacity: 0.8; }
        .ticket-head { display: flex; justify-content: space-between; margin-bottom: 12px; }
        .table { font-weight: 800; color: white; font-size: 1rem; }
        .order-id { color: #64748b; font-family: monospace; }
        
        .ticket-items { list-style: none; padding: 0; margin: 0 0 16px; }
        .ticket-items li { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .qty { color: #fbbf24; font-weight: 800; min-width: 24px; }
        .name { color: #cbd5e1; font-size: 0.9rem; }
        
        .ticket-footer { display: flex; justify-content: space-between; align-items: center; }
        .time { font-size: 0.75rem; color: #64748b; }
        .ready-btn { background: #16a34a; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: background 0.2s; }
        .ready-btn:hover { background: #15803d; }
        
        .ready-badge { text-align: center; color: #22c55e; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: rgba(34, 197, 94, 0.1); padding: 8px; border-radius: 6px; }
        
        .empty-state { text-align: center; padding: 40px 20px; color: #475569; }
        .tip { font-size: 0.75rem; margin-top: 12px; color: #3b82f6; font-weight: 600; }
      `}</style>
    </div>
  );
}
