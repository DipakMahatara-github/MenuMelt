import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, allowedRole }) {

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // ✅ Public routes (like /menu)
  if (!allowedRole) {
    return children;
  }

  // ❌ Not logged in
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // ❌ Wrong role
  if (role !== allowedRole) {

    const roleRoutes = {
      admin: "/admin",
      restaurant_admin: "/restaurant-admin",
      staff: "/staff",
      kitchen: "/kitchen"
    };

    return <Navigate to={roleRoutes[role] || "/login"} replace />;
  }

  return children;
}