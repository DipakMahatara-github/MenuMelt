import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./auth.css";

export default function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Invalid email or password");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      if (data.role === "admin") navigate("/admin");
      else if (data.role === "restaurant_admin") navigate("/restaurant-admin");
      else if (data.role === "staff") navigate("/staff");
      else if (data.role === "kitchen") navigate("/kitchen");

    } catch (err) {
      alert("Server error");
    }
  };

  return (
    <div className="auth-container">

      {/* LEFT */}
      <div className="auth-left">
        <div className="auth-card">

          <h1>Login</h1>
          <p className="subtitle">Access your restaurant dashboard</p>

          <form onSubmit={handleLogin}>
            <div className="input-group">

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

            </div>

            <button className="primary-btn">Log In</button>
          </form>

          <p className="switch-text">
            New here? <span onClick={() => navigate("/register")}>Create account</span>
          </p>

        </div>
      </div>

      {/* RIGHT */}
      <div className="auth-right">
        <div className="auth-overlay"></div>

        <div className="auth-content">
          <h2>MenuMelt</h2>
          <p>Smart QR ordering system for modern restaurants</p>
        </div>
      </div>

    </div>
  );
}