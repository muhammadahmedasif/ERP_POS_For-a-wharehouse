import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid or missing reset token");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      toast.success("Password reset successfully. You can now log in.");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center relative">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl bg-white/60 backdrop-blur-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-indigo-700 rounded-xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-200 mb-4">
             <LockKeyhole className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Set New Password</h2>
          <p className="text-sm text-slate-500 mt-1">Please enter your new password below</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">New Password</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200/60 bg-white/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all pr-10" required placeholder="Password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <motion.button 
              type="submit" 
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 p-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all mt-6 disabled:opacity-70">
              {loading ? "Saving..." : "Save Password"}
          </motion.button>
          <p className="mt-6 text-center text-xs font-medium text-slate-500">
            Need a new link? <Link to="/forgot-password" className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors">Request reset</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
