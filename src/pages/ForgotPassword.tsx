import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "motion/react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      toast.success(data.message);
    } catch (error: any) {
      toast.error(error.message || "Failed to request password reset");
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
          <div className="w-12 h-12 bg-gradient-to-tr from-amber-500 to-amber-700 rounded-xl mx-auto flex items-center justify-center shadow-lg shadow-amber-200 mb-4">
             <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Reset Password</h2>
          <p className="text-sm text-slate-500 mt-1">Enter your email to receive a reset link</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200/60 bg-white/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" required placeholder="admin@example.com" />
          </div>
          <motion.button 
              type="submit" 
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 p-3 text-sm font-bold text-white shadow-lg shadow-amber-200 hover:shadow-amber-300 transition-all mt-6 disabled:opacity-70">
              {loading ? "Sending..." : "Send Reset Link"}
          </motion.button>
          <p className="mt-6 text-center text-xs font-medium text-slate-500">
            Remember your password? <Link to="/login" className="text-amber-600 font-bold hover:text-amber-700 transition-colors">Sign in</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
