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
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Bot,
  PlusCircle,
  Tag,
  Bookmark,
} from "lucide-react";
import { useAppStore } from "./store";
import { AUTH_INVALID_EVENT } from "./lib/authStorage";
import { cn } from "./lib/utils";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Categories from "./pages/Categories";
import Brands from "./pages/Brands";
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
import { FileText, Settings as SettingsIcon, Award, Menu, X, HelpCircle, Boxes } from "lucide-react";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAppStore((state) => state.user);
  return user ? <>{children}</> : <Login />;
};

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  const location = useLocation();

  const menuItems = [
    { name: "Home", icon: LayoutDashboard, path: "/" },
    { name: t("inventory"), icon: Package, path: "/inventory" },
    { name: "Categories", icon: Tag, path: "/categories" },
    { name: "Brands", icon: Bookmark, path: "/brands" },
    { name: "Customers", icon: Users, path: "/customers" },
    { name: t("sales"), icon: ShoppingCart, path: "/sales" },
    { name: "New Sale", icon: PlusCircle, path: "/sales/new" },
    { name: "Top Items", icon: Award, path: "/top-products" },
    { name: "Reports", icon: FileText, path: "/reports" },
    { name: "Settings", icon: SettingsIcon, path: "/settings" },
    { name: "Assistant", icon: Bot, path: "/ai" },
    { name: "Help", icon: HelpCircle, path: "/help" },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden font-sans"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "bg-slate-950 text-slate-300 flex flex-col shrink-0 h-screen font-sans border-r border-slate-800 transition-transform duration-250 z-50 shadow-2xl shadow-slate-950/20",
          "fixed inset-y-0 left-0 w-64 lg:static lg:flex lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-white text-md shadow-lg shadow-emerald-950/30">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-extrabold text-base leading-none tracking-tight">
                StockPilot
              </h1>
              <p className="text-[10px] text-emerald-300 uppercase tracking-wider font-extrabold mt-1">
                Sales & Inventory
              </p>
            </div>
          </div>
          {/* Close button for mobile sidebar */}
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3.5 space-y-0.5 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                  "rounded-lg px-3 py-2.5 flex items-center gap-2.5 transition-all text-[13px] font-semibold",
                  isNewSale
                    ? "my-2 bg-emerald-500 text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-400 font-extrabold text-sm"
                    : isActive
                      ? "bg-white text-slate-950 shadow-sm"
                      : "hover:bg-slate-800 text-slate-300 hover:text-white",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
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
        return "Inventory";
      case "/categories":
        return "Product Categories";
      case "/brands":
        return "Brand Management";
      case "/customers":
        return "Customers";
      case "/sales":
        return "Sales";
      case "/sales/new":
        return "New Sale";
      case "/top-products":
        return "Top Items";
      case "/reports":
        return "Reports";
      case "/settings":
        return "Settings";
      case "/ai":
        return "Assistant";
      case "/help":
        return "Help";
      default:
        return "StockPilot";
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/85 backdrop-blur-xl border-b border-slate-200/70 flex items-center justify-between px-4 sm:px-8 shrink-0 shadow-sm shadow-slate-200/50">
      <div className="flex items-center gap-4">
        {user && (
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 rounded-md hover:bg-slate-100 text-slate-600 lg:hidden transition-colors"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {user && (
          <div className="hidden sm:flex flex-col select-none">
            <span className="text-[9px] uppercase tracking-widest text-indigo-600 font-extrabold">
              {settings.storeName || "StockPilot"}
            </span>
            <span className="text-sm font-extrabold text-slate-800 tracking-tight leading-none mt-1">
              {getPageTitle()}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <button 
                onClick={() => useAppStore.getState().logout()} 
                className="text-xs bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded-md select-none cursor-pointer hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-all active:scale-[0.98]"
              >
                Logout
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold leading-none text-slate-800">
                  {user?.name || settings.sellerName || "Admin"}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {settings.storeName}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-500">
                {settings.profilePictureUrl ? (
                  <img src={settings.profilePictureUrl} alt="Logo" className="w-full h-full rounded-full object-cover"/>
                ) : (
                  (user?.name || settings.sellerName || 'A').charAt(0)
                )}
              </div>
            </>
          ) : (
              <Link to="/login" className="text-xs bg-slate-950 text-white px-3 py-1.5 rounded-md">Login</Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default function App() {
  const { fetchSettings, logout, user } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  useEffect(() => {
    window.addEventListener(AUTH_INVALID_EVENT, logout);
    return () => window.removeEventListener(AUTH_INVALID_EVENT, logout);
  }, [logout]);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [fetchSettings, user]);

  return (
    <BrowserRouter>
      <div className="flex h-[100dvh] bg-slate-50 text-slate-900 overflow-hidden font-sans relative z-0">
        {/* Global Premium Ambient Background */}
        <div className="absolute inset-0 pointer-events-none z-[-1] overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]"></div>
        </div>

        <Toaster position="top-right" />
        {user && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-transparent">
          {user && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-8">
            <Routes>
              <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
              <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/" />} />
              <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/" />} />
              <Route path="/reset-password" element={!user ? <ResetPassword /> : <Navigate to="/" />} />
              <Route path="/verify-email" element={!user ? <VerifyEmail /> : <Navigate to="/" />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
              <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
              <Route path="/brands" element={<ProtectedRoute><Brands /></ProtectedRoute>} />
              <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
              <Route path="/sales/new" element={<ProtectedRoute><Sales initialView="new" /></ProtectedRoute>} />
              <Route path="/top-products" element={<ProtectedRoute><TopProducts /></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/ai" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
              <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
