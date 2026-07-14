import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Package, DollarSign, AlertCircle, ArrowRight, Clock, Users,
  ShoppingCart, UserPlus, PlusCircle, CreditCard,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Product } from "../types";
import { useAppStore } from "../store";

const Dashboard = () => {
  const settings = useAppStore(state => state.settings);
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then((data: Product[]) => setProducts(Array.isArray(data) ? data : [])).catch(() => {});
    fetch("/api/sales").then(r => r.json()).then(data => setSales(Array.isArray(data) ? data : [])).catch(() => {});
    fetch("/api/customers").then(r => r.json()).then(data => setCustomers(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const today = new Date().toDateString();
  const salesToday = sales.filter(s => new Date(s.date).toDateString() === today);
  const cashToday = salesToday.reduce((sum, s) => sum + (Number(s.amountPaid || s.total) || 0), 0);
  const totalDues = customers.reduce((sum, c) => {
    const due = (c.totalAmount || 0) - (c.paidAmount || 0);
    return sum + (due > 0 ? due : 0);
  }, 0);
  const lowStockThreshold = settings.defaultLowInventoryThreshold || 10;
  const lowStockItems = products.filter(p => (p.stock || 0) <= lowStockThreshold);
  const pendingCustomers = customers.filter(c => ((c.totalAmount || 0) - (c.paidAmount || 0)) > 0);

  const stats = [
    { label: "Today's Sales", value: `Rs. ${cashToday.toLocaleString()}`, sub: `${salesToday.length} transactions`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50", onClick: () => navigate('/sales') },
    { label: "Products in Stock", value: products.length.toLocaleString(), sub: `${products.reduce((s, p) => s + (p.stock || 0), 0).toLocaleString()} units`, icon: Package, color: "text-primary-600", bg: "bg-primary-50", onClick: () => navigate('/inventory') },
    { label: "Pending Dues", value: `Rs. ${totalDues.toLocaleString()}`, sub: `${pendingCustomers.length} customers`, icon: Users, color: "text-amber-600", bg: "bg-amber-50", onClick: () => navigate('/customers') },
    { label: "Low Stock Items", value: lowStockItems.length.toString(), sub: `${lowStockItems.length > 0 ? 'Needs attention' : 'All good'}`, icon: AlertCircle, color: lowStockItems.length > 0 ? "text-rose-600" : "text-neutral-400", bg: lowStockItems.length > 0 ? "bg-rose-50" : "bg-neutral-50", onClick: () => navigate('/inventory') },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}.</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <button key={stat.label} onClick={stat.onClick} className="text-left group">
            <div className="bg-white rounded-xl border border-neutral-200/70 p-4 hover:shadow-md hover:border-neutral-300/70 transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{stat.label}</span>
                <div className={`w-9 h-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform`}>
                  <stat.icon className="w-[18px] h-[18px]" />
                </div>
              </div>
              <p className="text-2xl font-bold text-neutral-900 tracking-tight">{stat.value}</p>
              <p className="text-xs text-neutral-400 mt-1">{stat.sub}</p>
            </div>
          </button>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => navigate('/sales/new')} className="flex items-center gap-2.5 px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors text-sm font-medium">
            <PlusCircle className="w-4 h-4" /> New Sale
          </button>
          <button onClick={() => navigate('/inventory', { state: { openScan: true } })} className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors text-sm font-medium">
            <Package className="w-4 h-4" /> Add Product
          </button>
          <button onClick={() => navigate('/customers')} className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors text-sm font-medium">
            <UserPlus className="w-4 h-4" /> Add Customer
          </button>
          <button onClick={() => navigate('/sales')} className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium">
            <CreditCard className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-400" /> Recent Sales
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/sales')} className="text-xs">View All</Button>
          </div>
          <div className="divide-y divide-border">
            {sales.slice(0, 6).map((sale, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-4 h-4 text-neutral-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{sale.id}</p>
                    <p className="text-xs text-neutral-400">{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-emerald-600 shrink-0">Rs. {sale.total?.toLocaleString()}</p>
              </div>
            ))}
            {sales.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-neutral-400">No sales yet.</div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {lowStockItems.length > 0 && (
            <Card>
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-rose-600">Low Stock Items</h3>
              </div>
              <div className="divide-y divide-border max-h-52 overflow-y-auto">
                {lowStockItems.slice(0, 5).map((item, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                    <p className="text-sm font-medium text-neutral-700">{item.name}</p>
                    <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">{item.stock} left</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {pendingCustomers.length > 0 && (
            <Card>
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-amber-600">Outstanding Balances</h3>
              </div>
              <div className="divide-y divide-border max-h-52 overflow-y-auto">
                {pendingCustomers.slice(0, 5).map((c, i) => {
                  const due = (c.totalAmount || 0) - (c.paidAmount || 0);
                  return (
                    <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-neutral-50">
                      <p className="text-sm font-medium text-neutral-700">{c.name}</p>
                      <span className="text-sm font-semibold text-amber-600">Rs. {due.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
