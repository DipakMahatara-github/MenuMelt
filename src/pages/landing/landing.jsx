import "./landing.css";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* NAVBAR */}
      <nav className="home-navbar">
        <div className="logo">MenuMelt</div>

        <ul className="nav-links">
          <li>How It Works</li>
          <li>Features</li>
          <li>For Restaurants</li>
          <li>Contact</li>
        </ul>

        <div className="nav-actions">
          <button className="btn-outline" onClick={() => navigate("/login")}>
            Login
          </button>
          <button className="btn-fill" onClick={() => navigate("/register")}>
            Get Started
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="hero-section">
        <div className="hero-text">
          <h1>
            Smart QR Ordering System <br />
            for <span>Modern Restaurants</span>
          </h1>

          <p>
            Let customers scan QR, browse menu, place orders and pay directly from
            their table. Faster service. Better experience. Zero waiting.
          </p>

          <div className="hero-buttons">
            <button className="btn-fill" onClick={() => navigate("/register")}>
              Create Restaurant Account
            </button>
            <button className="btn-outline">View Demo</button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="mockup phone">Customer Menu</div>
          <div className="mockup tablet">Kitchen Screen</div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section">
        <h2>How It Works</h2>

        <div className="steps">
          <div className="step-card">
            <h3>1. Scan QR Code</h3>
            <p>Customer scans QR code placed on table.</p>
          </div>

          <div className="step-card">
            <h3>2. Place Order</h3>
            <p>Browse menu and place order from phone.</p>
          </div>

          <div className="step-card">
            <h3>3. Kitchen Prepares</h3>
            <p>Kitchen receives order instantly.</p>
          </div>

          <div className="step-card">
            <h3>4. Serve & Pay</h3>
            <p>Food served and payment completed.</p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section">
        <h2>Built for Restaurant Owners</h2>

        <div className="feature-grid">
          <div className="feature-box">
            <h4>Live Orders</h4>
            <p>Track all incoming orders in real time.</p>
          </div>

          <div className="feature-box">
            <h4>Menu Control</h4>
            <p>Add, edit or disable menu items anytime.</p>
          </div>

          <div className="feature-box">
            <h4>Kitchen Display</h4>
            <p>Dedicated kitchen panel for chefs.</p>
          </div>

          <div className="feature-box">
            <h4>Sales Reports</h4>
            <p>View daily and monthly analytics.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>Upgrade Your Restaurant Today</h2>
        <p>Join restaurants using smart QR ordering system.</p>
        <button className="btn-fill" onClick={() => navigate("/register")}>
          Get Started Now
        </button>
      </section>
    </div>
  );
}
