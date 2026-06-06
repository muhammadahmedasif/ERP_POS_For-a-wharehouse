import React, { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

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

  return (
    <div className="flex min-h-[80vh] items-center justify-center relative">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl bg-white/60 backdrop-blur-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 text-center"
      >
        <div className="mb-6 flex justify-center">
          {status === "idle" && <CheckCircle className="w-16 h-16 text-indigo-500 opacity-80" />}
          {status === "loading" && <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />}
          {status === "success" && <CheckCircle className="w-16 h-16 text-emerald-500" />}
          {status === "error" && <XCircle className="w-16 h-16 text-rose-500" />}
        </div>
        
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2">
          {status === "idle" ? "Verify Email" : status === "loading" ? "Verifying..." : status === "success" ? "Verified!" : "Verification Failed"}
        </h2>
        
        <p className="text-sm text-slate-500 mb-8">
          {message}
        </p>

        {status === "idle" && (
          <motion.button 
            onClick={verifyEmail}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-block w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 p-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all cursor-pointer"
          >
            Verify My Email
          </motion.button>
        )}

        {status === "error" && (
          <div className="space-y-3">
            {token && (
              <motion.button 
                onClick={verifyEmail}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white/70 p-3 text-sm font-bold text-indigo-700 shadow-sm hover:bg-indigo-50 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Try Verification Again
              </motion.button>
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200/60 bg-white/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              placeholder="Enter your email"
            />
            <motion.button 
              onClick={resendVerification}
              disabled={resending || !email}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-block w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 p-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all cursor-pointer disabled:opacity-70"
            >
              {resending ? "Sending..." : "Resend Verification Link"}
            </motion.button>
          </div>
        )}

        {status !== "loading" && status !== "idle" && status !== "error" && (
          <Link 
            to="/login"
            className="inline-block w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 p-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all"
          >
            Go to Login
          </Link>
        )}
      </motion.div>
    </div>
  );
}
