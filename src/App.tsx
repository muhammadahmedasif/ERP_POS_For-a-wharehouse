import React, { useEffect } from "react";
import {
  BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate,
} from "react-router-dom";
import { Toaster } from "sonner";
import {
  LayoutDashboard, ShoppingCart, Users, Bot, Package, Tag,
  RotateCcw, FileText, Award, Settings as SettingsIcon,
  HelpCircle, PlusCircle, Menu, X, Search, ChevronDown, QrCode,
} from "lucide-react";
import { useAppStore } from "./store";
import { AUTH_INVALID_EVENT } from "./lib/authStorage";
import { cn } from "./lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import SearchCommand from "./components/SearchCommand";
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

interface NavSection {
  name: string;
  items: { name: string; icon: React.ElementType; path: string; accent?: string }[];
}

const sectionAccents: Record<string, string> = {
  "Quick Access": "bg-primary-500",
  "Sales": "bg-emerald-500",
  "Inventory": "bg-amber-500",
  "Customers": "bg-violet-500",
  "Reports": "bg-blue-500",
};

const navSections: NavSection[] = [
  {
    name: "Quick Access",
    items: [
      { name: "New Sale", icon: PlusCircle, path: "/sales/new", accent: "emerald" },
      { name: "Sales", icon: ShoppingCart, path: "/sales", accent: "emerald" },
      { name: "Products", icon: Package, path: "/inventory", accent: "amber" },
      { name: "Dashboard", icon: LayoutDashboard, path: "/", accent: "primary" },
    ],
  },
  {
    name: "Customers",
    items: [{ name: "Customers", icon: Users, path: "/customers", accent: "violet" }],
  },
  {
    name: "Sales",
    items: [
      { name: "Returns", icon: RotateCcw, path: "/returns" },
    ],
  },
  {
    name: "Inventory",
    items: [
      { name: "Categories & Brands", icon: Tag, path: "/categories" },
    ],
  },
  {
    name: "Reports",
    items: [
      { name: "Summary", icon: FileText, path: "/reports" },
      { name: "Top Items", icon: Award, path: "/top-products" },
    ],
  },
];

const accentColors: Record<string, { activeBg: string; activeText: string; activeIcon: string; hoverText: string; iconColor: string }> = {
  primary: { activeBg: "bg-primary-600/20", activeText: "text-primary-300", activeIcon: "text-primary-400", hoverText: "hover:text-white", iconColor: "text-primary-500" },
  emerald: { activeBg: "bg-emerald-600/20", activeText: "text-emerald-300", activeIcon: "text-emerald-400", hoverText: "hover:text-white", iconColor: "text-emerald-500" },
  amber: { activeBg: "bg-amber-600/20", activeText: "text-amber-300", activeIcon: "text-amber-400", hoverText: "hover:text-white", iconColor: "text-amber-500" },
  violet: { activeBg: "bg-violet-600/20", activeText: "text-violet-300", activeIcon: "text-violet-400", hoverText: "hover:text-white", iconColor: "text-violet-500" },
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAppStore((state) => state.user);

  useEffect(() => {
    const isPaid = user?.paid_status !== false && user?.user_metadata?.paid_status !== false;
    if (user && !isPaid) {
      import("sonner").then((mod) => {
        mod.toast.error("Payment delayed. Contact support.", { duration: 5000 });
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const checkProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            useAppStore.setState({ user: data.user });
            localStorage.setItem("user", JSON.stringify(data.user));
          }
        }
      } catch {}
    };
    checkProfile();
    const interval = setInterval(checkProfile, 1000 * 60 * 60 * 24);
    return () => clearInterval(interval);
  }, [user?.id]);

  if (!user) return <Login />;

  const isPaid = user.paid_status !== false && user.user_metadata?.paid_status !== false;
  if (!isPaid) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-neutral-50 p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 bg-danger-50 text-danger-500 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl font-bold">!</span>
          </div>
          <h1 className="text-xl font-semibold text-danger-600">Access Restricted</h1>
          <p className="text-sm text-neutral-500">Your account requires payment verification. Contact support.</p>
          <button onClick={() => useAppStore.getState().logout()} className="mt-4 px-5 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors">
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
  const { settings } = useAppStore();

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "flex flex-col shrink-0 h-screen bg-neutral-900 border-r border-neutral-800 transition-transform duration-200 z-50",
        "fixed inset-y-0 left-0 w-60 lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center">
              <svg viewBox="0 0 100 100" fill="none" className="w-4 h-4">
                <path d="M32 42C32 36.4772 36.4772 32 42 32H68V50C68 59.9411 59.9411 68 50 68H32V42Z" fill="white" opacity="0.95" />
                <circle cx="50" cy="50" r="10" fill="#171717" />
              </svg>
            </div>
            <div>
              <span className="font-heading font-bold text-sm text-white leading-none">Aura</span>
              <p className="text-[9px] font-medium text-neutral-500 uppercase tracking-wider mt-0.5">{settings.storeName || "Workspace"}</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-neutral-500 hover:text-neutral-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-none px-3 py-3 space-y-4">
          {navSections.map((section) => {
            const sectionDot = sectionAccents[section.name];
            return (
            <div key={section.name}>
              <div className="flex items-center gap-2 px-2 mb-2">
                <span className={`w-1.5 h-1.5 rounded-full ${sectionDot}`} />
                <p className="text-[9px] font-semibold text-neutral-600 uppercase tracking-widest">{section.name}</p>
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const colors = item.accent ? accentColors[item.accent] : null;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-150 relative",
                        isActive && colors
                          ? `${colors.activeBg} ${colors.activeText} font-medium`
                          : isActive
                          ? "bg-neutral-800 text-neutral-300 font-medium"
                          : colors
                          ? "text-neutral-400 hover:text-white hover:bg-neutral-800"
                          : "text-neutral-600 hover:text-neutral-400 hover:bg-neutral-800"
                      )}
                    >
                      {isActive && (
                        <span className={cn(
                          "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full",
                          colors ? `${colors.activeIcon.replace('text-', 'bg-')}` : "bg-neutral-400"
                        )} />
                      )}
                      <Icon className={cn("w-4 h-4 shrink-0 transition-colors",
                        isActive && colors ? colors.activeIcon
                        : isActive ? "text-neutral-400"
                        : colors ? `${colors.iconColor} opacity-80`
                        : "text-neutral-600"
                      )} />
                      <span className={cn(
                        isActive && colors ? "text-[13px]" : "",
                        !isActive && colors ? "font-medium" : ""
                      )}>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>

        <div className="border-t border-neutral-800 px-3 py-2 space-y-0.5 shrink-0">
          <Link
            to="/settings"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-150",
              location.pathname === "/settings" ? "bg-neutral-800 text-neutral-300" : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
            )}
          >
            <SettingsIcon className="w-4 h-4 shrink-0 opacity-70" />
            <span>Settings</span>
          </Link>
          <Link
            to="/help"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-150",
              location.pathname === "/help" ? "bg-neutral-800 text-neutral-300" : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
            )}
          >
            <HelpCircle className="w-4 h-4 shrink-0 opacity-70" />
            <span>Help</span>
          </Link>
        </div>
      </aside>
    </>
  );
};

