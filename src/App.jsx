import { Routes, Route } from "react-router-dom";

import Landing from "./pages/landing/landing.jsx";
import Login from "./pages/login";
import Register from "./pages/register";

import AdminLayout from "./layout/AdminLayout";

// Admin Pages
import Dashboard from "./pages/admin/dashboard/dashboard";
import Menu from "./pages/admin/menu/menu";

function App() {
  return (
    <Routes>

      {/* Public Pages */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Admin Panel */}
      <Route path="/admin" element={<AdminLayout />}>

        <Route index element={<Dashboard />} />
        <Route path="menu" element={<Menu />} />

        {/* Future Pages */}
        <Route path="orders" element={<h1>Orders</h1>} />
        <Route path="tables" element={<h1>Tables</h1>} />
        <Route path="kitchen" element={<h1>Kitchen</h1>} />
        <Route path="reports" element={<h1>Reports</h1>} />
        <Route path="settings" element={<h1>Settings</h1>} />

      </Route>

    </Routes>
  );
}

export default App;
