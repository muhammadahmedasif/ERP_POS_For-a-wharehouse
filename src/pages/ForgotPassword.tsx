import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Mail, ArrowLeft } from "lucide-react";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md rounded-xl bg-white border border-border shadow-sm p-10"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <Logo size="lg" showText={false} className="mb-6" />
          <h2 className="text-3xl font-medium tracking-tight text-neutral-900">Reset Password</h2>
          <p className="text-sm text-neutral-500 mt-2 font-medium">We'll send a recovery link to your email</p>
        </div>

        {sent ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 mx-auto flex items-center justify-center">
              <Mail className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-sm text-neutral-600 font-medium">Check your inbox! We've sent a password reset link to <span className="font-medium text-neutral-900">{email}</span></p>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-primary-600 font-medium hover:text-primary-700 transition-colors mt-4">
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </Link>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500 mb-1.5 ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-neutral-400" />
                </div>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11"
                  required
                  placeholder="admin@aura.app"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full rounded-xl mt-8">
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>

            <p className="mt-8 text-center text-xs font-medium text-neutral-500">
              Remember your password? <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700 transition-colors">Sign in</Link>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}
