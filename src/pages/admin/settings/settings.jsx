import "./settings.css";

export default function Settings() {
  return (
    <div className="settings-page">

      <h1> Platform Settings</h1>

      {/* PROFILE SECTION */}
      <div className="settings-card">
        <h2>Admin Profile</h2>

        <div className="form-group">
          <label>Name</label>
          <input type="text" defaultValue="Admin User" />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input type="email" defaultValue="admin@menumelt.com" />
        </div>

        <button className="save-btn">Save Changes</button>
      </div>

      {/* PASSWORD SECTION */}
      <div className="settings-card">
        <h2>Change Password</h2>

        <div className="form-group">
          <label>Current Password</label>
          <input type="password" placeholder="Enter current password" />
        </div>

        <div className="form-group">
          <label>New Password</label>
          <input type="password" placeholder="Enter new password" />
        </div>

        <button className="save-btn">Update Password</button>
      </div>

      {/* SYSTEM SETTINGS */}
      <div className="settings-card">
        <h2>System Settings</h2>

        <div className="toggle">
          <span>Enable Notifications</span>
          <input type="checkbox" defaultChecked />
        </div>

        <div className="toggle">
          <span>Allow New Registrations</span>
          <input type="checkbox" defaultChecked />
        </div>

        <button className="save-btn">Save Settings</button>
      </div>

    </div>
  );
}