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

      if (data.role === "admin") {
        navigate("/admin", { replace: true });
      } 
      else if (data.role === "restaurant_admin") {
        navigate("/restaurant-admin", { replace: true });
      } 
      else if (data.role === "staff") {
        navigate("/staff", { replace: true });
      } 
      else if (data.role === "kitchen") {
        navigate("/kitchen", { replace: true });
      } 
      else {
        alert("Invalid role");
        localStorage.clear();
      }

    } catch (error) {
      console.error(error);
      alert("Server error");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">

        <h1>Login</h1>
        <p className="subtitle">Login to your account</p>

        <form onSubmit={handleLogin}>

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="primary-btn" type="submit">
            Log In
          </button>

        </form>

      </div>
    </div>
  );
}