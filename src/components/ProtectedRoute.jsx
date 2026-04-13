import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, getRestaurantActive, getUserRole } from "../lib/auth";

export default function ProtectedRoute({ children, allowedRole, allowedRoles }) {
  const location = useLocation();
  const token = getAccessToken();
  const role = getUserRole();
  const restaurantActive = getRestaurantActive();
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

  if (
    role === "restaurant_admin" &&
    restaurantActive === false &&
    !location.pathname.startsWith("/restaurant-admin/subscription") &&
    !location.pathname.startsWith("/restaurant-admin/profile")
  ) {
    return <Navigate to="/restaurant-admin/subscription" replace />;
  }

  return children;
}