const Navbar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { settings, user } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/": return "Dashboard";
      case "/inventory": return "Products";
      case "/categories": return "Categories & Brands";
      case "/customers": return "Customers";
      case "/sales": return "Sales";
      case "/returns": return "Returns";
      case "/sales/new": return "New Sale";
      case "/top-products": return "Top Items";
      case "/reports": return "Summary";
      case "/settings": return "Settings";
      case "/ai": return "Assistant";
      case "/help": return "Help";
      default: return "";
    }
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-white/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="p-1.5 -ml-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 lg:hidden transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-neutral-900">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
            document.dispatchEvent(event);
          }}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-400 bg-neutral-50 border border-border rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="text-[10px] font-medium text-neutral-400 bg-white border border-border px-1 py-0.5 rounded ml-4">⌘K</kbd>
        </button>

        {user ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => useAppStore.getState().logout()}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700 px-2 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              Logout
            </button>
            <div className="w-7 h-7 rounded-lg bg-primary-100 border border-primary-200 flex items-center justify-center text-xs font-semibold text-primary-600">
              {settings.profilePictureUrl ? (
                <img src={settings.profilePictureUrl} alt="" className="w-full h-full object-cover rounded-lg" />
              ) : (
                (settings.sellerName || user?.name || 'A').charAt(0).toUpperCase()
              )}
            </div>
          </div>
        ) : (
          <Link to="/login" className="text-sm font-medium text-white bg-primary-600 px-4 py-1.5 rounded-lg hover:bg-primary-700 transition-colors">Login</Link>
        )}
      </div>
    </header>
  );
};

function AppContent() {
  const { fetchSettings, logout, user } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const location = useLocation();

  useEffect(() => {
    window.addEventListener(AUTH_INVALID_EVENT, logout);
    return () => window.removeEventListener(AUTH_INVALID_EVENT, logout);
  }, [logout]);

  useEffect(() => {
    const handleAccessDenied = (e: Event) => {
      const msg = (e as CustomEvent).detail?.message || 'Access denied. You have been logged out.';
      import('sonner').then(({ toast }) => { toast.error(msg, { duration: 6000 }); });
    };
    window.addEventListener('auth:access-denied', handleAccessDenied);
    return () => window.removeEventListener('auth:access-denied', handleAccessDenied);
  }, []);

  useEffect(() => {
    if (user) fetchSettings();
  }, [fetchSettings, user]);

  const isAuthPage = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"].includes(location.pathname);

  if (isAuthPage && !user) {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ className: 'font-sans text-sm' }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-[#f0f2f5] text-neutral-800 overflow-hidden">
      <Toaster position="top-right" toastOptions={{ className: 'font-sans text-sm' }} />
      <SearchCommand />
      {user && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {user && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
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
          </div>
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
