import { Navigate } from "react-router-dom";
import { getAccessToken, getUserRole } from "../lib/auth";

export default function ProtectedRoute({ children, allowedRole }) {

  const token = getAccessToken();
  const role = getUserRole();

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