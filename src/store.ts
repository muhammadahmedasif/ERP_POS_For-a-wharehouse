import { create } from "zustand";
import { Product, Customer } from "./types";
import { clearStoredAuth, getInitialStoredUser, setStoredAuth } from "./lib/authStorage";

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;

  try {
    res = await fetch(url, options);
  } catch (error) {
    console.error(`API request failed: ${url}`, error);
    throw new Error("Could not reach the app server. Make sure the backend is running and open the app from the server URL.");
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  if (!res.ok) {
    const message = data && typeof data === "object" && "error" in data
      ? String((data as { error?: unknown }).error)
      : typeof data === "string" && data.trim()
        ? data
        : "Request failed";

    // If backend returns 403, the user's paid_status or email_verified is false
    // Force a full logout so they cannot continue using the system
    if (res.status === 403) {
      clearStoredAuth();
      // Dynamically import to avoid circular dependency at module load time
      import("./store").then(({ useAppStore }) => {
        useAppStore.setState({
          user: null,
          products: [],
          categories: [],
          brands: [],
          customers: [],
        });
      });
      // Dispatch a CustomEvent so App.tsx can display a toast before kicking out
      window.dispatchEvent(new CustomEvent("auth:access-denied", { detail: { message } }));
    }

    throw new Error(message);
  }

  return data as T;
}

interface AppState {
  settings: { storeName: string; taxRate: number; sellerName: string; profilePictureUrl: string; profilePicturePublicId: string; billPrinter: string; defaultLowInventoryThreshold: number; };
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: any) => Promise<void>;
  products: Product[];
  fetchProducts: () => Promise<void>;
  addProduct: (product: Partial<Product>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (id: string, amount: number) => Promise<void>;
  categories: { id: string; name: string }[];
  fetchCategories: () => Promise<void>;
  addCategory: (category: { name: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  brands: { id: string; name: string }[];
  fetchBrands: () => Promise<void>;
  addBrand: (brand: { name: string }) => Promise<void>;
  deleteBrand: (id: string) => Promise<void>;
  customers: Customer[];
  fetchCustomers: () => Promise<void>;
  addCustomer: (customer: Partial<Customer>) => Promise<void>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  recordPayment: (customerId: string, amount: number, notes?: string) => Promise<void>;
  user: any | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  
  user: (() => {
    try {
      return getInitialStoredUser();
    } catch {
      clearStoredAuth();
      return null;
    }
  })(),
  login: async (email, password) => {
    const data = await apiRequest<any>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setStoredAuth(data.token, data.user);
    set({ user: data.user });
    
    // Update sellerName in settings
    if (data.user.name) {
      const currentSettings = get().settings;
      await get().updateSettings({ ...currentSettings, sellerName: data.user.name });
    }
  },
  signup: async (email, password, name) => {
    await apiRequest("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
  },
  logout: () => {
    clearStoredAuth();
    set({
      user: null,
      products: [],
      categories: [],
      brands: [],
      customers: [],
      settings: { storeName: 'StockPilot', taxRate: 5, sellerName: '', profilePictureUrl: '', profilePicturePublicId: '', billPrinter: 'Thermal Printer 80mm', defaultLowInventoryThreshold: 10 },
    });
  },

  settings: { storeName: 'StockPilot', taxRate: 5, sellerName: '', profilePictureUrl: '', profilePicturePublicId: '', billPrinter: 'Thermal Printer 80mm', defaultLowInventoryThreshold: 10 },
  fetchSettings: async () => {
    const settings = await apiRequest<AppState["settings"]>("/api/settings");
    set({ settings });
  },
  updateSettings: async (settings) => {
    const savedSettings = await apiRequest<AppState["settings"]>("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    set({ settings: savedSettings });
  },
  products: [],
  categories: [],
  brands: [],
  customers: [],
  
  fetchCategories: async () => {
    const data = await apiRequest<any[]>("/api/categories");
    set({ categories: Array.isArray(data) ? data : [] });
  },
  addCategory: async (category) => {
    const name = category.name?.trim();
    if (!name) throw new Error("Category name cannot be empty");
    if (get().categories.some((c) => c.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new Error("Category already exists");
    }
    const newCat = await apiRequest<{ id: string; name: string }>("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...category, name }),
    });
    set({
      categories: get().categories.some((c) => c.name.trim().toLowerCase() === newCat.name.trim().toLowerCase())
        ? get().categories
        : [...get().categories, newCat],
    });
  },
  deleteCategory: async (id) => {
    await apiRequest(`/api/categories/${id}`, { method: "DELETE" });
    set({ categories: get().categories.filter((c) => c.id !== id) });
  },
  fetchBrands: async () => {
    const data = await apiRequest<any[]>("/api/brands");
    set({ brands: Array.isArray(data) ? data : [] });
  },
  addBrand: async (brand) => {
    const name = brand.name?.trim();
    if (!name) throw new Error("Brand name cannot be empty");
    if (get().brands.some((b) => b.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new Error("Brand already exists");
    }
    const newBrand = await apiRequest<{ id: string; name: string }>("/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...brand, name }),
    });
    set({
      brands: get().brands.some((b) => b.name.trim().toLowerCase() === newBrand.name.trim().toLowerCase())
        ? get().brands
        : [...get().brands, newBrand],
    });
  },
  deleteBrand: async (id) => {
    await apiRequest(`/api/brands/${id}`, { method: "DELETE" });
    set({ brands: get().brands.filter((b) => b.id !== id) });
  },
  fetchProducts: async () => {
    const data = await apiRequest<Product[]>("/api/products");
    console.log("Products from Supabase:", data);
    set({ products: Array.isArray(data) ? data : [] });
  },
  addProduct: async (product) => {
    const result = await apiRequest<Product>("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    set({ products: [...get().products, result] });
  },
  updateProduct: async (id, product) => {
    const updated = await apiRequest<Product>(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    set({
      products: get().products.map((p) => (p.id === id ? updated : p)),
    });
  },
  deleteProduct: async (id) => {
    await apiRequest(`/api/products/${id}`, { method: "DELETE" });
    set({ products: get().products.filter((p) => p.id !== id) });
  },
  adjustStock: async (id, amount) => {
    const p = get().products.find((x) => x.id === id);
    if (!p) return;
    const updated = await apiRequest<Product>(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock: p.stock + amount }),
    });
    set({
      products: get().products.map((p) => (p.id === id ? updated : p)),
    });
  },
  
  fetchCustomers: async () => {
    const data = await apiRequest<Customer[]>("/api/customers");
    set({ customers: Array.isArray(data) ? data : [] });
  },
  addCustomer: async (customer) => {
    const result = await apiRequest<Customer>("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    });
    set({ customers: [...get().customers, result] });
  },
  updateCustomer: async (id, customer) => {
    const result = await apiRequest<Customer>(`/api/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    });
    set({
      customers: get().customers.map((c) => (c.id === id ? result : c)),
    });
  },
  deleteCustomer: async (id) => {
    await apiRequest(`/api/customers/${id}`, { method: "DELETE" });
    set({ customers: get().customers.filter((c) => c.id !== id) });
  },
  recordPayment: async (customerId, amount, notes) => {
    await apiRequest(`/api/customers/${customerId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, notes }),
    });
    await get().fetchCustomers();
  },
}));
