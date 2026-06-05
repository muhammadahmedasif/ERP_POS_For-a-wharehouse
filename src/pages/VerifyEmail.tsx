import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("Click the button below to verify your email address.");

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

        {status !== "loading" && status !== "idle" && (
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
