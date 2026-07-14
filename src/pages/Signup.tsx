import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAppStore } from "../store";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const signup = useAppStore((state) => state.signup);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signup(email, password, name);
      toast.success("Signup successful! Please check your email to verify your account.");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "Signup failed");
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
          <h2 className="text-3xl font-medium tracking-tight text-neutral-900">Create Account</h2>
          <p className="text-sm text-neutral-500 mt-2 font-medium">Join Aura to start managing your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500 mb-1.5 ml-1">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-neutral-400" />
              </div>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-11"
                required
                placeholder="John Doe"
              />
            </div>
          </div>
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
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500 mb-1.5 ml-1">Password</label>
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

          <Button type="submit" className="w-full rounded-xl mt-8">
            Sign Up
          </Button>

          <p className="mt-8 text-center text-xs font-medium text-neutral-500">
            Already have an account? <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700 transition-colors">Sign in</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
