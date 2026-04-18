import "./landing.css";
import { useNavigate } from "react-router-dom";
import heroImg from "../../assets/hero-qr-scan.png";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="sage-landing">
      {/* NAVBAR */}
      <nav className="sage-nav">
        <div className="sage-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate("/")}>
          <img src="/logo.png" alt="MenuMelt Logo" style={{ height: '32px', width: 'auto' }} />
          <span style={{ color: '#557855' }}>MenuMelt</span>
        </div>
        <ul className="sage-nav-links">
          <li>How It Works</li>
          <li>Features</li>
          <li>For Restaurants</li>
          <li>Contact</li>
          <li onClick={() => navigate("/login")} className="sage-nav-login">Login</li>
        </ul>
        <button className="sage-btn-primary" onClick={() => navigate("/register")}>
          Get Started
        </button>
      </nav>

      {/* HERO SECTION */}
      <section className="sage-hero">
        <div className="sage-hero-content">
          <h1>
            Smart QR Ordering System <br/>
            for Modern Restaurants
          </h1>
          <p>
            Let customers scan QR, browse menu, place orders and pay directly from
            their table. Faster service. Better experience. Zero waiting.
          </p>
          <div className="sage-hero-buttons">
            <button className="sage-btn-primary" onClick={() => navigate("/register")}>Create Restaurant Account</button>
            <button className="sage-btn-secondary">View Demo</button>
          </div>
        </div>
        <div className="sage-hero-image-container">
            <img src={heroImg} alt="Customer scanning QR code for MenuMelt at a restaurant" className="sage-hero-image" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="sage-features">
        <h2>How It Works</h2>
        <div className="sage-grid-4">
          <div className="sage-feature-card">
            <div className="sage-feature-icon">📱</div>
            <h3>1. Scan QR Code</h3>
            <p>Customer scans QR code placed on the table to access the digital menu.</p>
          </div>
          <div className="sage-feature-card">
            <div className="sage-feature-icon">🛒</div>
            <h3>2. Place Order</h3>
            <p>Browse the visual menu, customize items, and place orders directly from their phone.</p>
          </div>
          <div className="sage-feature-card">
            <div className="sage-feature-icon">👨‍🍳</div>
            <h3>3. Kitchen Prepares</h3>
            <p>The kitchen receives the detailed order instantly on their display panel.</p>
          </div>
          <div className="sage-feature-card">
            <div className="sage-feature-icon">💳</div>
            <h3>4. Serve & Pay</h3>
            <p>Food is perfectly served, and payment is seamlessly completed online or offline.</p>
          </div>
        </div>
      </section>

      {/* FEATURES (Built for Restaurant Owners) */}
      <section className="sage-operations">
        <div className="sage-operations-header">
            <h2>Built for Restaurant Owners</h2>
            <p>Powerful tools specifically designed to streamline your operations.</p>
        </div>
        <div className="sage-grid-4">
          <div className="sage-operation-card">
            <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1000" alt="Live Orders" />
            <div className="sage-operation-info">
                <h4>Live Orders</h4>
                <p>Track all incoming orders in real time. Know exactly what's happening on your floor.</p>
            </div>
          </div>
          <div className="sage-operation-card">
            <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000" alt="Menu Control" />
             <div className="sage-operation-info">
                <h4>Menu Control</h4>
                <p>Add, edit or disable menu items anytime. Your digital menu is always up to date.</p>
            </div>
          </div>
          <div className="sage-operation-card">
            <img src="https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&q=80&w=1000" alt="Kitchen Display" />
             <div className="sage-operation-info">
                <h4>Kitchen Display</h4>
                <p>A dedicated, organized kitchen panel for chefs to prepare meals efficiently.</p>
            </div>
          </div>
          <div className="sage-operation-card">
            <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1000" alt="Sales Reports" />
             <div className="sage-operation-info">
                <h4>Sales Reports</h4>
                <p>View comprehensive daily and monthly analytics to make informed decisions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="sage-cta">
        <h2>Upgrade Your Restaurant Today</h2>
        <p>Join restaurants using our smart QR ordering system to maximize efficiency.</p>
        <button className="sage-btn-primary" onClick={() => navigate("/register")}>
            Get Started Now
        </button>
      </section>

      {/* FOOTER */}
      <footer className="sage-footer">
        <div className="sage-footer-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate("/")}>
          <img src="/logo.png" alt="MenuMelt Logo" style={{ height: '32px', width: 'auto' }} />
          <span style={{ color: '#557855' }}>MenuMelt</span>
        </div>
        <div className="sage-footer-links">
            <span>How It Works</span>
            <span>Features</span>
            <span>Contact</span>
            <span>Privacy Policy</span>
        </div>
        <div className="sage-footer-copyright">
            &copy; {new Date().getFullYear()} MenuMelt. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
