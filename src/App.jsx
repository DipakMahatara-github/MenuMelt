import { Routes, Route } from "react-router-dom";

import Landing from "./pages/landing/landing.jsx";
import Login from "./pages/login";
import Register from "./pages/register";

import AdminLayout from "./layout/AdminLayout";
import Dashboard from "./pages/admin/dashboard/dashboard";
import Menu from "./pages/admin/menu/menu";
import Tables from "./pages/admin/tables/tables";
import Orders from "./pages/admin/orders/orders";
import AdminKitchen from "./pages/admin/adminKitchen/adminKitchen";
import Profile from "./pages/admin/profile/profile";
import Subscription from "./pages/admin/subscription/subscription";

import Kitchen from "./pages/kitchen/kitchen";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>

      {/* PUBLIC */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* ADMIN */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="menu" element={<Menu />} />
        <Route path="tables" element={<Tables />} />
        <Route path="kitchen" element={<AdminKitchen />} />
        <Route path="subscription" element={<Subscription />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* 🔥 KITCHEN (SEPARATE UI) */}
      <Route
        path="/kitchen"
        element={
          <ProtectedRoute allowedRole="kitchen">
            <Kitchen />
          </ProtectedRoute>
        }
      />

    </Routes>
  );
}

export default App;