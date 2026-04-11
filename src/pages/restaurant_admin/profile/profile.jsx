import { useEffect, useState } from "react";
import "./profile.css";
import { authFetch, API_BASE } from "../../../lib/api";

export default function Profile() {

  // 🔥 USER DATA
  const [user, setUser] = useState(null);

  // 🔐 PASSWORD STATES
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // ================= FETCH PROFILE =================
  useEffect(() => {
    authFetch(`${API_BASE}/api/auth/profile/`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
      })
      .catch(err => console.error(err));
  }, []);

  // ================= CHANGE PASSWORD =================
  const handleChangePassword = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/auth/change-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        alert("Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        alert(data.error || "Error updating password");
      }

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="profile-container">

      {/* HEADER */}
      <div className="profile-header">
        <h1>Profile Settings</h1>
      </div>

      {/* USER INFO */}
      <div className="card profile-info">

        <div className="avatar">
          {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "A"}
        </div>

        <div className="profile-text">
          <h3>{user?.full_name || "Loading..."}</h3>
          <p>{user?.role || "Role"}</p>
        </div>

      </div>

      {/* CHANGE PASSWORD */}
      <div className="card">

        <h3>Change Password</h3>

        <div className="input-group">
          <label>Current Password</label>
          <input
            type="password"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>New Password</label>
          <input
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <button className="btn-primary" onClick={handleChangePassword}>
          Update Password
        </button>

      </div>

    </div>
  );
}