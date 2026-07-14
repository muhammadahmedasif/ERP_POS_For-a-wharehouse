import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ProductImage } from '../components/ProductImage';
import { Search, RotateCcw, Plus, CheckCircle, FileText, User, PackageSearch, Minus } from 'lucide-react';
import { Product, Sale } from '../types';
import { toast } from 'sonner';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

const formatReturnDate = (dateString: string) => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return dateString;
  }
};

export default function Returns() {
  const { products, fetchProducts, customers, fetchCustomers } = useAppStore();
  const [sales, setSales] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewReturnOpen, setIsNewReturnOpen] = useState(false);
  const [returnSaleId, setReturnSaleId] = useState('');
  const [returnItems, setReturnItems] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchSales();
    if (products.length === 0) fetchProducts();
    if (customers.length === 0) fetchCustomers();
  }, []);

  const fetchSales = () => {
    fetch('/api/sales').then(r => r.json()).then(data => setSales(Array.isArray(data) ? data : []));
  };

  const returnedSales = useMemo(() =>
    sales.filter(s => s.returnAmount && s.returnAmount > 0),
    [sales]
  );

  const filteredReturns = useMemo(() => {
    if (!searchTerm) return returnedSales;
    const q = searchTerm.toLowerCase();
    return returnedSales.filter(s => {
      const matchesId = s.id?.toLowerCase().includes(q);
      const cust = s.customerId ? customers.find(c => c.id === s.customerId) : null;
      const matchesCustomer = cust?.name?.toLowerCase().includes(q);
      return matchesId || matchesCustomer;
    });
  }, [returnedSales, searchTerm, customers]);

  const saleSearchResults = useMemo(() => {
    if (!returnSaleId || returnSaleId.length < 2) return [];
    const q = returnSaleId.toLowerCase();
    return sales.filter(s => {
      const matchesId = s.id?.toLowerCase().includes(q);
      const cust = s.customerId ? customers.find(c => c.id === s.customerId) : null;
      const matchesCustomer = cust?.name?.toLowerCase().includes(q);
      return matchesId || matchesCustomer;
    }).slice(0, 8);
  }, [returnSaleId, sales, customers]);

  const selectedSale = useMemo(() => {
    if (!returnSaleId) return null;
    return sales.find(s => s.id === returnSaleId) || null;
  }, [returnSaleId, sales]);

  const openNewReturn = (sale?: any) => {
    setIsNewReturnOpen(true);
    if (sale) {
      setReturnSaleId(sale.id);
    } else {
      setReturnSaleId('');
    }
    setReturnItems({});
  };

  const selectSaleForReturn = (sale: any) => {
    setReturnSaleId(sale.id);
    const initial: Record<string, number> = {};
    sale.items?.forEach((item: any) => { initial[item.productId] = 0; });
    setReturnItems(initial);
  };

  const getAvailableQty = (sale: any, productId: string) => {
    const original = sale.items?.find((i: any) => i.productId === productId);
    if (!original) return 0;
    const alreadyReturned = sale.returnedItems?.find((r: any) => r.productId === productId)?.quantity || 0;
    return original.quantity - alreadyReturned;
  };

  const getReturnTotal = () => {
    if (!selectedSale) return 0;
    return Object.entries(returnItems).reduce((sum, [productId, qty]: [string, number]) => {
      if (qty <= 0) return sum;
      const item = selectedSale.items?.find((i: any) => i.productId === productId);
      return sum + ((item?.price || 0) * qty);
    }, 0);
  };

  const getReturnItemCount = () => {
    return Object.values(returnItems).filter((q: number) => q > 0).length;
  };

  const handleReturn = async () => {
    if (!selectedSale) return;
    const itemsToReturn = (Object.entries(returnItems) as [string, number][])
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => {
        const item = selectedSale.items.find((i: any) => i.productId === productId);
        return { productId, name: item.name, quantity, price: item.price };
      });

    if (itemsToReturn.length === 0) {
      toast.error('Select at least one item to return.');
      return;
    }

    setIsSubmitting(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`/api/sales/${selectedSale.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToReturn }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Return failed');

      toast.success(`Returned ${getReturnItemCount()} item(s). Rs. ${getReturnTotal().toLocaleString()} refunded.`);
      setIsNewReturnOpen(false);
      setReturnSaleId('');
      setReturnItems({});
      fetchSales();
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process return');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalReturnedVolume = returnedSales.reduce((sum, s) => sum + (s.returnAmount || 0), 0);
  const overallTotalVolume = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const overallReturnCount = returnedSales.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs text-neutral-400">View and process product returns from sales.</p>
        <Button onClick={() => openNewReturn()}>
          <RotateCcw className="w-4 h-4 mr-1.5" />
          New Return
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-neutral-50 border border-border rounded-lg p-3 text-sm">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary-600" />
          <span className="text-neutral-400">Total Returns:</span>
          <span className="font-semibold text-neutral-900">{overallReturnCount}</span>
        </div>
        <div className="w-px h-4 bg-border hidden sm:block" />
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-rose-500" />
          <span className="text-neutral-400">Returned Amount:</span>
          <span className="font-semibold text-rose-600">Rs. {totalReturnedVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="w-px h-4 bg-border hidden sm:block" />
        <div className="flex items-center gap-2">
          <PackageSearch className="w-4 h-4 text-emerald-500" />
          <span className="text-neutral-400">Net Sales:</span>
          <span className="font-semibold text-emerald-600">Rs. {overallTotalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              placeholder="Search by Bill ID or Customer Name..."
              className="pl-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-2">
            {filteredReturns.map((sale) => {
              const client = sale.customerId ? customers.find(c => c.id === sale.customerId) : null;
              const returnDate = sale.returnDate ? formatReturnDate(sale.returnDate) : '';

              return (
                <div key={sale.id} className="bg-white rounded-xl p-4 border border-border transition-all hover:shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", client ? "bg-amber-50 text-amber-600" : "bg-neutral-100 text-neutral-500")}>
                      {client ? <User className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-neutral-900 text-sm truncate">{sale.id}</h3>
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">RETURNED</span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {client ? client.name : 'Walk-in Customer'} {returnDate && `• ${returnDate}`}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {sale.returnedItems && sale.returnedItems.length > 0 ? (
                          sale.returnedItems.map((ri: any, idx: number) => (
                            <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              {ri.quantity}x {ri.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-neutral-400">Items returned</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-neutral-400">Refunded</p>
                      <p className="font-semibold text-lg text-rose-600">Rs. {(sale.returnAmount || 0).toFixed(2)}</p>
                      <p className="text-[10px] text-neutral-400">Net: Rs. {(sale.total || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredReturns.length === 0 && (
              <div className="text-center py-12 text-neutral-400">
                <RotateCcw className="w-10 h-10 mx-auto mb-3 text-neutral-200" />
                <p className="text-sm font-medium">No returns recorded yet</p>
                <p className="text-xs mt-1">Click "New Return" to process a return.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isNewReturnOpen} onOpenChange={setIsNewReturnOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Process Return
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4 max-h-[75vh] overflow-y-auto">
          {!selectedSale ? (
            <div className="space-y-3">
              <p className="text-sm text-neutral-500">Search for a sale to return items from.</p>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                <Input
                  placeholder="Search by Bill ID or Customer Name..."
                  className="pl-9"
                  value={returnSaleId}
                  onChange={e => { setReturnSaleId(e.target.value); setReturnItems({}); }}
                />
              </div>
              {saleSearchResults.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  {saleSearchResults.map((s) => {
                    const cust = s.customerId ? customers.find(c => c.id === s.customerId) : null;
                    const hasReturned = s.returnAmount && s.returnAmount > 0;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full px-4 py-3 text-left hover:bg-neutral-50 border-b border-border last:border-b-0 transition-colors"
                        onClick={() => selectSaleForReturn(s)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm text-neutral-900">{s.id}</div>
                            <div className="text-xs text-neutral-400">{cust ? cust.name : 'Walk-in'} • Rs. {(s.total || 0).toFixed(2)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-neutral-400">{s.items?.length || 0} items</div>
                            {hasReturned && (
                              <div className="text-[10px] text-amber-600 font-medium">Partial return done</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {returnSaleId.length >= 2 && saleSearchResults.length === 0 && (
                <p className="text-sm text-neutral-400 text-center py-4">No sales found matching "{returnSaleId}"</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-neutral-50 rounded-lg p-3 border border-border">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{selectedSale.id}</p>
                  <p className="text-xs text-neutral-400">
                    {selectedSale.customerId ? customers.find(c => c.id === selectedSale.customerId)?.name || 'Customer' : 'Walk-in'} • Original: Rs. {(selectedSale.total || 0).toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setReturnSaleId(''); setReturnItems({}); }}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                >
                  Change Sale
                </button>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Select Items to Return</p>
                <button
                  type="button"
                  onClick={() => {
                    const all: Record<string, number> = {};
                    selectedSale.items?.forEach((item: any) => {
                      all[item.productId] = getAvailableQty(selectedSale, item.productId);
                    });
                    setReturnItems(all);
                  }}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                >
                  Select All
                </button>
              </div>

              <div className="space-y-2">
                {selectedSale.items?.map((item: any) => {
                  const available = getAvailableQty(selectedSale, item.productId);
                  const selected = returnItems[item.productId] || 0;
                  const product = products.find(p => p.id === item.productId);

                  return (
                    <div
                      key={item.productId}
                      className={cn("border rounded-lg p-3 transition-all", selected > 0 ? "border-amber-300 bg-amber-50/50" : "border-border bg-white")}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected > 0}
                          onChange={(e) => {
                            setReturnItems(prev => ({
                              ...prev,
                              [item.productId]: e.target.checked ? Math.min(available, 1) : 0,
                            }));
                          }}
                          className="w-4 h-4 rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                        />
                        <ProductImage imageUrl={product?.imageUrl} name={item.name} className="w-10 h-10" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">{item.name}</p>
                          <p className="text-xs text-neutral-400">
                            Original: {item.quantity} @ Rs. {item.price.toFixed(2)}
                            {available < item.quantity && (
                              <span className="text-amber-600 ml-1">({item.quantity - available} already returned)</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {selected > 0 ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setReturnItems(prev => ({
                                  ...prev,
                                  [item.productId]: Math.max(0, (prev[item.productId] || 0) - 1),
                                }))}
                                className="w-7 h-7 rounded-md bg-white border border-border flex items-center justify-center hover:bg-neutral-50"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center text-sm font-medium text-neutral-900">{selected}</span>
                              <button
                                type="button"
                                onClick={() => setReturnItems(prev => ({
                                  ...prev,
                                  [item.productId]: Math.min(available, (prev[item.productId] || 0) + 1),
                                }))}
                                disabled={selected >= available}
                                className="w-7 h-7 rounded-md bg-white border border-border flex items-center justify-center hover:bg-neutral-50 disabled:opacity-40"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400">0 of {available}</span>
                          )}
                          {selected > 0 && (
                            <p className="text-[10px] text-amber-700 font-medium mt-1">Rs. {(item.price * selected).toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {getReturnItemCount() > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Returning {getReturnItemCount()} item(s)
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">Items will be restocked and customer balance adjusted.</p>
                  </div>
                  <p className="text-lg font-semibold text-amber-700">Rs. {getReturnTotal().toFixed(2)}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsNewReturnOpen(false)}>Cancel</Button>
          {selectedSale && (
            <Button
              onClick={handleReturn}
              disabled={getReturnItemCount() === 0 || isSubmitting}
            >
              {isSubmitting ? 'Processing...' : `Confirm Return${getReturnTotal() > 0 ? ` (Rs. ${getReturnTotal().toFixed(2)})` : ''}`}
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </div>
  );
}
