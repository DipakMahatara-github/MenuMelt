import { Routes, Route } from "react-router-dom";

import Landing from "./pages/landing/landing";
import Login from "./pages/login";
import Register from "./pages/register";

import AdminLayout from "./layout/AdminLayout";
import Dashboard from "./pages/admin/dashboard";

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
        <Route path="orders" element={<h1>Orders Page</h1>} />
        <Route path="menu" element={<h1>Menu Page</h1>} />
        <Route path="tables" element={<h1>Tables Page</h1>} />
        <Route path="kitchen" element={<h1>Kitchen Page</h1>} />
        <Route path="reports" element={<h1>Reports Page</h1>} />
        <Route path="settings" element={<h1>Settings Page</h1>} />

      </Route>

    </Routes>
  );
}

export default App;
