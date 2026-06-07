import React, { useEffect, useMemo, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { ProductImage } from "../components/ProductImage";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Product } from "../types";
import { AlertCircle, Edit2, PackageSearch, Plus, RotateCcw, Search, Tag, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { cn } from "../lib/utils";
import { useAppStore } from "../store";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";

type LookupSource = "supabase" | "open_food_facts" | "open_beauty_facts" | "open_products_facts";

type SmartSuggestion = Partial<Product> & {
  source: LookupSource;
  productType?: string;
  locked?: boolean;
};

type FlowStep = "lookup" | "stock" | "not_found" | "custom";

const unitTypes = ["pcs", "kg", "liter", "gram"];
const defaultCategories = ["Food & Grocery", "Beverages", "Cosmetics", "Electronics", "Household", "Other / Custom"];
const defaultBrands = ["Unbranded / Generic"];

const generateSku = () => `PR-ID-${Math.floor(100000 + Math.random() * 900000)}`;
const normalizeProductKey = (value?: string) => (value || "").trim().replace(/\s+/g, " ").toLowerCase();
const normalizeBarcodeKey = (value?: string) => (value || "").trim().toLowerCase();

const normalizeBrandKey = (value?: string) => {
  const normalized = normalizeProductKey(value);
  return !normalized || normalized === "unbranded" || normalized === "unbranded / generic" || normalized === "generic"
    ? "unbranded / generic"
    : normalized;
};

const classifyProduct = (value: string) => {
  const text = normalizeProductKey(value);
  if (/\b(rice|daal|dal|lentil|wheat|flour|atta|sugar|salt|oil|ghee|masala|spice|noodle|biscuit|cookie|bread|milk|tea|coffee|cereal|snack|chocolate|ketchup|sauce)\b/.test(text)) return "food";
  if (/\b(juice|cola|soda|water|drink|beverage|energy drink|soft drink)\b/.test(text)) return "beverages";
  if (/\b(soap|shampoo|cream|lotion|makeup|lipstick|perfume|deodorant|toothpaste|face wash|cosmetic)\b/.test(text)) return "cosmetics";
  if (/\b(charger|mobile|phone|cable|adapter|battery|earphone|headphone|usb|led|bulb|electronics?)\b/.test(text)) return "electronics";
  if (/\b(detergent|cleaner|dishwash|tissue|napkin|foil|bag|brush|mop|household|phenyl)\b/.test(text)) return "household";
  return "unknown";
};

const humanProductType = (type?: string) => {
  switch (type) {
    case "food":
      return "Food & Grocery";
    case "beverages":
      return "Beverages";
    case "cosmetics":
      return "Cosmetics";
    case "electronics":
      return "Electronics";
    case "household":
      return "Household";
    default:
      return "Other / Custom";
  }
};

const mergeNames = (...groups: string[][]) => {
  const seen = new Set<string>();
  return groups.flat().filter((name) => {
    const key = normalizeProductKey(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const blankForm = (settings: { defaultLowInventoryThreshold: number }, category = "Other / Custom", brand = "Unbranded / Generic", barcode = "") => ({
  name: "",
  sku: generateSku(),
  category,
  brand,
  stock: 0,
  price: 0,
  purchasePrice: 0,
  barcode,
  imageUrl: "",
  publicId: "",
  lowInventoryThreshold: settings.defaultLowInventoryThreshold,
  unitType: "pcs",
  productType: "unknown",
  source: "" as LookupSource | "",
});

const Inventory = () => {
  const { t } = useTranslation();
  const {
    products,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    categories,
    fetchCategories,
    brands,
    fetchBrands,
    settings,
  } = useAppStore();

  const [listSearchTerm, setListSearchTerm] = useState("");
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>("lookup");
  const [lookupQuery, setLookupQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [notFoundValue, setNotFoundValue] = useState("");
  const [stockAdditions, setStockAdditions] = useState<Record<string, string>>({});
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const lookupInputRef = useRef<HTMLInputElement>(null);

  const categoryOptions = useMemo(
    () => mergeNames(categories.map((category) => category.name), defaultCategories),
    [categories],
  );

  const brandOptions = useMemo(
    () => mergeNames(brands.map((brand) => brand.name), defaultBrands),
    [brands],
  );

  const [formData, setFormData] = useState(() => blankForm(settings));

  const productToSuggestion = (product: Product): SmartSuggestion => ({
    ...product,
    source: "supabase",
    locked: true,
    productType: classifyProduct(`${product.name} ${product.category} ${product.brand || ""}`),
  });

  const findExistingProductByBarcode = (barcode?: string) => {
    const key = normalizeBarcodeKey(barcode);
    if (!key) return undefined;
    return products.find((product) => normalizeBarcodeKey(product.barcode) === key);
  };

  const isDuplicateProduct = (candidate: Partial<Product>) => {
    const candidateName = normalizeProductKey(candidate.name);
    const candidateCategory = normalizeProductKey(candidate.category);
    const candidateBrand = normalizeBrandKey(candidate.brand);
    if (!candidateName) return false;

    return products.some((product) => (
      normalizeProductKey(product.name) === candidateName
      && normalizeProductKey(product.category) === candidateCategory
      && normalizeBrandKey(product.brand) === candidateBrand
    ));
  };

  const guessUnitType = (name: string, category: string): string => {
    const text = `${name} ${category}`.toLowerCase();
    // More precise matching for different unit types
    if (/\b(kg|kilogram|kilograms)\b/.test(text) || /\b(rice|sugar|flour|wheat|lentils|atta|daal|dal)\b/.test(text)) return "kg";
    if (/\b(g|gm|gram|grams)\b/.test(text) || /\b(masala|spice|tea|coffee|jam)\b/.test(text)) return "gram";
    if (/\b(l|liter|litre|liters|litres|ml|water|oil|milk|juice|soda|cola|shampoo|lotion|liquid)\b/.test(text)) return "liter";
    return "pcs";
  };

  const openAddFlow = () => {
    setIsAddOpen(true);
    setFlowStep("lookup");
    setLookupQuery("");
    setSuggestions([]);
    setSelectedProduct(null);
    setValidationError(null);
    setLookupError(null);
    setNotFoundValue("");
    setFormData(blankForm(settings, categoryOptions[0] || "Other / Custom", brandOptions[0] || "Unbranded / Generic"));
    window.setTimeout(() => lookupInputRef.current?.focus(), 50);
  };

  const openEditFlow = (product: Product) => {
    setEditingProduct(product);
    setValidationError(null);
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      brand: product.brand || "Unbranded / Generic",
      stock: product.stock,
      price: product.price,
      purchasePrice: product.purchasePrice || 0,
      barcode: product.barcode || "",
      imageUrl: product.imageUrl || "",
      publicId: product.publicId || "",
      lowInventoryThreshold: product.lowInventoryThreshold || settings.defaultLowInventoryThreshold,
      unitType: product.unitType || "pcs",
      productType: classifyProduct(`${product.name} ${product.category} ${product.brand || ""}`),
      source: "supabase",
    });
    setIsEditOpen(true);
  };

  const resetToLookup = (query = "") => {
    setFlowStep("lookup");
    setLookupQuery(query);
    setSuggestions([]);
    setSelectedProduct(null);
    setValidationError(null);
    setLookupError(null);
    setNotFoundValue("");
    window.setTimeout(() => lookupInputRef.current?.focus(), 50);
  };

  const openNotFound = (value: string) => {
    setFlowStep("not_found");
    setSuggestions([]);
    setSelectedProduct(null);
    setValidationError(null);
    setLookupError(null);
    setNotFoundValue(value);
  };

  const openCustomFlow = () => {
    setIsAddOpen(true);
    setFlowStep("custom");
    setSelectedProduct(null);
    setValidationError(null);
    setLookupError(null);
    setFormData(blankForm(settings, categoryOptions[0] || "Other / Custom", brandOptions[0] || "Unbranded / Generic", /^\d{5,}$/.test(notFoundValue) ? notFoundValue : ""));
  };

  const openStockFlow = (suggestion: SmartSuggestion) => {
    const existing = suggestion.id
      ? products.find((product) => product.id === suggestion.id)
      : findExistingProductByBarcode(suggestion.barcode);
    const productType = suggestion.productType || classifyProduct(`${suggestion.name} ${suggestion.category} ${suggestion.brand || ""}`);
    const lockedProduct = existing || null;

    setFlowStep("stock");
    setSelectedProduct(lockedProduct);
    setValidationError(null);
    setLookupError(null);
    setSuggestions([]);
    setFormData({
      name: suggestion.name || "",
      sku: existing?.sku || generateSku(),
      category: suggestion.category || humanProductType(productType),
      brand: suggestion.brand || "Unbranded / Generic",
      stock: 0,
      price: Number(existing?.price || 0),
      purchasePrice: Number(existing?.purchasePrice || 0),
      barcode: suggestion.barcode || existing?.barcode || "",
      imageUrl: suggestion.imageUrl || existing?.imageUrl || "",
      publicId: existing?.publicId || "",
      lowInventoryThreshold: existing?.lowInventoryThreshold || settings.defaultLowInventoryThreshold,
      unitType: existing?.unitType || suggestion.unitType || guessUnitType(suggestion.name || "", suggestion.category || ""),
      productType,
      source: suggestion.source,
    });
  };

  const lookupBarcode = async (barcode: string) => {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return;

    setLookupQuery(cleanBarcode);
    setSuggestions([]);
    setLookupError(null);
    setValidationError(null);
    setIsLookupLoading(true);

    try {
      const response = await fetch(`/api/product-lookup/barcode/${encodeURIComponent(cleanBarcode)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Barcode lookup failed");

      if (result.status === "found" && result.product) {
        openStockFlow(result.product);
      } else {
        openNotFound(cleanBarcode);
      }
    } catch (error: any) {
      setLookupError(error.message || "Barcode lookup failed");
    } finally {
      setIsLookupLoading(false);
    }
  };

  const barcodeScanHandler = useRef<(barcode: string) => void>(() => { });
  barcodeScanHandler.current = (barcode: string) => {
    const cleanBarcode = barcode.trim();
    if (isAddOpen && flowStep === "lookup") {
      void lookupBarcode(cleanBarcode);
      return;
    }

    const existing = findExistingProductByBarcode(cleanBarcode);
    setListSearchTerm(cleanBarcode);
    if (existing) {
      setHighlightedProductId(existing.id);
      window.setTimeout(() => setHighlightedProductId(null), 1800);
    }
  };

  useBarcodeScanner((barcode) => {
    barcodeScanHandler.current(barcode);
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBrands();
  }, [fetchProducts, fetchCategories, fetchBrands]);

  useEffect(() => {
    if (!isAddOpen || flowStep !== "lookup") return;

    const query = lookupQuery.trim();
    setLookupError(null);

    if (query.length < 3) {
      setSuggestions([]);
      setIsLookupLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (/^\d{3,}$/.test(query)) {
        const localBarcodeMatches = products
          .filter((product) => normalizeBarcodeKey(product.barcode).includes(normalizeBarcodeKey(query)))
          .slice(0, 8)
          .map(productToSuggestion);

        setSuggestions(localBarcodeMatches);

        const exactMatch = localBarcodeMatches.find((product) => normalizeBarcodeKey(product.barcode) === normalizeBarcodeKey(query));
        if (exactMatch) {
          setIsLookupLoading(false);
          return;
        }

        if (/^\d{5,}$/.test(query)) {
          await lookupBarcode(query);
          return;
        }
      }

      setIsLookupLoading(true);
      try {
        const response = await fetch(`/api/product-lookup/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Product search failed");
        const nextSuggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
        setSuggestions(nextSuggestions);
        if (nextSuggestions.length === 0) {
          openNotFound(query);
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          setLookupError(error.message || "Product search failed");
          setSuggestions([]);
        }
      } finally {
        setIsLookupLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [lookupQuery, isAddOpen, flowStep, products]);

  const handleProductImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 300, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const dataUrl = reader.result as string;
          const res = await fetch("/api/upload-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || "Failed to upload product image.");
          setFormData((prev) => ({ ...prev, imageUrl: result.url, publicId: result.public_id }));
          setValidationError(null);
        } catch (error: any) {
          setValidationError(error.message || "Failed to upload product image.");
        }
      };
      reader.readAsDataURL(compressedFile);
    } catch (error: any) {
      setValidationError(error.message || "Failed to compress product image.");
    }
  };

  const handleRemoveProductImage = async () => {
    if (formData.publicId) {
      await fetch("/api/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: formData.publicId }),
      });
    }
    setFormData((prev) => ({ ...prev, imageUrl: "", publicId: "" }));
  };

  const validateStockFields = () => {
    if (formData.stock <= 0) return "Quantity must be greater than 0.";
    if (formData.price <= 0) return "Selling price must be greater than Rs. 0.";
    if (formData.purchasePrice < 0) return "Purchase price cannot be negative.";
    if (formData.lowInventoryThreshold < 0) return "Low stock alert cannot be negative.";
    if (!formData.unitType) return "Unit type is required.";
    return null;
  };

  const validateCustomProductFields = () => {
    if (!formData.name.trim()) return "Product name is required.";
    if (!formData.category) return "Category is required.";
    if (!formData.unitType) return "Unit type is required.";
    return null;
  };

  const handleSaveStock = async () => {
    const error = validateStockFields();
    if (error) {
      setValidationError(error);
      return;
    }

    try {
      if (selectedProduct) {
        await updateProduct(selectedProduct.id, {
          stock: Number(selectedProduct.stock || 0) + formData.stock,
          price: formData.price,
          purchasePrice: formData.purchasePrice,
          lowInventoryThreshold: formData.lowInventoryThreshold,
          unitType: formData.unitType,
          imageUrl: formData.imageUrl,
          publicId: formData.publicId,
        });
      } else {
        const existingByBarcode = findExistingProductByBarcode(formData.barcode);
        if (existingByBarcode) {
          openStockFlow(productToSuggestion(existingByBarcode));
          setValidationError("This barcode already exists. Add stock to the existing product.");
          return;
        }

        const candidate = {
          ...formData,
          name: formData.name.trim(),
          brand: formData.brand || "Unbranded / Generic",
        };
        if (isDuplicateProduct(candidate)) {
          setValidationError("Already existing product with the same name, category, and brand.");
          return;
        }
        await addProduct(candidate);
      }

      await fetchProducts();
      setIsAddOpen(false);
    } catch (error: any) {
      setValidationError(error.message || "Failed to save stock.");
    }
  };

  const handleCreateCustomProduct = async () => {
    const error = validateCustomProductFields();
    if (error) {
      setValidationError(error);
      return;
    }

    try {
      const existingByBarcode = findExistingProductByBarcode(formData.barcode);
      if (existingByBarcode) {
        openStockFlow(productToSuggestion(existingByBarcode));
        setValidationError("This barcode already exists. Add stock to the existing product.");
        return;
      }

      const candidate = {
        ...formData,
        name: formData.name.trim(),
        brand: formData.brand || "Unbranded / Generic",
        stock: 0,
        price: 0,
        lowInventoryThreshold: settings.defaultLowInventoryThreshold,
        productType: classifyProduct(`${formData.name} ${formData.category} ${formData.brand}`),
      };
      if (isDuplicateProduct(candidate)) {
        setValidationError("Already existing product with the same name, category, and brand.");
        return;
      }

      await addProduct(candidate);
      await fetchProducts();
      setIsAddOpen(false);
    } catch (error: any) {
      setValidationError(error.message || "Failed to create custom product.");
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    const error = validateCustomProductFields();
    if (error) {
      setValidationError(error);
      return;
    }
    try {
      await updateProduct(editingProduct.id, {
        name: formData.name.trim(),
        category: formData.category,
        brand: formData.brand || "Unbranded / Generic",
        barcode: formData.barcode,
        imageUrl: formData.imageUrl,
        publicId: formData.publicId,
        unitType: formData.unitType,
        lowInventoryThreshold: formData.lowInventoryThreshold,
      });
      await fetchProducts();
      setIsEditOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      setValidationError(err.message || "Failed to update product.");
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete ${product.name}?`)) return;

    try {
      if (product.publicId) {
        await fetch("/api/delete-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_id: product.publicId }),
        });
      }
      await deleteProduct(product.id);
    } catch (error: any) {
      alert(error.message || "Failed to delete product.");
    }
  };

  const handleInlineAddStock = async (product: Product) => {
    const amount = Number.parseInt(stockAdditions[product.id] || "0", 10);
    if (!Number.isFinite(amount) || amount <= 0) return;

    try {
      await updateProduct(product.id, { stock: Number(product.stock || 0) + amount });
      setStockAdditions((prev) => ({ ...prev, [product.id]: "" }));
      await fetchProducts();
      setHighlightedProductId(product.id);
      window.setTimeout(() => setHighlightedProductId(null), 1200);
    } catch (error: any) {
      alert(error.message || "Failed to add stock.");
    }
  };

  const filtered = products.filter((product) => (
    product.name?.toLowerCase().includes(listSearchTerm.toLowerCase())
    || product.sku?.toLowerCase().includes(listSearchTerm.toLowerCase())
    || product.category?.toLowerCase().includes(listSearchTerm.toLowerCase())
    || product.brand?.toLowerCase().includes(listSearchTerm.toLowerCase())
    || (product.barcode && product.barcode.includes(listSearchTerm))
  ));

  const getSourceLabel = (source?: string) => {
    if (source === "open_beauty_facts") return "Open Beauty Facts";
    if (source === "open_products_facts") return "Open Products Facts";
    if (source === "open_food_facts") return "Open Food Facts";
    if (source === "web_search") return "Web Search";
    return "Inventory";
  };

  const sourceLabel = getSourceLabel(formData.source);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-800">{t("inventory")}</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white" onClick={openAddFlow}>
            <PackageSearch className="w-4 h-4 mr-2" />
            Smart Add
          </Button>
          <Button className="flex-1 sm:flex-none" variant="outline" onClick={openCustomFlow}>
            <Plus className="w-4 h-4 mr-2" />
            Custom Add
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t("search_placeholder")}
              className="pl-9"
              value={listSearchTerm}
              onChange={(e) => setListSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium min-w-[250px]">{t("name")}</th>
                  <th className="px-6 py-3 font-medium">Product ID (SKU) & Barcode</th>
                  <th className="px-6 py-3 font-medium">{t("category")}</th>
                  <th className="px-6 py-3 font-medium">Brand</th>
                  <th className="px-6 py-3 font-medium">{t("stock")}</th>
                  <th className="px-6 py-3 font-medium">Add Stock</th>
                  <th className="px-6 py-3 font-medium">{t("price")}</th>
                  <th className="px-6 py-3 font-medium text-right">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((product) => (
                  <tr
                    key={product.id}
                    className={cn(
                      "transition-colors duration-500",
                      highlightedProductId === product.id ? "bg-indigo-100" : "hover:bg-slate-50",
                    )}
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div className="flex items-center gap-3">
                        <ProductImage imageUrl={product.imageUrl} name={product.name} />
                        <span className="break-words line-clamp-2" title={product.name}>{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <div>{product.sku}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">{product.barcode || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-sm bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-sm bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700">
                        {product.brand || "Unbranded"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${product.stock <= (product.lowInventoryThreshold || 10) ? "text-amber-600" : "text-slate-900"}`}>
                        {product.stock}
                      </span>
                      {product.unitType && <span className="ml-1 text-xs text-slate-400">{product.unitType}</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 min-w-[150px]">
                        <Input
                          type="number"
                          min="1"
                          value={stockAdditions[product.id] || ""}
                          onChange={(e) => setStockAdditions((prev) => ({ ...prev, [product.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
                            if (e.key === "Enter") void handleInlineAddStock(product);
                          }}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          className="h-8 w-20 text-xs"
                          placeholder="Qty"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          onClick={() => void handleInlineAddStock(product)}
                          disabled={!stockAdditions[product.id] || Number(stockAdditions[product.id]) <= 0}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">Rs. {product.price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditFlow(product)}
                        className="text-slate-400 hover:text-indigo-600 mr-3 transition-colors"
                        aria-label={`Edit ${product.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => void handleDelete(product)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          {validationError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-md font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {validationError}
            </div>
          )}
          {lookupError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-md font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {lookupError}
            </div>
          )}

          {flowStep === "lookup" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  ref={lookupInputRef}
                  placeholder="Search product name or scan barcode"
                  className="pl-9 pr-32"
                  value={lookupQuery}
                  onChange={(e) => {
                    setLookupQuery(e.target.value);
                    setValidationError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const value = lookupQuery.trim();
                    if (/^\d{5,}$/.test(value)) {
                      void lookupBarcode(value);
                    } else if (suggestions.length === 1) {
                      openStockFlow(suggestions[0]);
                    } else if (value.length >= 3 && suggestions.length === 0 && !isLookupLoading) {
                      openNotFound(value);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 text-xs"
                  onClick={() => {
                    const value = lookupQuery.trim();
                    if (/^\d{5,}$/.test(value)) void lookupBarcode(value);
                  }}
                  disabled={!/^\d{5,}$/.test(lookupQuery.trim()) || isLookupLoading}
                >
                  <PackageSearch className="w-3.5 h-3.5 mr-1" />
                  Scan
                </Button>
              </div>

              {isLookupLoading && (
                <div className="rounded-md border border-slate-200 px-3 py-3 text-sm text-slate-500">
                  Searching inventory and product databases...
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                  {suggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.source}-${suggestion.id || suggestion.barcode || suggestion.name}`}
                      type="button"
                      className="w-full px-3 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-b-0"
                      onClick={() => openStockFlow(suggestion)}
                    >
                      <ProductImage imageUrl={suggestion.imageUrl} name={suggestion.name || "Product"} className="w-10 h-10" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-800 truncate">{suggestion.name}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {suggestion.brand || "Unbranded"} | {suggestion.category || humanProductType(suggestion.productType)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{suggestion.barcode || "No barcode"}</div>
                      </div>
                      <span className={cn(
                        "shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase",
                        suggestion.source === "supabase" ? "bg-emerald-50 text-emerald-700"
                          : suggestion.source === "web_search" ? "bg-amber-50 text-amber-700"
                          : "bg-sky-50 text-sky-700",
                      )}>
                        {getSourceLabel(suggestion.source)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {flowStep === "not_found" && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start gap-2 text-rose-700">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">Product Not Available</p>
                  <p className="text-xs text-rose-700/80 mt-1">
                    {notFoundValue ? `"${notFoundValue}" was not found in inventory or Open Food Facts.` : "No matching product was found."}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => resetToLookup("")} className="text-xs">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Retry Scan
                </Button>
                <Button size="sm" variant="ghost" onClick={() => resetToLookup(notFoundValue)} className="text-xs">
                  <Search className="w-3.5 h-3.5 mr-1" />
                  Search Manually
                </Button>
                <Button size="sm" onClick={openCustomFlow} className="text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Create Custom Product
                </Button>
              </div>
            </div>
          )}

          {flowStep === "stock" && (
            <div className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-2 shrink-0">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center relative group cursor-pointer">
                      {formData.imageUrl ? (
                        <img src={formData.imageUrl} alt="Product" className="w-full h-full object-cover" />
                      ) : (
                        <Tag className="w-6 h-6 text-slate-400" />
                      )}
                      <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <span className="text-[9px] font-bold text-white uppercase text-center leading-tight px-1">Upload<br/>Image</span>
                        <input type="file" onChange={handleProductImageChange} accept="image/*" className="hidden" />
                      </label>
                    </div>
                    {formData.imageUrl && (
                      <button type="button" onClick={handleRemoveProductImage} className="text-[10px] text-red-600 hover:underline text-center">Remove</button>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 truncate">{formData.name}</p>
                      <span className={cn(
                        "rounded px-2 py-1 text-[10px] font-bold uppercase",
                        formData.source === "supabase" ? "bg-emerald-100 text-emerald-700"
                          : formData.source === "web_search" ? "bg-amber-100 text-amber-700"
                          : "bg-sky-100 text-sky-700",
                      )}>
                        {sourceLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{formData.brand || "Unbranded"} | {formData.category}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">{formData.barcode || "No barcode"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product Name</label>
                    <Input value={formData.name} disabled={!!selectedProduct} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={selectedProduct ? "bg-white text-slate-600 cursor-not-allowed" : "bg-white"} placeholder="Product Name" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Brand</label>
                    <Input value={formData.brand} disabled={!!selectedProduct} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className={selectedProduct ? "bg-white text-slate-600 cursor-not-allowed" : "bg-white"} placeholder="Brand" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</label>
                    <Input value={formData.category} disabled={!!selectedProduct} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className={selectedProduct ? "bg-white text-slate-600 cursor-not-allowed" : "bg-white"} placeholder="Category" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Barcode</label>
                    <Input value={formData.barcode || ""} disabled={!!selectedProduct} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} className={selectedProduct ? "bg-white text-slate-600 cursor-not-allowed" : "bg-white"} placeholder="Barcode" />
                  </div>
                </div>
                {formData.source === "web_search" && !selectedProduct && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 mt-2 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Unverified Result</p>
                      <p className="mt-0.5 text-amber-700">This product info was found via web search and may not be accurate. Please verify and correct the name, brand, and category before saving.</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
                  Current stock: <span className="font-bold">{selectedProduct.stock}</span>. New quantity will be added to this inventory item.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Quantity</label>
                  <Input
                    type="number"
                    value={formData.stock || ""}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Unit Type</label>
                  <select
                    value={formData.unitType}
                    onChange={(e) => setFormData({ ...formData, unitType: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  >
                    {unitTypes.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Selling Price</label>
                  <Input
                    type="number"
                    value={formData.price || ""}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Purchase Price Optional</label>
                  <Input
                    type="number"
                    value={formData.purchasePrice || ""}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                    onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Low Stock Alert</label>
                  <Input
                    type="number"
                    value={formData.lowInventoryThreshold || ""}
                    onChange={(e) => setFormData({ ...formData, lowInventoryThreshold: parseInt(e.target.value) || 0 })}
                    onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  />
                </div>
              </div>
            </div>
          )}

          {flowStep === "custom" && (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                Custom products are only for items that were not found by scan/search.
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Product Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Product" className="w-full h-full object-cover" />
                    ) : (
                      <Tag className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex gap-2">
                      <Input type="file" onChange={handleProductImageChange} accept="image/*" className="text-xs" disabled={!!(formData.imageUrl && !formData.publicId)} />
                      {formData.imageUrl && (
                        <Button type="button" variant="ghost" size="sm" onClick={handleRemoveProductImage} className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                          Remove
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="Or enter Image URL"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value, publicId: "" })}
                      className="text-xs"
                      disabled={!!formData.publicId}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Product Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value, productType: classifyProduct(`${e.target.value} ${formData.category} ${formData.brand}`) })}
                  placeholder="e.g. Rice"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value, productType: classifyProduct(`${formData.name} ${e.target.value} ${formData.brand}`) })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  >
                    {categoryOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Brand Optional</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value, productType: classifyProduct(`${formData.name} ${formData.category} ${e.target.value}`) })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  >
                    {brandOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Unit Type</label>
                  <select
                    value={formData.unitType}
                    onChange={(e) => setFormData({ ...formData, unitType: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  >
                    {unitTypes.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Barcode Optional</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Optional barcode"
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
          {flowStep === "lookup" && (
            <Button
              onClick={() => {
                const value = lookupQuery.trim();
                if (/^\d{5,}$/.test(value)) {
                  void lookupBarcode(value);
                } else if (value.length >= 3 && suggestions.length === 0 && !isLookupLoading) {
                  openNotFound(value);
                }
              }}
              disabled={!lookupQuery.trim() || isLookupLoading}
            >
              Lookup
            </Button>
          )}
          {flowStep === "stock" && <Button onClick={handleSaveStock}>Save Inventory</Button>}
          {flowStep === "custom" && <Button onClick={handleCreateCustomProduct}>Create Custom Product</Button>}
        </DialogFooter>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl bg-white border-none shadow-2xl p-0 overflow-hidden sm:rounded-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-indigo-600" />
              Edit Product
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
            {validationError && (
              <div className="mb-6 rounded-md bg-rose-50 p-4 border border-rose-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-rose-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-rose-800">Validation Error</h3>
                    <div className="mt-2 text-sm text-rose-700">{validationError}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Product Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Product" className="w-full h-full object-cover" />
                    ) : (
                      <Tag className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex gap-2">
                      <Input type="file" onChange={handleProductImageChange} accept="image/*" className="text-xs" disabled={!!(formData.imageUrl && !formData.publicId)} />
                      {formData.imageUrl && (
                        <Button type="button" variant="ghost" size="sm" onClick={handleRemoveProductImage} className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                          Remove
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="Or enter Image URL"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value, publicId: "" })}
                      className="text-xs"
                      disabled={!!formData.publicId}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Product Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rice"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  >
                    {categoryOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Brand Optional</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  >
                    {brandOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Unit Type</label>
                  <select
                    value={formData.unitType}
                    onChange={(e) => setFormData({ ...formData, unitType: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  >
                    {unitTypes.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Barcode Optional</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Optional barcode"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Current Stock</label>
                  <Input
                    type="number"
                    value={formData.stock || ""}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Selling Price</label>
                  <Input
                    type="number"
                    value={formData.price || ""}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Purchase Price Optional</label>
                  <Input
                    type="number"
                    value={formData.purchasePrice || ""}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                    onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Low Stock Alert</label>
                  <Input
                    type="number"
                    value={formData.lowInventoryThreshold || ""}
                    onChange={(e) => setFormData({ ...formData, lowInventoryThreshold: parseInt(e.target.value) || 0 })}
                    onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateProduct}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Inventory;
