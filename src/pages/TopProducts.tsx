import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Product } from '../types';

export default function TopProducts() {
  const { t } = useTranslation();
  
  const [selectedMonth, setSelectedMonth] = useState("");
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data: Product[]) => {
        setProducts(data);
      });
    fetch("/api/sales")
      .then((res) => res.json())
      .then((data) => {
        setSales(data);
      });
  }, []);

  const monthlyData: Record<string, any> = {};
  
  sales.forEach(sale => {
    const d = new Date(sale.date);
    const month = d.toLocaleString("default", { month: "short" });
    if (!monthlyData[month]) {
      monthlyData[month] = { productMap: {} };
    }

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

  const currentData = monthlyData[selectedMonth]?.topProducts || [];


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800">Top Selling Products</h2>
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
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Revenue by Product ({selectedMonth})</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentData} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
              <XAxis type="number" tick={{fill: '#64748B', fontSize: 12}} />
              <YAxis dataKey="name" type="category" tick={{fill: '#64748B', fontSize: 12}} width={150} />
              <Tooltip cursor={{fill: '#F1F5F9'}} />
              <Bar dataKey="revenue" fill="#4F46E5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
