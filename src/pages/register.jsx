import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { clearAuth, setAuthTokens, setUserSession } from "../lib/auth";
import PasswordField from "../components/PasswordField";

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

  const inputClasses =
    "w-full border-0 border-b border-slate-300 bg-transparent px-0 py-3 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-b-2 focus:border-indigo-500";

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
    <div className="flex min-h-screen w-full font-sans">
      <div className="flex flex-1 items-center justify-center bg-[#f8faf5] px-6 py-10 sm:px-10">
        <div className="w-full max-w-[380px]">
          <h1 className="mb-2 text-[28px] font-bold text-slate-950">Create Account</h1>
          <p className="mb-6 text-sm text-slate-500">Register your restaurant</p>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <div className="flex flex-col gap-4">
            <input
              type="text"
              name="full_name"
              placeholder="Owner Name"
              onChange={handleChange}
              className={inputClasses}
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              onChange={handleChange}
              className={inputClasses}
            />

            <PasswordField
              name="password"
              placeholder="Password"
              onChange={handleChange}
              className={inputClasses}
              buttonClassName="text-slate-400 hover:text-amber-500 focus-visible:ring-amber-300"
            />

            <input
              type="text"
              name="restaurantName"
              placeholder="Restaurant Name"
              onChange={handleChange}
              className={inputClasses}
            />
          </div>

            <button
              type="submit"
              className="w-full rounded-md bg-amber-500 px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Restaurant"}
            </button>
          </form>

          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

          <p className="mt-4 text-[13px] text-slate-500">
            Already registered?{" "}
            <button type="button" className="font-medium text-amber-500" onClick={() => navigate("/login")}>
              Login
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
          <div 
            className="flex items-center gap-3 mb-2 cursor-pointer transition hover:opacity-80"
            onClick={() => navigate("/")}
          >
            <img src="/logo.png" alt="MenuMelt Logo" className="h-[38px] w-auto rounded-md shadow-sm" />
            <h2 className="text-[26px] font-bold text-[#557855]">MenuMelt</h2>
          </div>
          <p className="mt-2 text-sm text-white/80">Turn tables into smart ordering systems</p>
        </div>
      </div>
    </div>
  );
}
