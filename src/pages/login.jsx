import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { clearAuth, setAuthTokens, setUserSession } from "../lib/auth";
import { API_BASE } from "../config";
import PasswordField from "../components/PasswordField";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const inputClasses =
    "w-full border-0 border-b border-slate-300 bg-transparent px-0 py-3 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-b-2 focus:border-indigo-500";

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${API_BASE}/api/auth/login/`, {
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

      // 🔥 CLEAR OLD SESSION (IMPORTANT)
      clearAuth();

      // ✅ STORE EVERYTHING
      setAuthTokens({ access: data.access, refresh: data.refresh });
      setUserSession({
        role: data.role,
        restaurant: data.restaurant,
        name: data.name,
        restaurant_active: data.restaurant_active,
        subscription_status: data.subscription_status,
      });

      // ✅ ROLE BASED NAVIGATION
      if (data.role === "admin") navigate("/admin");
      else if (data.role === "restaurant_admin") navigate("/restaurant-admin");
      else if (data.role === "waiter") navigate("/waiter");
      else if (data.role === "cashier") navigate("/cashier");
      else if (data.role === "kitchen") navigate("/kitchen");

    } catch {
      alert("Server error");
    }
  };

  return (
    <div className="flex min-h-screen w-full font-sans">
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-10 sm:px-10">
        <div className="w-full max-w-[380px]">
          <h1 className="mb-2 text-[28px] font-bold text-slate-950">Login</h1>
          <p className="mb-6 text-sm text-slate-500">Access your restaurant dashboard</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
              />

              <PasswordField
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClasses}
                buttonClassName="text-slate-400 hover:text-amber-500 focus-visible:ring-amber-300"
              />
            </div>

            <button className="w-full rounded-md bg-amber-500 px-4 py-3 font-semibold text-white transition hover:opacity-90">
              Log In
            </button>
          </form>

          <p className="mt-4 text-[13px] text-slate-500">
            New here?{" "}
            <button type="button" className="font-medium text-amber-500" onClick={() => navigate("/register")}>
              Create account
            </button>
          </p>
        </div>
      </div>

      <div
        className="relative hidden flex-1 items-end bg-cover bg-center bg-no-repeat p-10 text-white min-[901px]:flex"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1555396273-367ea4eb4db5")' }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10">
          <h2 className="text-[26px] font-bold">MenuMelt</h2>
          <p className="mt-2 text-sm text-white/80">Smart QR ordering system for modern restaurants</p>
        </div>
      </div>
    </div>
  );
}
