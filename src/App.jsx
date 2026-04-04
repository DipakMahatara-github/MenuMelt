import { Routes, Route } from "react-router-dom";

/* ================= PUBLIC ================= */
import Landing from "./pages/landing/landing.jsx";
import Login from "./pages/login";
import Register from "./pages/register";

/* ================= PLATFORM ADMIN ================= */
import PlatformAdminLayout from "./layout/PlatformAdminLayout";
import AdminDashboard from "./pages/admin/dashboard/dashboard";
import Users from "./pages/admin/users/users";
import Restaurants from "./pages/admin/restaurants/restaurants";
import Subscriptions from "./pages/admin/subscriptions/subscriptions";
import Settings from "./pages/admin/settings/settings";

/* ================= RESTAURANT ADMIN ================= */
import AdminLayout from "./layout/AdminLayout";
import Dashboard from "./pages/restaurant_admin/dashboard/dashboard.jsx";
import AdminMenu from "./pages/restaurant_admin/menu/AdminMenu.jsx";
import Tables from "./pages/restaurant_admin/tables/tables.jsx";
import Orders from "./pages/restaurant_admin/orders/orders.jsx";
import AdminKitchen from "./pages/restaurant_admin/adminKitchen/adminKitchen.jsx";
import Profile from "./pages/restaurant_admin/profile/profile.jsx";
import Subscription from "./pages/restaurant_admin/subscription/subscription.jsx";

/* ================= STAFF ================= */
import Staff from "./pages/staff/staff";

/* ================= KITCHEN ================= */
import Kitchen from "./pages/kitchen/kitchen";

/* ================= CUSTOMER ================= */
import CustomerMenu from "./pages/customer/menu/CustomerMenu";

/* ================= PROTECTED ================= */
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>

      {/* ================= PUBLIC ================= */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* ================= CUSTOMER ================= */}
      <Route path="/menu" element={<CustomerMenu />} />
      <Route path="/menu/:id" element={<CustomerMenu />} />

      {/* ================= PLATFORM ADMIN ================= */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <PlatformAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* ================= RESTAURANT ADMIN ================= */}
      <Route
        path="/restaurant-admin"
        element={
          <ProtectedRoute allowedRole="restaurant_admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="menu" element={<AdminMenu />} />
        <Route path="tables" element={<Tables />} />
        <Route path="kitchen" element={<AdminKitchen />} />
        <Route path="subscription" element={<Subscription />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* ================= STAFF ================= */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRole="staff">
            <Staff />
          </ProtectedRoute>
        }
      />

      {/* ================= KITCHEN ================= */}
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