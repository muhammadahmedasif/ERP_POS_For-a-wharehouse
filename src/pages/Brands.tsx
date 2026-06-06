import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/card";
import { Plus, Trash2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Brands() {
  const { t } = useTranslation();
  const { brands, fetchBrands, addBrand, deleteBrand, products, fetchProducts } = useAppStore();
  const [newBrandName, setNewBrandName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchBrands();
    fetchProducts();
  }, [fetchBrands, fetchProducts]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const name = newBrandName.trim();
    if (!name) {
      setError("Brand name cannot be empty");
      return;
    }

    if (brands.some((brand) => brand.name.trim().toLowerCase() === name.toLowerCase())) {
      setError("Brand already exists");
      return;
    }

    try {
      setIsAdding(true);
      await addBrand({ name });
      setSuccess(`Brand "${name}" added successfully!`);
      setNewBrandName("");
    } catch (err: any) {
      setError(err.message || "Failed to add brand");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const isUsing = products.some(p => p.brand && p.brand.toLowerCase() === name.toLowerCase());
    const confirmMsg = isUsing
      ? `Warning: Brand "${name}" is currently used by some products in your inventory. Are you sure you want to delete it anyway?`
      : `Are you sure you want to delete the brand "${name}"?`;

    if (confirm(confirmMsg)) {
      try {
        await deleteBrand(id);
        setSuccess("Brand deleted successfully.");
      } catch (err: any) {
        setError(err.message || "Failed to delete brand.");
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
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Manage Brands
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Brand Form */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">Add New Brand</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Brand Name</label>
                <Input
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. National, Nestle"
                  className="w-full"
                />
              </div>

              {error && <div className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{error}</div>}
              {success && <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 p-2 rounded">{success}</div>}

              <Button type="submit" className="w-full" disabled={isAdding}>
                <Plus className="w-4 h-4 mr-2" />
                {isAdding ? "Adding..." : "Add Brand"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Brands List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">Existing Brands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-600">Brand Name</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-center">Linked Products</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {brands.map((brand) => {
                    const linkedProductCount = products.filter(
                      (p) => p.brand && p.brand.toLowerCase() === brand.name.toLowerCase()
                    ).length;

                    return (
                      <tr key={brand.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {brand.name}
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
                            onClick={() => handleDelete(brand.id, brand.name)}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                            title="Delete Brand"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {brands.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                        No brands found. Add one on the left.
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
