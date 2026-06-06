import React, { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle, XCircle, Loader2, RefreshCw, Mail, ArrowRight } from "lucide-react";
import Logo from "../components/Logo";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("Click the button below to verify your email address.");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);

  const verifyEmail = async () => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch(`/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setStatus("success");
        setMessage(data.message || "Your email has been verified!");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to verify email.");
      }
    } catch (err) {
      setStatus("error");
      setMessage("An error occurred during verification.");
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(data.message || "A new verification link has been sent.");
      } else {
        setMessage(data.error || "Could not resend verification link.");
      }
    } catch {
      setMessage("Could not resend verification link. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const statusIcon = {
    idle: <div className="w-20 h-20 rounded-full bg-indigo-100/60 flex items-center justify-center"><Mail className="w-10 h-10 text-indigo-500" /></div>,
    loading: <div className="w-20 h-20 rounded-full bg-indigo-100/60 flex items-center justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>,
    success: <div className="w-20 h-20 rounded-full bg-emerald-100/60 flex items-center justify-center"><CheckCircle className="w-10 h-10 text-emerald-500" /></div>,
    error: <div className="w-20 h-20 rounded-full bg-rose-100/60 flex items-center justify-center"><XCircle className="w-10 h-10 text-rose-500" /></div>,
  };

  const statusTitle = {
    idle: "Verify Email",
    loading: "Verifying...",
    success: "Verified!",
    error: "Verification Failed",
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
        className="w-full max-w-md rounded-3xl glass-premium p-10 relative z-10 text-center"
      >
        <div className="flex flex-col items-center mb-8">
          <Logo size="md" showText={false} className="mb-6" />
          
          <motion.div
            key={status}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="mb-4"
          >
            {statusIcon[status]}
          </motion.div>
          
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 mb-2">{statusTitle[status]}</h2>
          <p className="text-sm text-slate-500 font-medium max-w-xs">{message}</p>
        </div>

        {status === "idle" && (
          <motion.button 
            onClick={verifyEmail}
            whileHover={{ scale: 1.01, translateY: -1 }}
            whileTap={{ scale: 0.99 }}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 p-4 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all relative overflow-hidden group cursor-pointer"
          >
            <span className="relative z-10">Verify My Email</span>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          </motion.button>
        )}

        {status === "error" && (
          <div className="space-y-3">
            {token && (
              <motion.button 
                onClick={verifyEmail}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200/60 bg-white/50 p-3.5 text-sm font-bold text-indigo-600 hover:bg-indigo-50/50 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </motion.button>
            )}
            
            <div className="pt-4 border-t border-slate-100/50">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Resend Verification</p>
              <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/60 bg-white/50 pl-11 pr-4 py-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 focus:bg-white transition-all placeholder:text-slate-400"
                  placeholder="Enter your email"
                />
              </div>
              <motion.button 
                onClick={resendVerification}
                disabled={resending || !email}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 p-3.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all disabled:opacity-70 cursor-pointer"
              >
                {resending ? "Sending..." : "Resend Link"}
              </motion.button>
            </div>
          </div>
        )}

        {status === "success" && (
          <Link 
            to="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 p-4 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all"
          >
            Continue to Login <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </motion.div>
    </div>
  );
}
