import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAppStore } from "../store";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import Logo from "../components/Logo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useAppStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-neutral-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <Logo size="lg" showText={false} className="mb-5" />
            <h2 className="text-xl font-semibold text-neutral-900">Welcome back</h2>
            <p className="text-sm text-neutral-400 mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-500">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white pl-10 pr-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-neutral-400"
                  required placeholder="admin@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-500">Password</label>
                <Link to="/forgot-password" className="text-[11px] font-medium text-primary-600 hover:text-primary-700">Forgot?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white pl-10 pr-10 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-neutral-400"
                  required placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit"
              className="w-full rounded-lg bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 transition-colors mt-2">
              Sign In
            </button>

            <p className="text-center text-xs text-neutral-400">
              Don't have an account? <Link to="/signup" className="font-medium text-primary-600 hover:text-primary-700">Sign up</Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
