import React, { useEffect, useState } from "react";

import { useAppStore } from "../store";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card";
import { Plus, Trash2, Tag, Bookmark } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function ManageTaxonomies() {

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

    const description = isUsing
      ? `"${name}" is used by some products. Products will lose this ${typeName}.`
      : `This cannot be undone.`;

    toast(`Delete ${typeName} "${name}"?`, {
      description,
      action: {
        label: 'Yes, Delete',
        onClick: async () => {
          try {
            if (isCategory) { await deleteCategory(id); }
            else { await deleteBrand(id); }
            setSuccess(`${isCategory ? 'Category' : 'Brand'} deleted successfully.`);
            toast.success(`${isCategory ? 'Category' : 'Brand'} "${name}" deleted.`);
          } catch (err: any) {
            setError(err.message || `Failed to delete ${typeName}.`);
            toast.error(err.message || `Failed to delete ${typeName}.`);
          }
        }
      },
      cancel: { label: 'Cancel', onClick: () => {} },
      duration: 10000,
    });
  };

  const activeList = activeTab === "categories" ? categories : brands;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs text-neutral-400">Manage product taxonomies.</p>
        <div className="flex bg-neutral-100 p-0.5 rounded-lg">
          <button onClick={() => { setActiveTab("categories"); setError(null); setSuccess(null); setNewName(""); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "categories" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}>
            <Tag className="w-3.5 h-3.5" /> Categories
          </button>
          <button onClick={() => { setActiveTab("brands"); setError(null); setSuccess(null); setNewName(""); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "brands" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}>
            <Bookmark className="w-3.5 h-3.5" /> Brands
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Add New {activeTab === "categories" ? "Category" : "Brand"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500">{activeTab === "categories" ? "Category" : "Brand"} Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder={activeTab === "categories" ? "e.g. Beverages, Dairy" : "e.g. Nestle, Unilever"} />
              </div>

              {error && <div className="text-xs font-medium text-rose-600 bg-rose-50 p-2 rounded">{error}</div>}
              {success && <div className="text-xs font-medium text-emerald-600 bg-emerald-50 p-2 rounded">{success}</div>}

              <Button type="submit" className="w-full" disabled={isAdding}>
                <Plus className="w-4 h-4 mr-1.5" />
                {isAdding ? "Adding..." : `Add ${activeTab === "categories" ? "Category" : "Brand"}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Existing {activeTab === "categories" ? "Categories" : "Brands"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 text-neutral-500">
                  <tr>
                    <th className="px-6 py-3 font-medium text-neutral-600">Name</th>
                    <th className="px-6 py-3 font-medium text-neutral-600 text-center">Linked Products</th>
                    <th className="px-6 py-3 font-medium text-neutral-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <AnimatePresence>
                    {activeList.map((item) => {
                      const linkedProductCount = products.filter((p) => {
                        if (activeTab === "categories") return p.category?.toLowerCase() === item.name.toLowerCase();
                        return p.brand?.toLowerCase() === item.name.toLowerCase();
                      }).length;

                      return (
                        <motion.tr key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-neutral-900">{item.name}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${linkedProductCount > 0 ? "bg-primary-50 text-primary-700" : "bg-neutral-100 text-neutral-500"}`}>
                              {linkedProductCount} {linkedProductCount === 1 ? "product" : "products"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDelete(item.id, item.name)}
                              className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                              title={`Delete ${activeTab === "categories" ? "Category" : "Brand"}`}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  {activeList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-neutral-400">
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
