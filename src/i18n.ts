import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      dashboard: "Dashboard",
      inventory: "Inventory",
      sales: "Sales",
      customers: "Customers",
      ai_assistant: "AI Assistant",
      total_revenue: "Total Revenue",
      total_orders: "Total Orders",
      products: "Products",
      search_placeholder: "Search...",
      add_product: "Add Product",
      name: "Name",
      sku: "SKU",
      category: "Category",
      stock: "Stock",
      price: "Price",
      actions: "Actions",
      sales_trend: "Sales Trend",
      recent_orders: "Recent Orders",
      ask_anything: "Ask anything about your data...",
      send: "Send",
      ai_insight: "AI Insights & Forecasting",
    },
  },
  ur: {
    translation: {
      dashboard: "ڈیش بورڈ",
      inventory: "انونٹری",
      sales: "سیلز",
      customers: "کسٹمرز",
      ai_assistant: "اے آئی اسسٹنٹ",
      total_revenue: "کل آمدنی",
      total_orders: "کل آرڈرز",
      products: "مصنوعات",
      search_placeholder: "تلاش کریں...",
      add_product: "پروڈکٹ شامل کریں",
      name: "نام",
      sku: "ایس کے یو",
      category: "زمرہ",
      stock: "اسٹاک",
      price: "قیمت",
      actions: "اقدامات",
      sales_trend: "سیلز کا رجحان",
      recent_orders: "حالیہ آرڈرز",
      ask_anything: "اپنے ڈیٹا کے بارے میں کچھ بھی پوچھیں...",
      send: "بھیجیں",
      ai_insight: "اے آئی بصیرت اور پیش گوئی",
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
