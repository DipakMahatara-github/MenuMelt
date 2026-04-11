import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./auth.css";
import { API_BASE } from "../config";

export default function Register() {

  const navigate = useNavigate();

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
        alert("Registration successful");

        // later we will auto login
        navigate("/login");
      } else {
        alert("Error: " + JSON.stringify(data));
      }

    } catch (err) {
      console.error(err);
      alert("Something went wrong");
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
            Create Restaurant
          </button>

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