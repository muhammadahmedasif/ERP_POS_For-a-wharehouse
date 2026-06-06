import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Mail, ArrowLeft } from "lucide-react";
import Logo from "../components/Logo";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

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
      setSent(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to request password reset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center relative auth-bg overflow-hidden p-4">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-emerald-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
      <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-indigo-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md rounded-3xl glass-premium p-10 relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <Logo size="lg" showText={false} className="mb-6" />
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">Reset Password</h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">We'll send a recovery link to your email</p>
        </div>
        
        {sent ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100/80 mx-auto flex items-center justify-center">
              <Mail className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-sm text-slate-600 font-medium">Check your inbox! We've sent a password reset link to <span className="font-bold text-slate-800">{email}</span></p>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-indigo-600 font-bold hover:text-indigo-700 transition-colors mt-4">
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </Link>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full rounded-xl border border-slate-200/60 bg-white/50 pl-11 pr-4 py-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 focus:bg-white transition-all placeholder:text-slate-400" 
                  required 
                  placeholder="admin@aura.app" 
                />
              </div>
            </div>
            
            <motion.button 
                type="submit" 
                disabled={loading}
                whileHover={{ scale: 1.01, translateY: -1 }}
                whileTap={{ scale: 0.99 }}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 p-4 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all mt-8 disabled:opacity-70 relative overflow-hidden group">
                <span className="relative z-10">{loading ? "Sending..." : "Send Reset Link"}</span>
                <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            </motion.button>
            
            <p className="mt-8 text-center text-xs font-medium text-slate-500">
              Remember your password? <Link to="/login" className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors">Sign in</Link>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}
