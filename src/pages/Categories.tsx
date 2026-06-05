import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card";
import { Plus, Trash2, Tag, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Categories() {
  const { t } = useTranslation();
  const { categories, fetchCategories, addCategory, deleteCategory, products, fetchProducts } = useAppStore();
  const [newCatName, setNewCatName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [fetchCategories, fetchProducts]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const name = newCatName.trim();
    if (!name) {
      setError("Category name cannot be empty");
      return;
    }

    try {
      await addCategory({ name });
      setSuccess(`Category "${name}" added successfully!`);
      setNewCatName("");
    } catch (err: any) {
      setError(err.message || "Failed to add category");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const isUsing = products.some(p => p.category?.toLowerCase() === name.toLowerCase());
    const confirmMsg = isUsing
      ? `Warning: Category "${name}" is currently used by some products in your inventory. Are you sure you want to delete it anyway?`
      : `Are you sure you want to delete the category "${name}"?`;

    if (confirm(confirmMsg)) {
      try {
        await deleteCategory(id);
        setSuccess("Category deleted successfully.");
      } catch (err: any) {
        setError(err.message || "Failed to delete category.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/inventory">
            <Button variant="outline" size="sm" className="p-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            Manage Categories
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Category Form */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">Add New Category</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Category Name</label>
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Beverages, Dairy"
                  className="w-full"
                />
              </div>

              {error && <div className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{error}</div>}
              {success && <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 p-2 rounded">{success}</div>}

              <Button type="submit" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Categories List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">Existing Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-600">Category Name</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-center">Linked Products</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat) => {
                    const linkedProductCount = products.filter(
                      (p) => p.category?.toLowerCase() === cat.name.toLowerCase()
                    ).length;

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {cat.name}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            linkedProductCount > 0 ? "bg-indigo-50 text-indigo-700 font-bold" : "bg-slate-100 text-slate-500"
                          }`}>
                            {linkedProductCount} {linkedProductCount === 1 ? "product" : "products"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDelete(cat.id, cat.name)}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                            title="Delete Category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                        No categories found. Add one on the left.
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
