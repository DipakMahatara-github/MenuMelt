import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, allowedRole }) {

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // ❌ Not logged in
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // ❌ Wrong role
  if (allowedRole && role !== allowedRole) {

    if (role === "admin") {
      return <Navigate to="/admin" replace />;
    }

    if (role === "kitchen") {
      return <Navigate to="/kitchen" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  // ✅ Allowed
  return children;
}