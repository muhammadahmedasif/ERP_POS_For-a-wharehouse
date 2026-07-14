import React, { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle, XCircle, Loader2, RefreshCw, Mail, ArrowRight } from "lucide-react";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

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
    idle: <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center"><Mail className="w-10 h-10 text-primary-600" /></div>,
    loading: <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center"><Loader2 className="w-10 h-10 text-primary-600 animate-spin" /></div>,
    success: <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle className="w-10 h-10 text-emerald-500" /></div>,
    error: <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="w-10 h-10 text-red-500" /></div>,
  };

  const statusTitle = {
    idle: "Verify Email",
    loading: "Verifying...",
    success: "Verified!",
    error: "Verification Failed",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md rounded-xl bg-white border border-border shadow-sm p-10 text-center"
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

          <h2 className="text-3xl font-medium tracking-tight text-neutral-900 mb-2">{statusTitle[status]}</h2>
          <p className="text-sm text-neutral-500 font-medium max-w-xs">{message}</p>
        </div>

        {status === "idle" && (
          <Button onClick={verifyEmail} className="w-full rounded-xl cursor-pointer">
            Verify My Email
          </Button>
        )}

        {status === "error" && (
          <div className="space-y-3">
            {token && (
              <Button onClick={verifyEmail} variant="outline" className="w-full rounded-xl cursor-pointer">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            )}

            <div className="pt-4 border-t border-border">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-2">Resend Verification</p>
              <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-neutral-400" />
                </div>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11"
                  placeholder="Enter your email"
                />
              </div>
              <Button onClick={resendVerification} disabled={resending || !email} className="w-full rounded-xl cursor-pointer">
                {resending ? "Sending..." : "Resend Link"}
              </Button>
            </div>
          </div>
        )}

        {status === "success" && (
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 text-white px-4 py-3 text-sm font-medium shadow-sm hover:bg-primary-700 active:bg-primary-800 transition-colors"
          >
            Continue to Login <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </motion.div>
    </div>
  );
}
