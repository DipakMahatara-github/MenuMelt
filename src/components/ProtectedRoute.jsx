import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, allowedRole }) {

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return <Navigate to="/login" />;
  }

  // ✅ allow admin + kitchen
  if (allowedRole === "admin" && role !== "admin" && role !== "kitchen") {
    return <Navigate to="/login" />;
  }

  return children;
}