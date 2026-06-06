import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Package,
  DollarSign,
  ShoppingCart,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { useNavigate } from "react-router-dom";
import { Product } from "../types";
import { useAppStore } from "../store";

const Dashboard = () => {
  const settings = useAppStore(state => state.settings);
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [selectedMonth, setSelectedMonth] = useState("");
  const [stats, setStats] = useState({
    productsTotal: 0,
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data: Product[]) => {
        const productsData = Array.isArray(data) ? data : [];
        setProducts(productsData);
        setStats({ productsTotal: productsData.length });
        setLowStockProducts(productsData.filter(p => p.stock <= (p.lowInventoryThreshold || settings.defaultLowInventoryThreshold || 10)));
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

  const monthlyData: Record<string, any> = {};
  
  sales.forEach(sale => {
    const d = new Date(sale.date);
    const month = d.toLocaleString("default", { month: "short" });
    if (!monthlyData[month]) {
      monthlyData[month] = { revenue: 0, productMap: {} };
    }
    monthlyData[month].revenue += sale.total;

    sale.items?.forEach((item: any) => {
       const productName = products.find(p => p.id === item.productId)?.name || `Prod-${item.productId}`;
       if (!monthlyData[month].productMap[productName]) {
         monthlyData[month].productMap[productName] = 0;
       }
       monthlyData[month].productMap[productName] += (item.price * item.quantity);
    });
  });

  Object.keys(monthlyData).forEach(m => {
    monthlyData[m].topProducts = Object.keys(monthlyData[m].productMap).map(k => ({
      name: k,
      revenue: monthlyData[m].productMap[k]
    })).sort((a,b) => b.revenue - a.revenue);
  });

  const availableMonths = Object.keys(monthlyData).sort((a,b) => {
    const d1 = new Date(`1 ${a} 2026`);
    const d2 = new Date(`1 ${b} 2026`);
    return d1.getTime() - d2.getTime();
  });

  useEffect(() => {
     if (availableMonths.length > 0 && !selectedMonth) {
       setSelectedMonth(availableMonths[availableMonths.length - 1]);
     }
  }, [availableMonths, selectedMonth]);

  const currentData = monthlyData[selectedMonth] || { revenue: 0, orders: 0, topProducts: [], completed: 0, processing: 0 };

  const monthlySalesData = availableMonths.map(m => ({
    name: m,
    sales: monthlyData[m].revenue
  }));

  const categoryMap: Record<string, number> = {};
  sales.forEach(sale => {
    sale.items?.forEach((item: any) => {
      const p = products.find(prod => prod.id === item.productId);
      const cat = p?.category || 'Other';
      categoryMap[cat] = (categoryMap[cat] || 0) + (item.price * item.quantity);
    });
  });
  const pieData = Object.keys(categoryMap).map(k => ({ name: k, value: categoryMap[k] }));

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800">{t("dashboard")}</h2>
        
        <div className="flex items-center space-x-2 bg-white rounded-md p-1 shadow-sm border border-slate-200">
          {Object.keys(monthlyData).map(m => (
             <button 
               key={m} 
               onClick={() => setSelectedMonth(m)}
               className={`px-4 py-1.5 text-sm font-bold rounded-sm transition-colors ${selectedMonth === m ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
             >
               {m}
             </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Sales ({selectedMonth})
            </CardTitle>
            <DollarSign className="w-4 h-4 text-slate-300" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="text-2xl font-bold text-slate-900 mt-2">
              Rs. {currentData.revenue.toLocaleString()}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Top Selling Products</span>
              <ul className="space-y-2">
                {currentData.topProducts.slice(0, 3).map((p: any, i: number) => (
                  <li key={i} className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">
                      {i + 1}. {p.name}
                    </span>
                    <span className="text-emerald-600 font-bold">Rs. {p.revenue}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-3 text-xs text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100" onClick={() => navigate('/top-products')}>
              View All Revenue Details <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Products
            </CardTitle>
            <Package className="w-4 h-4 text-slate-300" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            <div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                {stats.productsTotal}
              </div>
              <p className="mt-2 text-red-500 flex items-center text-xs font-bold">
                {lowStockProducts.length} low stock items
              </p>
            </div>
            <Button variant="outline" className="w-full mt-4 text-xs font-bold" onClick={() => navigate('/inventory')}>
              Manage Inventory <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-800">{t("sales_trend")}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySalesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                <RechartsTooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                <Bar dataKey="sales" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-800">Sales by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {pieData.length > 0 && pieData.reduce((acc, x) => acc + (x.value || 0), 0) > 0 ? (
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({name, percent}) => {
                      const valPercent = percent && !isNaN(percent) ? (percent * 100).toFixed(0) : "0";
                      return `${name} ${valPercent}%`;
                    }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-xs py-10 text-center">No sales registered yet to display category breakdown.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-sm font-bold uppercase tracking-wider text-red-605 text-red-650 text-red-600">
              <AlertCircle className="w-4 h-4 mr-2" /> Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[350px] overflow-y-auto">
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">All products are well stocked.</div>
            ) : (
              <ul className="space-y-3">
                {lowStockProducts.map(p => (
                   <li key={p.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                     <div>
                       <div className="font-bold text-slate-800 text-xs">{p.name}</div>
                       <div className="text-[10px] font-mono text-slate-500">{p.sku}</div>
                     </div>
                     <div className="text-right">
                       <span className="text-red-600 font-bold text-xs bg-red-50 px-2 py-0.5 rounded">Stock: {p.stock}</span>
                     </div>
                   </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-sm font-bold uppercase tracking-wider text-amber-600">
              <AlertCircle className="w-4 h-4 mr-2" /> Pending Customer Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[350px] overflow-y-auto">
            {customers.filter(c => (c.totalAmount - c.paidAmount) > 0).length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">No pending payments.</div>
            ) : (
              <ul className="space-y-3">
                {customers.filter(c => (c.totalAmount - c.paidAmount) > 0).map(c => {
                  const dues = c.totalAmount - c.paidAmount;
                  return (
                    <li key={c.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{c.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{c.phone || "No Contact"}</div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="text-amber-700 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded">Rs. {dues.toLocaleString()}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                          onClick={() => navigate(`/customers`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
