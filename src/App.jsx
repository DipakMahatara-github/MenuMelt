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
import PaymentSettings from "./pages/restaurant_admin/payment/PaymentSettings.jsx";
import Team from "./pages/restaurant_admin/team/Team.jsx";

/* ================= WAITER / CASHIER ================= */
import Waiter from "./pages/waiter/Waiter";
import Cashier from "./pages/cashier/Cashier";

/* ================= KITCHEN ================= */
import Kitchen from "./pages/kitchen/kitchen";

/* ================= CUSTOMER ================= */
import CustomerMenu from "./pages/customer/menu/CustomerMenu";
import CustomerCart from "./pages/customer/Cart.jsx";
import Checkout from "./pages/customer/Checkout.jsx";
import Billing from "./pages/customer/Billing.jsx";
import MyOrders from "./pages/customer/MyOrders.jsx";
import KhaltiReturn from "./pages/customer/KhaltiReturn.jsx";

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
      <Route path="/cart" element={<CustomerCart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/billing/:orderId" element={<Billing />} />
      <Route path="/my-orders" element={<MyOrders />} />
      <Route path="/payment/khalti/success" element={<KhaltiReturn />} />

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
        <Route path="payment" element={<PaymentSettings />} />
        <Route path="team" element={<Team />} />
      </Route>

      {/* ================= WAITER ================= */}
      <Route
        path="/waiter"
        element={
          <ProtectedRoute allowedRole="waiter">
            <Waiter />
          </ProtectedRoute>
        }
      />

      {/* ================= CASHIER ================= */}
      <Route
        path="/cashier"
        element={
          <ProtectedRoute allowedRole="cashier">
            <Cashier />
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
