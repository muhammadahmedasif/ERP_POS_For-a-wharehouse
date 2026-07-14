import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Package, DollarSign, AlertCircle, ArrowRight, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Product } from "../types";
import { useAppStore } from "../store";
import { motion } from "framer-motion";

const Dashboard = () => {
  const settings = useAppStore(state => state.settings);
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data: Product[]) => {
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error(err));

    fetch("/api/sales")
      .then((res) => res.json())
      .then((data) => {
        setSales(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error(err));

    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        setCustomers(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error(err));
  }, []);

  const today = new Date().toDateString();
  const salesToday = sales.filter(s => new Date(s.date).toDateString() === today);
  const cashToday = salesToday.reduce((sum, sale) => sum + (Number(sale.amountPaid || sale.amount_paid || sale.total) || 0), 0);

  const totalItemsInStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);

  const totalDues = customers.reduce((sum, c) => {
    const due = (c.totalAmount || c.total_amount || 0) - (c.paidAmount || c.paid_amount || 0);
    return sum + (due > 0 ? due : 0);
  }, 0);

  const lowStockThreshold = settings.defaultLowInventoryThreshold || 10;
  const lowStockItems = products.filter(p => (p.stock || 0) <= lowStockThreshold);

  const pendingCustomers = customers.filter(c => ((c.totalAmount || c.total_amount || 0) - (c.paidAmount || c.paid_amount || 0)) > 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
      </div>

      {/* Main minimal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div whileTap={{ scale: 0.98 }} onClick={() => navigate('/sales')} className="cursor-pointer">
          <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white overflow-hidden relative">
            <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
              <DollarSign className="w-24 h-24" />
            </div>
            <CardContent className="p-6 relative z-10">
              <div className="flex justify-between items-start">
                <p className="text-indigo-100 font-semibold mb-1 text-sm">Cash In Today</p>
                <div className="p-2 bg-white/10 text-white rounded-full">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-3xl font-black mt-2">Rs. {cashToday.toLocaleString()}</h3>
              <p className="text-indigo-200 text-xs mt-2">{salesToday.length} sales today</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileTap={{ scale: 0.98 }} onClick={() => navigate('/inventory')} className="cursor-pointer">
          <Card className="border-0 shadow-sm bg-white overflow-hidden relative group hover:shadow-md transition-shadow">
            <div className="absolute right-0 bottom-0 opacity-5 translate-x-4 translate-y-4 text-emerald-500">
              <Package className="w-24 h-24" />
            </div>
            <CardContent className="p-6 relative z-10">
              <div className="flex justify-between items-start">
                <p className="text-slate-500 font-semibold mb-1 text-sm">Total Stock Items</p>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-full group-hover:bg-emerald-100 transition-colors">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-3xl font-black text-slate-800 mt-2">{totalItemsInStock.toLocaleString()}</h3>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileTap={{ scale: 0.98 }} onClick={() => navigate('/customers')} className="cursor-pointer">
          <Card className="border-0 shadow-sm bg-white overflow-hidden relative group hover:shadow-md transition-shadow">
            <div className="absolute right-0 bottom-0 opacity-5 translate-x-4 translate-y-4 text-amber-500">
              <Users className="w-24 h-24" />
            </div>
            <CardContent className="p-6 relative z-10">
              <div className="flex justify-between items-start">
                <p className="text-slate-500 font-semibold mb-1 text-sm">Pending Dues</p>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-full group-hover:bg-amber-100 transition-colors">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-3xl font-black text-slate-800 mt-2">Rs. {totalDues.toLocaleString()}</h3>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* Recent Activity List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-indigo-500" />
              Recent Sales
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/sales')} className="text-indigo-600 text-xs font-semibold hover:bg-indigo-50">
              View All
            </Button>
          </div>
          <div className="divide-y divide-slate-100">
            {sales.slice(0, 5).map((sale, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {sale.items?.length === 1 ? sale.items[0].name : `${sale.items?.length || 0} items`}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600 text-sm">Rs. {sale.total?.toLocaleString()}</p>
                </div>
              </div>
            ))}
            {sales.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">No sales yet.</div>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-6">
          {lowStockItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-rose-100 overflow-hidden">
              <div className="p-5 border-b border-rose-50 flex justify-between items-center bg-rose-50/30">
                <h3 className="font-bold text-rose-700 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Low Stock Items
                </h3>
              </div>
              <div className="divide-y divide-rose-50 max-h-[250px] overflow-y-auto">
                {lowStockItems.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="p-4 hover:bg-rose-50/50 transition-colors flex items-center justify-between">
                    <p className="font-semibold text-slate-700 text-sm">{item.name}</p>
                    <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-md">
                      Only {item.stock} left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingCustomers.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
              <div className="p-5 border-b border-amber-50 flex justify-between items-center bg-amber-50/30">
                <h3 className="font-bold text-amber-700 flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  People owe you money
                </h3>
              </div>
              <div className="divide-y divide-amber-50 max-h-[250px] overflow-y-auto">
                {pendingCustomers.slice(0, 5).map((c, idx) => {
                  const due = (c.totalAmount || c.total_amount || 0) - (c.paidAmount || c.paid_amount || 0);
                  return (
                    <div key={idx} className="p-4 hover:bg-amber-50/50 transition-colors flex items-center justify-between">
                      <p className="font-semibold text-slate-700 text-sm">{c.name}</p>
                      <span className="text-amber-700 font-bold text-sm">
                        Rs. {due.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
