import React, { useEffect, useState, useRef } from "react";
import imageCompression from 'browser-image-compression';
import { ProductImage } from "../components/ProductImage";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Product } from "../types";
import { Search, Plus, Edit2, Trash2, Tag, Bookmark } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { cn } from "../lib/utils";

import { useAppStore } from "../store";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";

const Inventory = () => {
  const { t } = useTranslation();
  const { 
    products, 
    fetchProducts, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    adjustStock,
    categories,
    fetchCategories,
    brands,
    fetchBrands,
    settings
  } = useAppStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    name: '', sku: '', category: '', brand: '', stock: 0, price: 0, barcode: '', imageUrl: '', publicId: '', lowInventoryThreshold: 10
  });

  const normalizeProductKey = (value?: string) => (value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizeBarcodeKey = (value?: string) => (value || '').trim().toLowerCase();
  const normalizeBrandKey = (value?: string) => {
    const normalized = normalizeProductKey(value);
    return !normalized || normalized === 'unbranded' || normalized === 'unbranded / generic' || normalized === 'generic'
      ? 'unbranded / generic'
      : normalized;
  };

  const isDuplicateProduct = (candidate: Partial<Product>) => {
    const candidateName = normalizeProductKey(candidate.name);
    const candidateCategory = normalizeProductKey(candidate.category);
    const candidateBrand = normalizeBrandKey(candidate.brand);

    if (!candidateName) return false;

    return products.some(product => {
      if (editingProduct && product.id === editingProduct.id) return false;
      return normalizeProductKey(product.name) === candidateName
        && normalizeProductKey(product.category) === candidateCategory
        && normalizeBrandKey(product.brand) === candidateBrand;
    });
  };
  
  const barcodeScanHandler = useRef<(barcode: string) => void>(() => {});
  barcodeScanHandler.current = (barcode: string) => {
    const cleanBarcode = barcode.trim();
    if (isDialogOpen) {
      setFormData((prev) => ({ ...prev, barcode: cleanBarcode }));
    } else {
      const scannedKey = normalizeBarcodeKey(cleanBarcode);
      const product = products.find((p) =>
        normalizeBarcodeKey(p.barcode) === scannedKey
        || normalizeBarcodeKey(p.sku) === scannedKey
        || normalizeBarcodeKey(p.id) === scannedKey
      );
      if (product) {
        setSearchTerm(cleanBarcode);
        setHighlightedProductId(product.id);
        setTimeout(() => {
          setHighlightedProductId(null);
        }, 2000);
      }
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

  const handleOpenDialog = (product?: Product) => {
    setValidationError(null);
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        category: product.category,
        brand: product.brand || (brands.length > 0 ? brands[0].name : 'Unbranded / Generic'),
        stock: product.stock,
        price: product.price,
        barcode: product.barcode || '',
        imageUrl: product.imageUrl || '',
        publicId: product.publicId || '',
        lowInventoryThreshold: product.lowInventoryThreshold || settings.defaultLowInventoryThreshold
      });
    } else {
      setEditingProduct(null);
      // Auto-generate Product ID (SKU)
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const generatedSku = `PR-ID-${randomNum}`;
      
      setFormData({
        name: '',
        sku: generatedSku,
        category: categories.length > 0 ? categories[0].name : '',
        brand: brands.length > 0 ? brands[0].name : '',
        stock: 0,
        price: 0,
        barcode: '',
        imageUrl: '',
        publicId: '',
        lowInventoryThreshold: settings.defaultLowInventoryThreshold
      });
    }
    setIsDialogOpen(true);
  };

  const handleProductImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 300, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const dataUrl = reader.result as string;
            const res = await fetch('/api/upload-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dataUrl })
            });
            const result = await res.json();
            if (!res.ok) {
              throw new Error(result.error || 'Failed to upload product image.');
            }
            setFormData(prev => ({ ...prev, imageUrl: result.url, publicId: result.public_id }));
            setValidationError(null);
          } catch (error: any) {
            setValidationError(error.message || 'Failed to upload product image.');
          }
        };
        reader.readAsDataURL(compressedFile);
      } catch (error: any) {
        setValidationError(error.message || 'Failed to compress product image.');
      }
    }
  };

  const handleRemoveProductImage = async () => {
    if (formData.publicId) {
      await fetch('/api/delete-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_id: formData.publicId })
      });
    }
    setFormData(prev => ({ ...prev, imageUrl: '', publicId: '' }));
  };

  const handleSave = async () => {
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setValidationError("Product Name is required and cannot be empty!");
      return;
    }
    if (formData.price <= 0) {
      setValidationError("Price must be a valid wholesale price greater than Rs. 0!");
      return;
    }
    if (formData.stock < 0) {
      setValidationError("Wholesale stock cannot be set to a negative value!");
      return;
    }

    setValidationError(null);
    try {
        const candidate = { ...formData, name: trimmedName };
        if (isDuplicateProduct(candidate)) {
        setValidationError("Already existing product with the same name, category, and brand.");
        return;
        }
        if (editingProduct) {
        await updateProduct(editingProduct.id, candidate);
        } else {
        await addProduct(candidate);
        }
        setIsDialogOpen(false);
    } catch (error: any) {
        setValidationError(error.message || "An unexpected error occurred.");
    }
  };

  const handleDelete = async (product: Product) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        if (product.publicId) {
          await fetch('/api/delete-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ public_id: product.publicId })
          });
        }
        await deleteProduct(product.id);
      } catch (err: any) {
        alert(err.message || "Failed to delete product.");
      }
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-slate-800">{t("inventory")}</h2>
          <span className="text-xs text-slate-400 font-medium">|</span>
          <Link to="/categories">
            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold flex items-center gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              <Tag className="w-3.5 h-3.5" />
              Manage Categories
            </Button>
          </Link>
          <Link to="/brands">
            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold flex items-center gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50">
              <Bookmark className="w-3.5 h-3.5" />
              Manage Brands
            </Button>
          </Link>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          {t("add_product")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t("search_placeholder")}
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">{t("name")}</th>
                  <th className="px-6 py-3 font-medium">Product ID (SKU) & Barcode</th>
                  <th className="px-6 py-3 font-medium">{t("category")}</th>
                  <th className="px-6 py-3 font-medium">Brand</th>
                  <th className="px-6 py-3 font-medium">{t("stock")}</th>
                  <th className="px-6 py-3 font-medium">{t("price")}</th>
                  <th className="px-6 py-3 font-medium text-right">
                    {t("actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((product) => (
                  <tr
                    key={product.id}
                    className={cn(
                      "transition-colors duration-500",
                      highlightedProductId === product.id 
                        ? "bg-indigo-100" 
                        : "hover:bg-slate-50"
                    )}
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                      <ProductImage imageUrl={product.imageUrl} name={product.name} />
                      {product.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <div>{product.sku}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">{product.barcode || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-sm bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-sm bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700">
                        {product.brand || 'Unbranded'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => adjustStock(product.id, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                        >
                          -
                        </button>
                        <div
                          className={`font-bold w-8 text-center ${product.stock <= (product.lowInventoryThreshold || 10) ? "text-amber-600" : "text-slate-900"}`}
                        >
                          {product.stock}
                        </div>
                        <button
                          onClick={() => adjustStock(product.id, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      Rs. {product.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleOpenDialog(product)} className="text-slate-400 hover:text-indigo-600 mr-3 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(product)} className="text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          {validationError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-lg font-bold flex items-center gap-1.5 shadow-xs">
              <span className="text-sm font-bold">⚠️</span> {validationError}
            </div>
          )}
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
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveProductImage} className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50">Remove</Button>
                  )}
                </div>
                <Input
                  placeholder="Or enter Image URL"
                  value={formData.imageUrl}
                  onChange={e => setFormData({...formData, imageUrl: e.target.value, publicId: ''})}
                  className="text-xs"
                  disabled={!!formData.publicId}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Product Name</label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Ketchup" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                <Link to="/categories" className="text-xs text-indigo-600 hover:underline font-semibold leading-none">
                  Manage Categories
                </Link>
              </div>
              <select
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase">Brand</label>
                <Link to="/brands" className="text-xs text-purple-600 hover:underline font-semibold leading-none">
                  Manage Brands
                </Link>
              </div>
              <select
                value={formData.brand}
                onChange={e => setFormData({...formData, brand: e.target.value})}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Product ID (SKU)</label>
              <Input 
                value={formData.sku} 
                disabled 
                readOnly 
                className="bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed select-none pointer-events-none font-semibold grayscale opacity-75" 
                placeholder="Auto-generated Product ID" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Barcode</label>
              <Input
                id="barcode-input"
                name="barcode"
                type="text"
                inputMode="numeric"
                value={formData.barcode}
                onChange={e => setFormData({...formData, barcode: e.target.value})}
                placeholder="Scan or enter manually"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Price (Rs.)</label>
              <Input
                type="number"
                value={formData.price || ''}
                onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Initial Stock (Units)</label>
              <Input
                type="number"
                value={formData.stock || ''}
                onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Low Inventory Alert At:</label>
              <Input
                type="number"
                value={formData.lowInventoryThreshold || ''}
                onChange={e => setFormData({...formData, lowInventoryThreshold: parseInt(e.target.value) || 0})}
                placeholder="e.g., 10"
                onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Product</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};

export default Inventory;
