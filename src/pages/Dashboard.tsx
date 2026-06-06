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
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Download,
  FileText
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";
import { Product } from "../types";
import { useAppStore } from "../store";

const Dashboard = () => {
  const settings = useAppStore(state => state.settings);
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
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

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const sixMonthStart = selectedYear === currentYear ? Math.max(0, currentMonth - 5) : 0;
  const visibleMonths = monthNames.slice(sixMonthStart, sixMonthStart + 6);

  const monthlyData: Record<string, any> = {};
  
  sales.forEach(sale => {
    const d = new Date(sale.date);
    const year = d.getFullYear();
    const month = d.toLocaleString("default", { month: "short" });
    const key = `${year}-${month}`;
    if (!monthlyData[key]) {
      monthlyData[key] = { revenue: 0, productMap: {}, orders: 0 };
    }
    monthlyData[key].revenue += Number(sale.total) || 0;
    monthlyData[key].orders += 1;

    sale.items?.forEach((item: any) => {
       const productName = products.find(p => p.id === item.productId)?.name || `Prod-${item.productId}`;
       if (!monthlyData[key].productMap[productName]) {
         monthlyData[key].productMap[productName] = 0;
       }
       monthlyData[key].productMap[productName] += ((Number(item.price) || 0) * (Number(item.quantity) || 0));
    });
  });

  Object.keys(monthlyData).forEach(key => {
    monthlyData[key].topProducts = Object.keys(monthlyData[key].productMap).map(k => ({
      name: k,
      revenue: monthlyData[key].productMap[k]
    })).sort((a,b) => b.revenue - a.revenue);
  });

  const availableYears = Array.from(new Set([
    currentYear,
    ...sales.map(sale => new Date(sale.date).getFullYear()).filter(year => !Number.isNaN(year))
  ])).sort((a, b) => b - a);

  useEffect(() => {
     if (!visibleMonths.includes(selectedMonth)) {
       setSelectedMonth(visibleMonths[visibleMonths.length - 1]);
     }
  }, [selectedMonth, visibleMonths]);

  const selectedMonthKey = `${selectedYear}-${selectedMonth}`;
  const currentData = monthlyData[selectedMonthKey] || { revenue: 0, orders: 0, topProducts: [], completed: 0, processing: 0 };
  const selectedMonthIndex = monthNames.indexOf(selectedMonth);
  const now = new Date();
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonthIndex === now.getMonth();
  const selectedSales = sales.filter(sale => {
    const date = new Date(sale.date);
    return date.getFullYear() === selectedYear && date.getMonth() === selectedMonthIndex;
  });
  const selectedAverageOrder = selectedSales.length > 0 ? currentData.revenue / selectedSales.length : 0;
  const selectedUnitsSold = selectedSales.reduce((total, sale) => {
    return total + (sale.items || []).reduce((itemTotal: number, item: any) => itemTotal + (Number(item.quantity) || 0), 0);
  }, 0);

  const monthlySalesData = visibleMonths.map(m => ({
    name: m,
    sales: monthlyData[`${selectedYear}-${m}`]?.revenue || 0
  }));

  const categoryMap: Record<string, number> = {};
  selectedSales.forEach(sale => {
    sale.items?.forEach((item: any) => {
      const p = products.find(prod => prod.id === item.productId);
      const cat = p?.category || 'Other';
      categoryMap[cat] = (categoryMap[cat] || 0) + ((Number(item.price) || 0) * (Number(item.quantity) || 0));
    });
  });
  const pieData = Object.keys(categoryMap).map(k => ({ name: k, value: categoryMap[k] }));

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const handleDownloadMonthlyPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const reportTitle = `${selectedMonth} ${selectedYear} Monthly Sales Report`;
    const generatedAt = new Date().toLocaleString();
    const primaryColor: [number, number, number] = [79, 70, 229];
    const darkColor: [number, number, number] = [30, 41, 59];

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(15);
    doc.text(reportTitle, 14, 12);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${settings.storeName || "Apex Distro ERP"} | Generated: ${generatedAt}`, 14, 19);

    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Executive Summary", 14, 40);

    autoTable(doc, {
      startY: 44,
      margin: { left: 14, right: 14 },
      head: [["Metric", "Value"]],
      body: [
        ["Total Revenue", `Rs. ${currentData.revenue.toLocaleString()}`],
        ["Orders", `${selectedSales.length}`],
        ["Units Sold", `${selectedUnitsSold}`],
        ["Average Order Value", `Rs. ${Math.round(selectedAverageOrder).toLocaleString()}`],
        ["Unique Products Sold", `${currentData.topProducts.length}`],
      ],
      theme: "striped",
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });

    const topProductsY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Top Selling Products", 14, topProductsY);
    autoTable(doc, {
      startY: topProductsY + 4,
      margin: { left: 14, right: 14 },
      head: [["Rank", "Product", "Revenue"]],
      body: currentData.topProducts.length
        ? currentData.topProducts.map((p: any, index: number) => [`#${index + 1}`, p.name, `Rs. ${Number(p.revenue || 0).toLocaleString()}`])
        : [["-", "No products sold in this month", "-"]],
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
    });

    const salesY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Sales Ledger", 14, salesY);
    autoTable(doc, {
      startY: salesY + 4,
      margin: { left: 14, right: 14 },
      head: [["Order", "Date", "Items", "Paid", "Total"]],
      body: selectedSales.length
        ? selectedSales.map(sale => [
            sale.id,
            new Date(sale.date).toLocaleDateString(),
            (sale.items || []).map((item: any) => `${item.name || item.productId} x${item.quantity}`).join(", "),
            `Rs. ${Number(sale.amountPaid || sale.amount_paid || 0).toLocaleString()}`,
            `Rs. ${Number(sale.total || 0).toLocaleString()}`,
          ])
        : [["-", "-", "No sales recorded in this month", "-", "-"]],
      theme: "grid",
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: { 2: { cellWidth: 70 }, 3: { halign: "right" }, 4: { halign: "right", fontStyle: "bold" } },
    });

    const categoryY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Category Revenue Breakdown", 14, categoryY);
    autoTable(doc, {
      startY: categoryY + 4,
      margin: { left: 14, right: 14 },
      head: [["Category", "Revenue Share"]],
      body: pieData.length
        ? pieData.map(item => [item.name, `Rs. ${Number(item.value || 0).toLocaleString()}`])
        : [["No category revenue", "Rs. 0"]],
      theme: "striped",
      headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 284, 196, 284);
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7);
      doc.text(`Apex Distro ERP monthly report | Page ${i} of ${pageCount}`, 14, 289);
    }

    doc.save(`ERP_Monthly_Report_${selectedYear}_${selectedMonth}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("dashboard")}</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Showing report data for {selectedMonth} {selectedYear}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white rounded-md px-3 py-1.5 shadow-sm border border-slate-200">
            <CalendarDays className="w-4 h-4 text-indigo-500" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-white rounded-md p-1 shadow-sm border border-slate-200">
          {visibleMonths.map(m => (
             <button 
               key={m} 
               onClick={() => setSelectedMonth(m)}
               className={`px-4 py-1.5 text-sm font-bold rounded-sm transition-colors ${selectedMonth === m ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
             >
               {m}
             </button>
          ))}
          </div>
          <Button onClick={handleDownloadMonthlyPDF} className="h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-700">
            <Download className="w-4 h-4 mr-2" />
            Monthly PDF
          </Button>
        </div>
      </div>

      <div className={`grid gap-6 ${isCurrentMonth ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
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

        {!isCurrentMonth && (
          <>
            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Orders ({selectedMonth})
                </CardTitle>
                <FileText className="w-4 h-4 text-slate-300" />
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {selectedSales.length}
                  </div>
                  <p className="mt-2 text-slate-500 text-xs font-bold">
                    {selectedUnitsSold} units sold
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Avg Order Value
                </CardTitle>
                <DollarSign className="w-4 h-4 text-slate-300" />
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    Rs. {Math.round(selectedAverageOrder).toLocaleString()}
                  </div>
                  <p className="mt-2 text-slate-500 text-xs font-bold">
                    Based on {selectedSales.length} orders
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {isCurrentMonth && (
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
        )}
      </div>

      {isCurrentMonth && (
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
      )}

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
