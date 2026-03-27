import { Routes, Route } from "react-router-dom";

import Landing from "./pages/landing/landing.jsx";
import Login from "./pages/login";
import Register from "./pages/register";

import AdminLayout from "./layout/AdminLayout";

// Admin Pages
import Dashboard from "./pages/admin/dashboard/dashboard";
import Menu from "./pages/admin/menu/menu";
import Tables from "./pages/admin/tables/tables";

// Protected Route
import ProtectedRoute from "./components/ProtectedRoute";

import CustomerMenu from "./pages/customer/menu/menu.jsx";
import Orders from "./pages/admin/orders/orders";
import AdminKitchen from "./pages/admin/adminKitchen/adminKitchen";
import Profile from "./pages/admin/profile/profile";

function App() {
  return (
    <Routes>

      {/* PUBLIC PAGES */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/menu/:id" element={<CustomerMenu />} />

      {/* ADMIN PANEL */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >

        {/* Default Admin Page */}
        <Route index element={<Dashboard />} />

        {/* Admin Pages */}
        <Route path="menu" element={<Menu />} />
        <Route path="tables" element={<Tables />} />
        <Route path="orders" element={<Orders />} />
        <Route path="kitchen" element={<AdminKitchen />} />
        <Route path="profile" element={<Profile />} />

      </Route>

    </Routes>
  );
}

export default App;