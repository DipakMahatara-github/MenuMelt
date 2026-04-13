import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./auth.css";
import { API_BASE } from "../config";
import { clearAuth, setAuthTokens, setUserSession } from "../lib/auth";

export default function Register() {

  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    restaurantName: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 🔥 CONNECT BACKEND
  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (res.ok) {
        clearAuth();
        setAuthTokens({ access: data.access, refresh: data.refresh });
        setUserSession({
          role: data.role,
          restaurant: data.restaurant,
          name: data.name,
          restaurant_active: data.restaurant_active,
          subscription_status: data.subscription_status,
        });
        navigate("/restaurant-admin/subscription");
      } else {
        setError(data.error || "Could not create the restaurant account.");
      }

    } catch (err) {
      console.error(err);
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">

      {/* LEFT */}
      <div className="auth-left">
        <div className="auth-card">

          <h1>Create Account</h1>
          <p className="subtitle">Register your restaurant</p>

          <div className="input-group">

            <input
              type="text"
              name="full_name"   // ✅ FIXED
              placeholder="Owner Name"
              onChange={handleChange}
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              onChange={handleChange}
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              onChange={handleChange}
            />

            <input
              type="text"
              name="restaurantName"
              placeholder="Restaurant Name"
              onChange={handleChange}
            />

          </div>

          <button className="primary-btn" onClick={handleSubmit}>
            {submitting ? "Creating..." : "Create Restaurant"}
          </button>

          {error ? <p className="subtitle" style={{ color: "#fca5a5" }}>{error}</p> : null}

          <p className="switch-text">
            Already registered?{" "}
            <span onClick={() => navigate("/login")}>Login</span>
          </p>

        </div>
      </div>

      {/* RIGHT */}
      <div className="auth-right">
        <div className="auth-overlay"></div>

        <div className="auth-content">
          <h2>MenuMelt</h2>
          <p>Turn tables into smart ordering systems</p>
        </div>
      </div>

    </div>
  );
}
