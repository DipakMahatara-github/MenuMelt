import "./users.css";
import { useState } from "react";

export default function Users() {
  const [search, setSearch] = useState("");

  const users = [
    { email: "admin@menumelt.com", role: "admin" },
    { email: "restaurant@menumelt.com", role: "restaurant_admin" },
    { email: "waiter@menumelt.com", role: "waiter" },
  ];

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="users-page">

      <div className="page-header">
        <h2>Users</h2>
        <input
          type="text"
          placeholder="Search users..."
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((user, i) => (
              <tr key={i}>
                <td>{user.email}</td>
                <td>
                  <span className={`badge ${user.role}`}>
                    {user.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
