import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md rounded-xl bg-white border border-border shadow-sm p-10"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <Logo size="lg" showText={false} className="mb-6" />
          <h2 className="text-3xl font-medium tracking-tight text-neutral-900">New Password</h2>
          <p className="text-sm text-neutral-500 mt-2 font-medium">Choose a strong password for your Aura account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500 mb-1.5 ml-1">New Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-neutral-400" />
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-11 pr-12"
                required
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] text-neutral-400 font-medium">Use 8+ characters with a mix of letters, numbers & symbols</span>
          </div>

          <Button type="submit" disabled={loading} className="w-full rounded-xl mt-8">
            {loading ? "Saving..." : "Save Password"}
          </Button>

          <p className="mt-8 text-center text-xs font-medium text-neutral-500">
            Need a new link? <Link to="/forgot-password" className="text-primary-600 font-medium hover:text-primary-700 transition-colors">Request reset</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
