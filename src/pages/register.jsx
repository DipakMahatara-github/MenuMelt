import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./auth.css";

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState("customer");

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Restaurant QR System</h1>
        <p className="subtitle">Create a new account</p>

        <input type="text" placeholder="Full Name" />
        <input type="email" placeholder="Email Address" />
        <input type="password" placeholder="Password" />

        <h3>Role Selection</h3>
        <div className="role-grid">
          {["customer", "restaurant", "kitchen", "admin"].map((r) => (
            <button
              key={r}
              className={`role-btn ${role === r ? "active" : ""}`}
              onClick={() => setRole(r)}
            >
              {r === "restaurant" ? "Restaurant Staff" : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        <button className="primary-btn">Sign Up</button>

        <p className="switch-text">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>Login here</span>
        </p>
      </div>
    </div>
  );
}
