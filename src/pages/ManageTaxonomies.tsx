import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card";
import { Plus, Trash2, Tag, Bookmark, ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";

export default function ManageTaxonomies() {
  const { t } = useTranslation();
  const {
    categories, fetchCategories, addCategory, deleteCategory,
    brands, fetchBrands, addBrand, deleteBrand,
    products, fetchProducts
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<"categories" | "brands">("categories");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchBrands();
    fetchProducts();
  }, [fetchCategories, fetchBrands, fetchProducts]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const name = newName.trim();
    if (!name) {
      setError(`${activeTab === "categories" ? "Category" : "Brand"} name cannot be empty`);
      return;
    }

    const list = activeTab === "categories" ? categories : brands;
    if (list.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
      setError(`${activeTab === "categories" ? "Category" : "Brand"} already exists`);
      return;
    }

    try {
      setIsAdding(true);
      if (activeTab === "categories") {
        await addCategory({ name });
        setSuccess(`Category "${name}" added successfully!`);
      } else {
        await addBrand({ name });
        setSuccess(`Brand "${name}" added successfully!`);
      }
      setNewName("");
    } catch (err: any) {
      setError(err.message || `Failed to add ${activeTab === "categories" ? "category" : "brand"}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const isCategory = activeTab === "categories";
    const typeName = isCategory ? "category" : "brand";

    const isUsing = isCategory
      ? products.some(p => p.category?.toLowerCase() === name.toLowerCase())
      : products.some(p => p.brand?.toLowerCase() === name.toLowerCase());

    const confirmMsg = isUsing
      ? `Warning: ${isCategory ? 'Category' : 'Brand'} "${name}" is currently used by some products in your inventory. Are you sure you want to delete it anyway?`
      : `Are you sure you want to delete the ${typeName} "${name}"?`;

    if (confirm(confirmMsg)) {
      try {
        if (isCategory) {
          await deleteCategory(id);
        } else {
          await deleteBrand(id);
        }
        setSuccess(`${isCategory ? 'Category' : 'Brand'} deleted successfully.`);
      } catch (err: any) {
        setError(err.message || `Failed to delete ${typeName}.`);
      }
    }
  };

  const activeList = activeTab === "categories" ? categories : brands;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/inventory">
            <Button variant="outline" size="sm" className="p-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            Manage Inventory
          </h2>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => { setActiveTab("categories"); setError(null); setSuccess(null); setNewName(""); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all",
              activeTab === "categories" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Tag className="w-4 h-4" /> Categories
          </button>
          <button
            onClick={() => { setActiveTab("brands"); setError(null); setSuccess(null); setNewName(""); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all",
              activeTab === "brands" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Bookmark className="w-4 h-4" /> Brands
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Form */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Add New {activeTab === "categories" ? "Category" : "Brand"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  {activeTab === "categories" ? "Category" : "Brand"} Name
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={activeTab === "categories" ? "e.g. Beverages, Dairy" : "e.g. Nestle, Unilever"}
                  className="w-full"
                />
              </div>

              {error && <div className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{error}</div>}
              {success && <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 p-2 rounded">{success}</div>}

              <Button type="submit" className="w-full" disabled={isAdding}>
                <Plus className="w-4 h-4 mr-2" />
                {isAdding ? "Adding..." : `Add ${activeTab === "categories" ? "Category" : "Brand"}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Existing {activeTab === "categories" ? "Categories" : "Brands"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-600">Name</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-center">Linked Products</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence>
                    {activeList.map((item) => {
                      const linkedProductCount = products.filter((p) => {
                        if (activeTab === "categories") return p.category?.toLowerCase() === item.name.toLowerCase();
                        return p.brand?.toLowerCase() === item.name.toLowerCase();
                      }).length;

                      return (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-semibold text-slate-900">
                            {item.name}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${linkedProductCount > 0 ? "bg-indigo-50 text-indigo-700 font-bold" : "bg-slate-100 text-slate-500"
                              }`}>
                              {linkedProductCount} {linkedProductCount === 1 ? "product" : "products"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDelete(item.id, item.name)}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                              title={`Delete ${activeTab === "categories" ? "Category" : "Brand"}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  {activeList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                        No {activeTab === "categories" ? "categories" : "brands"} found. Add one on the left.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
