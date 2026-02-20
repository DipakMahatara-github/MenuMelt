import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./auth.css";

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("customer");

  const handleLogin = (e) => {
    e.preventDefault();

    // Role-based redirect
    if (role === "admin") {
      navigate("/admin");
    } 
    else if (role === "restaurant") {
      navigate("/restaurant");
    } 
    else if (role === "kitchen") {
      navigate("/kitchen");
    } 
    else {
      navigate("/customer");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Welcome</h1>
        <p className="subtitle">Login to your account</p>

        <input type="email" placeholder="Email Address" />
        <input type="password" placeholder="Password" />

        <h3>Role Selection</h3>
        <div className="role-grid">
          {["customer", "restaurant", "kitchen", "admin"].map((r) => (
            <button
              key={r}
              type="button"
              className={`role-btn ${role === r ? "active" : ""}`}
              onClick={() => setRole(r)}
            >
              {r === "restaurant"
                ? "Restaurant Staff"
                : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        <button className="primary-btn" onClick={handleLogin}>
          Log In
        </button>

        <p className="switch-text">
          New user?{" "}
          <span onClick={() => navigate("/register")}>
            Register here
          </span>
        </p>
      </div>
    </div>
  );
}
