import { Navigate } from "react-router-dom";
import { getAccessToken, getUserRole } from "../lib/auth";

export default function ProtectedRoute({ children, allowedRole, allowedRoles }) {

  const token = getAccessToken();
  const role = getUserRole();
  const permittedRoles = allowedRoles || (allowedRole ? [allowedRole] : []);

  // ✅ Public routes (like /menu)
  if (permittedRoles.length === 0) {
    return children;
  }

  // ❌ Not logged in
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // ❌ Wrong role
  if (!permittedRoles.includes(role)) {

    const roleRoutes = {
      admin: "/admin",
      restaurant_admin: "/restaurant-admin",
      waiter: "/waiter",
      cashier: "/cashier",
      kitchen: "/kitchen",
    };

    return <Navigate to={roleRoutes[role] || "/login"} replace />;
  }

  return children;
}
