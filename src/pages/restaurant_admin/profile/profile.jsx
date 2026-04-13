import { useEffect, useState } from "react";
import { authFetch, API_BASE } from "../../../lib/api";
import PasswordField from "../../../components/PasswordField";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    authFetch(`${API_BASE}/api/auth/profile/`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
      })
      .catch(err => console.error(err));
  }, []);

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
    <div className="p-[30px]">
      <div className="mb-[25px] flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-slate-950">Profile Settings</h1>
      </div>

      <div className="mb-[25px] flex items-center gap-5 rounded-2xl bg-white/70 p-[25px] shadow-[0_10px_30px_rgba(0,0,0,0.05)] backdrop-blur-[14px] transition hover:-translate-y-[3px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
        <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#2563eb,#3b82f6)] text-[22px] font-semibold text-white">
          {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "A"}
        </div>

        <div>
          <h3 className="m-0 text-xl font-semibold text-slate-950">{user?.full_name || "Loading..."}</h3>
          <p className="text-sm text-slate-500">{user?.role || "Role"}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white/70 p-[25px] shadow-[0_10px_30px_rgba(0,0,0,0.05)] backdrop-blur-[14px] transition hover:-translate-y-[3px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
        <h3 className="mb-5 text-xl font-semibold text-slate-950">Change Password</h3>

        <div className="mb-[15px]">
          <label className="text-[13px] text-slate-500">Current Password</label>
          <PasswordField
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-[5px] w-full rounded-[10px] border border-slate-200 px-3 py-3 pr-11 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
            buttonClassName="text-slate-400 hover:text-blue-500 focus-visible:ring-blue-300"
          />
        </div>

        <div className="mb-[15px]">
          <label className="text-[13px] text-slate-500">New Password</label>
          <PasswordField
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-[5px] w-full rounded-[10px] border border-slate-200 px-3 py-3 pr-11 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
            buttonClassName="text-slate-400 hover:text-blue-500 focus-visible:ring-blue-300"
          />
        </div>

        <button
          className="rounded-[10px] bg-[linear-gradient(90deg,#2563eb,#3b82f6)] px-[18px] py-2.5 text-white transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(37,99,235,0.3)]"
          onClick={handleChangePassword}
        >
          Update Password
        </button>
      </div>
    </div>
  );
}
