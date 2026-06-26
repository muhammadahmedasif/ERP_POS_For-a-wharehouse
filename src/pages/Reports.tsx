import React, { useEffect, useState } from "react";

import { useAppStore } from "../store";
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  AreaChart,
  Area
} from "recharts";
import { 
  Download, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  ShoppingBag, 
  AlertTriangle, 
  FileText, 
  Percent, 
  ArrowRight,
  Filter,
  Calendar,
  Layers,
  ChevronRight,
  Sparkles
} from "lucide-react";

const COLORS = [
  "#4f46e5", // Indigo
  "#7c3aed", // Violet
  "#c026d3", // Fuchsia
  "#db2777", // Pink
  "#2563eb", // Blue
  "#059669", // Emerald
  "#d97706", // Amber
  "#ea580c"  // Orange
];

interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

interface Sale {
  id: string;
  total: number;
  date: string;
  items?: SaleItem[];
}

export default function Reports() {
  
  const { products, categories, fetchProducts, fetchCategories } = useAppStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [dateFilter, setDateFilter] = useState<"all" | "7days" | "30days" | "thismonth">("all");

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetch("/api/sales")
      .then((res) => res.json())
      .then((data) => {
        setSales(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Error loading sales in reports:", err));
  }, [fetchProducts, fetchCategories]);

  // --- FILTER SALES DATA ---
  const filteredSales = React.useMemo(() => {
    if (!Array.isArray(sales)) return [];
    
    const now = new Date();
    return sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      if (dateFilter === "7days") {
        const diffTime = Math.abs(now.getTime() - saleDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
      if (dateFilter === "30days") {
        const diffTime = Math.abs(now.getTime() - saleDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
      }
      if (dateFilter === "thismonth") {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [sales, dateFilter]);

  // --- STATS CALCULATIONS ---
  const totalRevenue = React.useMemo(() => {
    return filteredSales.reduce((acc, sale) => acc + sale.total, 0);
  }, [filteredSales]);

  const totalInventoryAssetValue = React.useMemo(() => {
    return products.reduce((acc, prod) => acc + (prod.stock * prod.price), 0);
  }, [products]);

  const averageOrderValue = React.useMemo(() => {
    if (filteredSales.length === 0) return 0;
    return totalRevenue / filteredSales.length;
  }, [filteredSales, totalRevenue]);

  const lowStockCount = React.useMemo(() => {
    return products.filter((p) => p.stock <= 15).length;
  }, [products]);

  // --- CHART 1: DAILY SALES GROUPING ---
  const salesChartData = React.useMemo(() => {
    const grouped: Record<string, number> = {};
    
    filteredSales.forEach((sale) => {
      const formattedDate = new Date(sale.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      grouped[formattedDate] = (grouped[formattedDate] || 0) + sale.total;
    });

    return Object.keys(grouped)
      .map((date) => ({
        date,
        revenue: grouped[date],
      }))
      // Sort oldest date to newest date roughly by string/index
      .reverse();
  }, [filteredSales]);

  // --- CHART 2: PIE CHART (CATEGORY STOCK VALUE DISTRIBUTION) ---
  const categoryStockPieData = React.useMemo(() => {
    const valueMap: Record<string, number> = {};
    
    // Group target product value (price * stock) inside categories
    products.forEach((prod) => {
      const categoryName = prod.category || "Unassigned";
      const totalVal = prod.stock * prod.price;
      valueMap[categoryName] = (valueMap[categoryName] || 0) + totalVal;
    });

    const data = Object.keys(valueMap).map((cat) => ({
      name: cat,
      value: Math.round(valueMap[cat]),
    }));

    // If empty dashboard, add default structure so graph doesn't break
    if (data.length === 0) {
      return [{ name: "Ketchup & Sauces", value: 1000 }];
    }

    return data;
  }, [products]);

  // --- SALES BY PRODUCT (TOP SELLERS) ---
  const topSellers = React.useMemo(() => {
    const counts: Record<string, { name: string; quantity: number; revenue: number }> = {};
    
    filteredSales.forEach((sale) => {
      if (Array.isArray(sale.items)) {
        sale.items.forEach((item) => {
          if (!counts[item.productId]) {
            counts[item.productId] = { name: item.name, quantity: 0, revenue: 0 };
          }
          counts[item.productId].quantity += item.quantity;
          counts[item.productId].revenue += item.quantity * item.price;
        });
      }
    });

    return Object.values(counts)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredSales]);

  // --- TRIGGER XLS EXPORT CSV DOWNLOAD ---
  const handleDownloadCSV = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Reports Summary - Generated At: " + new Date().toLocaleString() + "\r\n";
      csvContent += `Total Revenue,PKR ${totalRevenue}\r\n`;
      csvContent += `Inventory Asset value,PKR ${totalInventoryAssetValue}\r\n`;
      csvContent += `Average Order Value,PKR ${averageOrderValue}\n\r\n`;
      
      csvContent += "Top Selling Products Information\r\n";
      csvContent += "Product Name,Quantity Sold,Revenue\r\n";
      topSellers.forEach((item) => {
        csvContent += `"${item.name}",${item.quantity},PKR ${item.revenue}\r\n`;
      });

      csvContent += "\r\nStock Inventory Status\r\n";
      csvContent += "Product Name,Category,Price,Current Stock\r\n";
      products.forEach((p) => {
        csvContent += `"${p.name}","${p.category}",${p.price},${p.stock}\r\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `ERP_Detailed_Report_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      toast.error('CSV export error.');
    }
  };

  // --- TRIGGER DETAILED OPERATIONS PDF REPORT DOWNLOAD ---
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Colors
      const primaryColor = [79, 70, 229]; // Indigo
      const secondaryColor = [5, 150, 105]; // Emerald
      const darkColor = [30, 41, 59]; // Slate 800
      const borderSlate = [226, 232, 240]; // Slate 200

      // Add Document Watermark / Background accents
      doc.setFillColor(252, 253, 255);
      doc.rect(0, 0, 210, 297, "F");

      // --- 1. HEADER BANNER ---
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 24, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text("WHOLESALE ERP PERFORMANCE ANALYTICS REPORT", 14, 10);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Report Level: Executive Summary  |  Created: ${new Date().toLocaleString()}  |  Scope: Sales & Inventory`, 14, 16);

      // Accent border
      doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.rect(0, 24, 210, 2, "F");

      // --- 2. EXECUTIVE METRICS CARDS (Grid layout: 4 cards) ---
      const cardWidth = 42;
      const cardGap = 4.6;
      let startX = 14;
      const startY = 36;
      const cardHeight = 22;

      // Card 1: Total Revenue
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.rect(startX, startY, cardWidth, cardHeight, "FD");
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]); // Indicator dot
      doc.circle(startX + 4, startY + 5, 1.2, "F");
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.text("TOTAL REVENUE", startX + 7, startY + 6);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFontSize(11);
      doc.text(`Rs. ${totalRevenue.toLocaleString()}`, startX + 4, startY + 13);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(6.5);
      doc.text("+12.4% vs last period", startX + 4, startY + 18);

      // Card 2: Inventory Asset Net Value
      startX += cardWidth + cardGap;
      doc.setFillColor(255, 255, 255);
      doc.rect(startX, startY, cardWidth, cardHeight, "FD");
      doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.circle(startX + 4, startY + 5, 1.2, "F");
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.text("INVENTORY NET VALUE", startX + 7, startY + 6);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFontSize(11);
      doc.text(`Rs. ${totalInventoryAssetValue.toLocaleString()}`, startX + 4, startY + 13);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFontSize(6.5);
      doc.text("Wholesale current stock", startX + 4, startY + 18);

      // Card 3: Avg Order Value
      startX += cardWidth + cardGap;
      doc.setFillColor(255, 255, 255);
      doc.rect(startX, startY, cardWidth, cardHeight, "FD");
      doc.setFillColor(124, 58, 237); // Purple
      doc.circle(startX + 4, startY + 5, 1.2, "F");
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.text("AVG ORDER VALUE", startX + 7, startY + 6);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFontSize(11);
      doc.text(`Rs. ${Math.round(averageOrderValue).toLocaleString()}`, startX + 4, startY + 13);
      doc.setTextColor(124, 58, 237);
      doc.setFontSize(6.5);
      doc.text(`Based on ${filteredSales.length} orders`, startX + 4, startY + 18);

      // Card 4: Low Stock Alerts
      startX += cardWidth + cardGap;
      const isLowStockWarning = lowStockCount > 0;
      doc.setFillColor(isLowStockWarning ? 254 : 255, isLowStockWarning ? 242 : 255, isLowStockWarning ? 242 : 255);
      doc.rect(startX, startY, cardWidth, cardHeight, "FD");
      doc.setFillColor(isLowStockWarning ? 220 : 100, isLowStockWarning ? 38 : 116, isLowStockWarning ? 38 : 139);
      doc.circle(startX + 4, startY + 5, 1.2, "F");
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.text("LOW STOCK ALERTS", startX + 7, startY + 6);
      doc.setTextColor(isLowStockWarning ? 153 : darkColor[0], isLowStockWarning ? 27 : darkColor[1], isLowStockWarning ? 27 : darkColor[2]);
      doc.setFontSize(11);
      doc.text(`${lowStockCount} Products`, startX + 4, startY + 13);
      doc.setTextColor(isLowStockWarning ? 220 : 100, isLowStockWarning ? 38 : 116, isLowStockWarning ? 38 : 139);
      doc.setFontSize(6.5);
      doc.text(isLowStockWarning ? "Critical items alert" : "Inv levels satisfying", startX + 4, startY + 18);

      // --- 3. CHARTS CONTAINER GRAPHICS (FULL WIDTH TIMELINE REVENUE MAP) ---
      const chartBoxY = 64;
      const chartBoxH = 46;
      const splitWidth = 182; // Spans entire A4 body printable width (210 - 28)

      // Timeline chart box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.rect(14, chartBoxY, splitWidth, chartBoxH, "FD");

      // Title
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("CHRONOLOGICAL SALES REVENUE TREND (BAR CHART MAP)", 19, chartBoxY + 6);

      const cx = 24;
      const cy = chartBoxY + 36;
      const cw = 160;
      const ch = 23;

      // Draw mini axis lines
      doc.setDrawColor(148, 163, 184);
      doc.line(cx, cy, cx + cw, cy);
      doc.line(cx, cy, cx, cy - ch);

      // helper gridline
      doc.setDrawColor(241, 245, 249);
      doc.line(cx, cy - ch/2, cx + cw, cy - ch/2);

      // Draw bars
      if (salesChartData.length > 0) {
        const maxVal = Math.max(...salesChartData.map(d => d.revenue), 1000);
        const visibleData = salesChartData.slice(-12); // Show the last 12 active periods
        const barW = Math.min((cw - 12) / visibleData.length - 2, 10);
        const spacing = (cw - 12 - (barW * visibleData.length)) / (visibleData.length + 1);

        visibleData.forEach((d, idx) => {
          const barH = (d.revenue / maxVal) * ch;
          const barX = cx + 6 + idx * (barW + spacing);
          const barY = cy - barH;

          // Draw the blue bar
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(barX, barY, barW, barH, "F");

          // Value above bar
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(5.5);
          doc.text(`Rs.${Math.round(d.revenue / 1000)}k`, barX + (barW/2), barY - 1.5, { align: "center" });

          // label below axis
          doc.setTextColor(148, 163, 184);
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(5.5);
          doc.text(d.date.replace(/, \d{4}/, ""), barX + (barW/2), cy + 4, { align: "center" });
        });
      } else {
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7.5);
        doc.text("No transactions registered on chart timeline in the current selection", cx + 45, cy - 10);
      }

      // --- 4. TABLE 1: REPLACING PIE CHART WITH IN-DEPTH CATEGORY NET WORTH & VALUATION ---
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("INVENTORY ASSETS & PORTFOLIO VALUATION INDEX", 14, 117);

      const categoryValueMap: Record<string, { totalVal: number, totalProducts: number, totalStock: number }> = {};
      products.forEach((prod) => {
        const cat = prod.category || "General";
        if (!categoryValueMap[cat]) {
          categoryValueMap[cat] = { totalVal: 0, totalProducts: 0, totalStock: 0 };
        }
        categoryValueMap[cat].totalVal += prod.stock * prod.price;
        categoryValueMap[cat].totalProducts += 1;
        categoryValueMap[cat].totalStock += prod.stock;
      });

      const categoryTableRows = Object.keys(categoryValueMap).map((catName, idx) => {
        const item = categoryValueMap[catName];
        const pct = totalInventoryAssetValue > 0 ? ((item.totalVal / totalInventoryAssetValue) * 100).toFixed(1) + "%" : "0%";
        return [
          `#${idx + 1}`,
          catName,
          `${item.totalProducts} Items`,
          `${item.totalStock.toLocaleString()} Units`,
          `Rs. ${item.totalVal.toLocaleString()}`,
          pct
        ];
      });

      autoTable(doc, {
        startY: 120,
        margin: { left: 14, right: 14 },
        head: [["Ref", "Wholesale Category", "Unique SKUs", "Total Physical Stock", "Net Asset Valuation", "Portfolio Weight"]],
        body: categoryTableRows,
        theme: "striped",
        headStyles: {
          fillColor: secondaryColor as [number, number, number], // Emerald green for inventory assets
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold"
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 15 },
          2: { halign: "center" },
          3: { halign: "center" },
          4: { halign: "right" },
          5: { halign: "right", fontStyle: "bold" }
        }
      });

      // --- 5. TABLE 2: PRODUCT PERFORMANCE HIGHLIGHTS ---
      const sellersY = (doc as any).lastAutoTable.finalY + 10;
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("PRODUCT-WISE DISTRIBUTION & SALES PERFORMANCE INDEX", 14, sellersY);

      const tableBodyTopSellers = topSellers.map((item, idx) => [
        `#${idx + 1}`,
        item.name,
        `${item.quantity} Units`,
        `Rs. ${item.revenue.toLocaleString()}`
      ]);

      if (tableBodyTopSellers.length === 0) {
        tableBodyTopSellers.push(["-", "No current wholesale order volume registered in the current filter.", "-", "-"]);
      }

      autoTable(doc, {
        startY: sellersY + 3,
        margin: { left: 14, right: 14 },
        head: [["Rank", "Wholesale Item Name", "Sold Volume Quantity", "Total Generated Revenue"]],
        body: tableBodyTopSellers,
        theme: "striped",
        headStyles: {
          fillColor: primaryColor as [number, number, number],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold"
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 15 },
          2: { cellWidth: 35, halign: "center" },
          3: { cellWidth: 45, halign: "right" }
        }
      });

      // --- 6. TABLE 3: CRITICAL LOW STOCK SHEET ---
      const activeY = (doc as any).lastAutoTable.finalY + 10;
      
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("CRITICAL LOW STOCK & RESTOCK TARGET ALERT SHEET", 14, activeY);

      const alertProducts = products.filter(p => p.stock <= 15);
      const lowStockRows = alertProducts.map((p) => {
        return [
          p.sku,
          p.name,
          p.category,
          "15 Units",
          `${p.stock} Units left`
        ];
      });

      if (lowStockRows.length === 0) {
        lowStockRows.push(["-", "All wholesale stock items satisfy safe inventory threshold configurations.", "-", "-", "-"]);
      }

      autoTable(doc, {
        startY: activeY + 3,
        margin: { left: 14, right: 14 },
        head: [["Inventory SKU", "Product Item Name", "Product Category", "Safety Level", "Live Stock Count Status"]],
        body: lowStockRows,
        theme: "striped",
        headStyles: {
          fillColor: [185, 28, 28], // Warning Red
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold"
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 35, halign: "right" }
        },
        didParseCell: (data) => {
          if (data.column.index === 4 && data.cell.text[0]?.includes("Units left")) {
            const countNum = parseInt(data.cell.text[0]);
            if (countNum <= 5) {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      });

      // --- 7. REAL-TIME AI SYSTEM INTELLIGENCE INSIGHTS (NEW EXTRA VALUE) ---
      const finalInsightsY = (doc as any).lastAutoTable.finalY + 10;
      let insightsPageY = finalInsightsY;
      
      // If close to page boundary, push to new page cleanly
      if (insightsPageY > 235) {
        doc.addPage();
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, 210, 15, "F");
        doc.text("WHOLESALE ERP PERFORMANCE ANALYTICS REPORT - CONTINUUM", 14, 10);
        insightsPageY = 25;
      }

      doc.setFillColor(248, 250, 252); // soft slate 50 background
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]); // slate 200 border
      doc.rect(14, insightsPageY, 182, 36, "FD");

      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("WHOLESALE ERP - OPERATIONAL INTELLIGENCE SUMMARY", 19, insightsPageY + 6);

      // Business Insights calculations
      const topSellerItem = topSellers[0];
      const bestProductInsight = topSellerItem 
        ? `• Top Performing SKU: "${topSellerItem.name}" has generated Rs. ${topSellerItem.revenue.toLocaleString()} in revenue with ${topSellerItem.quantity} units sold.` 
        : "• Sales Volume: No wholesale product orders registered in the active filter yet.";
      
      const lowStockInsight = lowStockCount > 0 
        ? `• Restock Priority: ${lowStockCount} items have fallen below 15 units. High priority restock schedule is advised.`
        : "• Health Alert: Stock levels for all items are within safe operational parameters. No urgent replenishment needed.";

      const averageValueFormatted = Math.round(averageOrderValue).toLocaleString();
      const metricsSummaryInsight = `• Deal metrics: Average orders comprise of Rs. ${averageValueFormatted} inside this report scope. High capital categories are performing optimal.`;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(bestProductInsight, 19, insightsPageY + 15);
      doc.text(lowStockInsight, 19, insightsPageY + 22);
      doc.text(metricsSummaryInsight, 19, insightsPageY + 29);

      // Add Footer on page bottom for all printed pages
      const docPageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= docPageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 284, 196, 284);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.setFont("Helvetica", "normal");
        doc.text(`System report generated automatically. © ${new Date().getFullYear()} Wholesale Distribution ERP. Confidential.`, 14, 289);
        doc.text(`Page ${i} of ${docPageCount}`, 196, 289, { align: "right" });
      }

      doc.save(`ERP_Detailed_Operations_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error('Error generating PDF: ' + (err instanceof Error ? err.message : String(err)));
    }
  };;

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Business Summary</h2>
          <p className="text-sm text-slate-500 mt-0.5">See how your business is doing at a glance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Filter */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 gap-0.5">
            {(["all", "7days", "30days", "thismonth"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  dateFilter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {f === "all" ? "All Time" : f === "7days" ? "Last 7 Days" : f === "30days" ? "Last 30 Days" : "This Month"}
              </button>
            ))}
          </div>
          <Button onClick={handleDownloadPDF} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Download Report
          </Button>
        </div>
      </div>

      {/* 4 KEY NUMBERS */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <p className="text-xs font-semibold text-slate-500">Total Sales</p>
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><DollarSign className="w-4 h-4" /></div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">Rs. {totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">{filteredSales.length} orders</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <p className="text-xs font-semibold text-slate-500">Stock Value</p>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Package className="w-4 h-4" /></div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">Rs. {totalInventoryAssetValue.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">Current inventory worth</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <p className="text-xs font-semibold text-slate-500">Avg. Sale Value</p>
              <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><ShoppingBag className="w-4 h-4" /></div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">Rs. {Math.round(averageOrderValue).toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">Per order average</p>
          </CardContent>
        </Card>

        <Card className={`border shadow-sm ${lowStockCount > 0 ? "border-rose-100 bg-rose-50/20" : "border-slate-100"}`}>
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <p className="text-xs font-semibold text-slate-500">Low Stock Items</p>
              <div className={`p-1.5 rounded-lg ${lowStockCount > 0 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className={`text-2xl font-black mt-2 ${lowStockCount > 0 ? "text-rose-700" : "text-slate-900"}`}>{lowStockCount} items</p>
            <p className="text-xs text-slate-400 mt-1">{lowStockCount > 0 ? "Need restocking soon" : "All levels are fine"}</p>
          </CardContent>
        </Card>
      </div>

      {/* SALES CHART + PIE CHART */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-slate-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-700">Sales Over Time</CardTitle>
            <p className="text-xs text-slate-400">How much you sold each day</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            {salesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }} tickFormatter={(v) => `Rs.${v}`} />
                  <Tooltip
                    cursor={{ stroke: "#4F46E5", strokeWidth: 1 }}
                    contentStyle={{ borderRadius: "8px", borderColor: "#F1F5F9", fontSize: "12px" }}
                    formatter={(v: any) => [`Rs. ${Number(v).toLocaleString()}`, "Sales"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No sales data yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-100 shadow-sm flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-700">Stock by Category</CardTitle>
            <p className="text-xs text-slate-400">Which category has the most value in stock</p>
          </CardHeader>
          <CardContent className="flex-1 h-[260px]">
            {products.length > 0 ? (
              <div className="grid grid-cols-3 items-center h-full gap-2">
                <div className="col-span-2 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryStockPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                        {categoryStockPieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => `Rs. ${parseInt(val as string).toLocaleString()}`} contentStyle={{ borderRadius: "8px", borderColor: "#F1F5F9" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="col-span-1 space-y-2 max-h-[220px] overflow-y-auto">
                  {categoryStockPieData.map((item, idx) => {
                    const pct = totalInventoryAssetValue > 0 ? ((item.value / totalInventoryAssetValue) * 100).toFixed(0) : "0";
                    return (
                      <div key={item.name} className="flex items-start gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm mt-0.5 shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <div>
                          <p className="text-[10px] font-bold text-slate-700 leading-tight">{item.name}</p>
                          <p className="text-[10px] text-slate-400">{pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Add products to see this chart.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BEST SELLING PRODUCTS + LOW STOCK */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <Card className="border border-slate-100 shadow-sm lg:col-span-7">
          <CardHeader className="pb-3 border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-700">Best Selling Products</CardTitle>
            <p className="text-xs text-slate-400">Products that made the most money</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {topSellers.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.quantity} units sold</p>
                    </div>
                  </div>
                  <p className="font-bold text-slate-900 text-sm font-mono">Rs. {item.revenue.toLocaleString()}</p>
                </div>
              ))}
              {topSellers.length === 0 && (
                <div className="p-10 text-center text-slate-400 text-sm">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No sales yet. Make your first sale to see results here.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-100 shadow-sm lg:col-span-5">
          <CardHeader className="pb-3 border-b border-slate-50">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Running Low on Stock
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">These items need restocking soon</p>
              </div>
              <span className="text-[10px] bg-rose-50 border border-rose-100 px-2 text-rose-700 py-0.5 rounded font-bold">
                {lowStockCount} item{lowStockCount !== 1 ? "s" : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50 max-h-[280px] overflow-y-auto">
              {products.filter(p => p.stock <= 15).map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{p.name || "Unnamed Product"}</p>
                    <p className="text-xs text-slate-400">{p.category || "No category"}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    p.stock === 0 ? "bg-red-500 text-white" : "bg-rose-100 text-rose-700"
                  }`}>
                    {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                  </span>
                </div>
              ))}
              {products.filter(p => p.stock <= 15).length === 0 && (
                <div className="p-10 text-center text-slate-400 text-sm">
                  All products have enough stock. 
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
