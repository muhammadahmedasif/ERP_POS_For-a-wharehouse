import React, { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Product } from '../types';

const COLORS = ['#4f46e5', '#7c3aed', '#c026d3', '#db2777', '#2563eb', '#059669', '#d97706', '#ea580c'];

export default function TopProducts() {
  
  const [selectedMonth, setSelectedMonth] = useState("");
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data: Product[]) => { setProducts(data); });
    fetch("/api/sales")
      .then((res) => res.json())
      .then((data) => { setSales(Array.isArray(data) ? data : []); });
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
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Top Selling Products</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Revenue breakdown by product per month.</p>
        </div>
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5 overflow-x-auto">
          {Object.keys(monthlyData).map(m => (
             <button key={m} onClick={() => setSelectedMonth(m)}
               className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedMonth === m ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>
               {m}
             </button>
          ))}
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Product ({selectedMonth})</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentData} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
              <XAxis type="number" tick={{fill: '#64748B', fontSize: 12}} />
              <YAxis dataKey="name" type="category" tick={{fill: '#64748B', fontSize: 12}} width={150} />
              <Tooltip cursor={{fill: '#F1F5F9'}} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {currentData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
