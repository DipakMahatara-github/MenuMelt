import "./subscription.css";

export default function Subscription() {

  return (
    <div className="subscription-container">

      <h1>Subscription Plans</h1>

      <div className="plans">

        {/* FREE PLAN */}
        <div className="plan-card">
          <h2>Free</h2>
          <p className="price">Rs. 0</p>
          <ul>
            <li>✔ Basic Menu</li>
            <li>✔ QR Ordering</li>
            <li>❌ Analytics</li>
          </ul>
          <button disabled>Current Plan</button>
        </div>

        {/* PRO PLAN */}
        <div className="plan-card popular">
          <h2>Pro</h2>
          <p className="price">Rs. 999 / month</p>
          <ul>
            <li>✔ Everything in Free</li>
            <li>✔ Order Analytics</li>
            <li>✔ Kitchen Monitor</li>
          </ul>
          <button>Upgrade</button>
        </div>

        {/* PREMIUM */}
        <div className="plan-card">
          <h2>Premium</h2>
          <p className="price">Rs. 1999 / month</p>
          <ul>
            <li>✔ All Features</li>
            <li>✔ Multi-restaurant</li>
            <li>✔ Priority Support</li>
          </ul>
          <button>Upgrade</button>
        </div>

      </div>

    </div>
  );
}