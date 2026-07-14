import React, { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Toaster } from "sonner";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Bot,
  PlusCircle,
  Tag,
  Bookmark,
  RotateCcw,
} from "lucide-react";
import { useAppStore } from "./store";
import { AUTH_INVALID_EVENT } from "./lib/authStorage";
import { cn } from "./lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import ManageTaxonomies from "./pages/ManageTaxonomies";
import Sales from "./pages/Sales";
import AIAssistant from "./pages/AIAssistant";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import TopProducts from "./pages/TopProducts";
import Customers from "./pages/Customers";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import Help from "./pages/Help";
import Returns from "./pages/Returns";
import { FileText, Settings as SettingsIcon, Award, Menu, X, HelpCircle, Boxes } from "lucide-react";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAppStore((state) => state.user);

  useEffect(() => {
    const isPaid = user?.paid_status !== false && user?.user_metadata?.paid_status !== false;
    if (user && !isPaid) {
      import("sonner").then((mod) => {
        mod.toast.error("Payment delayed contact support", { duration: 5000 });
      });
    }
  }, [user]);

  // Periodic automatic profile refresh — checks DB for latest name, email, paid_status etc.
  useEffect(() => {
    if (!user) return;
    
    const checkProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            // Update live Zustand state
            useAppStore.setState({ user: data.user });
            // Update localStorage cache
            localStorage.setItem("user", JSON.stringify(data.user));
          }
        }
      } catch (err) {
        // Silently ignore network failures so it doesn't bother users when offline
      }
    };

    // Check immediately on app load
    checkProfile();

    // Re-check periodically every 24 hours (86400000 ms)
    const interval = setInterval(checkProfile, 1000 * 60 * 60 * 24);
    return () => clearInterval(interval);
  }, [user?.id]);

  if (!user) {
    return <Login />;
  }

  const isPaid = user.paid_status !== false && user.user_metadata?.paid_status !== false;
  if (!isPaid) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-900 text-white p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-rose-500">Access Restricted</h1>
          <p className="text-slate-400">Payment delayed contact support.</p>
          <button 
            onClick={() => useAppStore.getState().logout()} 
            className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const location = useLocation();

  const menuItems = [
    { name: "Home", icon: LayoutDashboard, path: "/" },
    { name: "Stock", icon: Package, path: "/inventory" },
    { name: "Categories & Brands", icon: Tag, path: "/categories" },
    { name: "Customers", icon: Users, path: "/customers" },
    { name: "Sales", icon: ShoppingCart, path: "/sales" },
    { name: "Returns", icon: RotateCcw, path: "/returns" },
    { name: "New Sale", icon: PlusCircle, path: "/sales/new" },
    { name: "Top Items", icon: Award, path: "/top-products" },
    { name: "Summary", icon: FileText, path: "/reports" },
    { name: "Settings", icon: SettingsIcon, path: "/settings" },
    { name: "Assistant", icon: Bot, path: "/ai" },
    { name: "Help", icon: HelpCircle, path: "/help" },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "glass-dark text-slate-300 flex flex-col shrink-0 h-screen lg:h-[calc(100vh-32px)] lg:m-4 lg:rounded-2xl border-r lg:border border-white/10 transition-transform duration-300 z-50 shadow-2xl shadow-indigo-500/10",
          "fixed inset-y-0 left-0 w-64 lg:static lg:flex lg:translate-x-0 overflow-hidden",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-6 flex items-center justify-between border-b border-white/5 relative overflow-hidden">
          {/* Subtle gradient glow */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            {/* Vector SVG Aura mark */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/20 shadow-lg shadow-indigo-500/10">
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                <path d="M30 40C30 34.4772 34.4772 30 40 30H70V50C70 61.0457 61.0457 70 50 70H30V40Z" fill="url(#sideGrad)" opacity="0.9" />
                <path d="M70 60C70 65.5228 65.5228 70 60 70H30V50C30 38.9543 38.9543 30 50 30H70V60Z" fill="white" opacity="0.3" />
                <circle cx="50" cy="50" r="10" fill="white" opacity="0.8" />
                <defs><linearGradient id="sideGrad" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#34d399" /></linearGradient></defs>
              </svg>
            </div>
            <div>
              <h1 className="text-white font-extrabold text-lg leading-none tracking-tight">
                Aura
              </h1>
              <p className="text-[9px] text-indigo-400/80 font-bold uppercase tracking-[0.2em] mt-1">
                Workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white transition-colors relative z-10 p-1.5 bg-white/5 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isNewSale = item.path === "/sales/new";
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "rounded-xl px-3 py-3 flex items-center gap-3 transition-all duration-300 text-[14px] font-medium group relative overflow-hidden",
                  isNewSale
                    ? "my-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 font-bold"
                    : isActive
                      ? "bg-white/10 text-white shadow-sm border border-white/10 font-semibold"
                      : "hover:bg-white/5 text-slate-400 hover:text-white",
                )}
              >
                {isActive && !isNewSale && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
                <Icon className={cn("w-5 h-5 shrink-0 transition-transform duration-300", isActive ? "scale-110 text-indigo-400" : "group-hover:scale-110", isNewSale && "text-white")} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

const Navbar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { settings, user } = useAppStore();
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/":
        return "Home";
      case "/inventory":
        return "Stock";
      case "/categories":
        return "Categories & Brands";
      case "/customers":
        return "Customers";
      case "/sales":
        return "Sales";
      case "/returns":
        return "Returns";
      case "/sales/new":
        return "New Sale";
      case "/top-products":
        return "Top Items";
      case "/reports":
        return "Summary";
      case "/settings":
        return "Settings";
      case "/ai":
        return "Assistant";
      case "/help":
        return "Help";
      default:
        return "Aura";
    }
  };

  return (
    <header className="sticky top-0 z-30 h-[72px] glass border-b border-white/40 flex items-center justify-between px-4 sm:px-8 shrink-0 shadow-sm shadow-slate-200/50 lg:mt-4 lg:mx-4 lg:rounded-2xl">
      <div className="flex items-center gap-4">
        {user && (
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 rounded-xl hover:bg-slate-100/80 text-slate-600 lg:hidden transition-colors"
            title="Toggle Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}
        {user && (
          <div className="hidden sm:flex flex-col select-none">
            <span className="text-[10px] uppercase tracking-widest text-indigo-600 font-bold">
              {settings.storeName || "Aura Workspace"}
            </span>
            <span className="text-xl font-bold text-slate-800 tracking-tight leading-none mt-1">
              {getPageTitle()}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-5">
        {user ? (
          <>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => useAppStore.getState().logout()} 
              className="text-sm font-semibold bg-white/60 backdrop-blur-sm text-slate-700 border border-slate-200/50 px-4 py-2 rounded-xl select-none cursor-pointer hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-all shadow-sm"
            >
              Logout
            </motion.button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold leading-none text-slate-800">
                {settings.sellerName || user?.name || "Admin"}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {settings.storeName}
              </p>
            </div>
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-100 overflow-hidden flex items-center justify-center text-sm font-bold text-indigo-700 shadow-sm"
            >
              {settings.profilePictureUrl ? (
                <img src={settings.profilePictureUrl} alt="Logo" className="w-full h-full object-cover"/>
              ) : (
                (settings.sellerName || user?.name || 'A').charAt(0).toUpperCase()
              )}
            </motion.div>
          </>
        ) : (
            <Link to="/login" className="text-sm font-semibold bg-slate-900 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-slate-900/20 hover:shadow-slate-900/40 transition-all">Login</Link>
        )}
      </div>
    </header>
  );
};

function AppContent() {
  const { fetchSettings, logout, user } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation(); // To track routes for animations

  useEffect(() => {
    window.addEventListener(AUTH_INVALID_EVENT, logout);
    return () => window.removeEventListener(AUTH_INVALID_EVENT, logout);
  }, [logout]);

  useEffect(() => {
    const handleAccessDenied = (e: Event) => {
      const msg = (e as CustomEvent).detail?.message || 'Access denied. You have been logged out.';
      import('sonner').then(({ toast }) => {
        toast.error(msg, { duration: 6000 });
      });
    };
    window.addEventListener('auth:access-denied', handleAccessDenied);
    return () => window.removeEventListener('auth:access-denied', handleAccessDenied);
  }, []);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [fetchSettings, user]);

  return (
    <div className="flex h-[100dvh] bg-[#fcfcfc] text-slate-800 overflow-hidden font-sans relative z-0 selection:bg-indigo-500/20">
      {/* Global Premium Ambient Background */}
      <div className="absolute inset-0 pointer-events-none z-[-1] overflow-hidden">
        {/* Animated glowing orbs for a dynamic premium feel */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      </div>

      <Toaster position="top-right" toastOptions={{ className: 'glass rounded-xl shadow-xl border-white/50 font-sans' }} />
      
      {user && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-transparent relative z-10">
        {user && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-8 pt-6 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="h-full"
            >
              <Routes location={location}>
                <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
                <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/" />} />
                <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/" />} />
                <Route path="/reset-password" element={!user ? <ResetPassword /> : <Navigate to="/" />} />
                <Route path="/verify-email" element={!user ? <VerifyEmail /> : <Navigate to="/" />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                <Route path="/categories" element={<ProtectedRoute><ManageTaxonomies /></ProtectedRoute>} />
                <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
                <Route path="/sales/new" element={<ProtectedRoute><Sales initialView="new" /></ProtectedRoute>} />
                <Route path="/returns" element={<ProtectedRoute><Returns /></ProtectedRoute>} />
                <Route path="/top-products" element={<ProtectedRoute><TopProducts /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/ai" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
                <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
