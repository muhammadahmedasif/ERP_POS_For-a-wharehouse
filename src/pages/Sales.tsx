import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ProductImage } from '../components/ProductImage';
import { Search, Plus, Filter, Download, ArrowLeft, Trash2, Printer, Users, User, TrendingUp, DollarSign, Wallet, FileText, CheckCircle, AlertTriangle, Sparkles, Minus, X, ShoppingCart, Package, Clock, Percent } from 'lucide-react';
import { Product } from '../types';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { printReceipt } from '../lib/printReceipt';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

const formatSaleDateTime = (dateString: string) => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return { date: dateString, time: '' };
    return {
      date: d.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
  } catch { return { date: dateString, time: '' }; }
};

export default function Sales({ initialView = 'list' }: { initialView?: 'list' | 'new' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'list' | 'new'>(initialView);
  const [sales, setSales] = useState<any[]>([]);
  const { customers, fetchCustomers, user, products, fetchProducts, settings, fetchSettings } = useAppStore();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const sellerNameValue = user?.name || settings.sellerName || 'Admin';
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [newSaleCustomerType, setNewSaleCustomerType] = useState<'walkin' | 'regular'>('walkin');
  const [salesTabFilter, setSalesTabFilter] = useState<'all' | 'walkin' | 'regular'>('all');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [cart, setCart] = useState<(Product & { quantity: number; perPieceDiscount?: number })[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [regularPaymentStatus, setRegularPaymentStatus] = useState<'paid' | 'unpaid'>('paid');
  const [regularPaymentMode, setRegularPaymentMode] = useState<'full' | 'custom'>('full');

  const normalizeScanKey = (value?: string) => (value || '').trim().toLowerCase();
  const productScanMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      if (p.barcode) map.set(normalizeScanKey(p.barcode), p);
      if (p.sku) map.set(normalizeScanKey(p.sku), p);
      if (p.id) map.set(normalizeScanKey(p.id), p);
      if (p.name) map.set(normalizeScanKey(p.name), p);
    }
    return map;
  }, [products]);

  const findProductByScan = useCallback((scanValue: string) => {
    const key = normalizeScanKey(scanValue);
    return key ? productScanMap.get(key) : undefined;
  }, [productScanMap]);

  useEffect(() => {
    setView(location.pathname === '/sales/new' ? 'new' : 'list');
  }, [location.pathname]);

  useEffect(() => {
    if (view === 'new' && searchInputRef.current) searchInputRef.current.focus();
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (view !== 'new') return;
      const active = document.activeElement;
      const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
      if (!isInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [view]);

  useEffect(() => {
    fetchSales();
    if (products.length === 0) fetchProducts();
    fetchSettings();
    fetchCustomers();
  }, []);

  const fetchSales = () => {
    fetch('/api/sales').then(r => r.json()).then(data => setSales(Array.isArray(data) ? data : []));
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(c => c.id === product.id);
    const newQty = existing ? existing.quantity + 1 : 1;
    if (newQty > product.stock) {
      toast.warning(`Cannot add ${product.name}. Only ${product.stock} items available.`);
      return;
    }
    setBarcodeInput('');
    setShowSuggestions(false);
    if (existing) {
      setCart(cart.map(c => c.id === product.id ? { ...c, quantity: newQty } : c));
    } else {
      setCart([...cart, { ...product, quantity: 1, perPieceDiscount: undefined }]);
    }
  };

  useBarcodeScanner((barcode) => {
    if (view === 'new') {
      const product = findProductByScan(barcode);
      if (product) addToCart(product);
    }
  });

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = barcodeInput.trim();
    if (!cleanInput) return;
    const product = findProductByScan(cleanInput);
    if (product) {
      addToCart(product);
    } else {
      toast.error('Product not found. Try searching by name, SKU, or barcode.');
    }
  };

  const filteredProductsForSearch = useMemo(() => {
    if (!barcodeInput) return [];
    const q = barcodeInput.toLowerCase();
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) || p.barcode?.includes(barcodeInput) || p.id.includes(barcodeInput) || p.sku?.toLowerCase().includes(q)
    );
  }, [barcodeInput, products]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && barcodeInput && filteredProductsForSearch.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev + 1) % filteredProductsForSearch.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev - 1 + filteredProductsForSearch.length) % filteredProductsForSearch.length); }
      else if (e.key === 'Enter') { e.preventDefault(); const p = filteredProductsForSearch[activeSuggestionIndex]; if (p) addToCart(p); }
      else if (e.key === 'Escape') setShowSuggestions(false);
    }
  };

  const removeCartItem = (id: string) => setCart(cart.filter(c => c.id !== id));

  const handleQuantityChange = (id: string, qty: number) => {
    const val = isNaN(qty) ? 0 : qty;
    const product = products.find(p => p.id === id);
    if (product && val > product.stock) {
      toast.warning(`Only ${product.stock} items available for ${product.name}.`);
      setCart(cart.map(c => c.id === id ? { ...c, quantity: product.stock } : c));
      return;
    }
    setCart(cart.map(c => c.id === id ? { ...c, quantity: val } : c));
  };

  const handlePerPieceDiscountChange = (id: string, val: string) => {
    const num = parseFloat(val);
    setCart(cart.map(c => c.id === id ? { ...c, perPieceDiscount: isNaN(num) ? undefined : num } : c));
  };

  const isRegularMode = newSaleCustomerType === 'regular';
  const totalAmount = cart.reduce((acc, item) => acc + ((item.price - (isRegularMode ? (item.perPieceDiscount || 0) : 0)) * (item.quantity || 0)), 0);
  const discountValNum = parseFloat(discountValue) || 0;
  const discountAmount = isRegularMode ? (discountType === 'percent' ? (totalAmount * discountValNum / 100) : discountValNum) : 0;
  const discountedSubtotal = Math.max(0, totalAmount - discountAmount);
  const calculatedTax = (discountedSubtotal * (settings?.taxRate || 0)) / 100;
  const finalTotalAmount = discountedSubtotal + calculatedTax;
  const selectedCustomer = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : null;
  const customerOutstanding = selectedCustomer ? (selectedCustomer.totalAmount - selectedCustomer.paidAmount) : 0;
  const availableAdvanceCredit = selectedCustomer && customerOutstanding < 0 ? Math.abs(customerOutstanding) : 0;
  const creditDeducted = availableAdvanceCredit > 0 ? Math.min(availableAdvanceCredit, finalTotalAmount) : 0;
  const netAmountDue = Math.max(0, finalTotalAmount - creditDeducted);

  const processOrder = async () => {
    if (cart.length === 0) return;
    const invalidItem = cart.find(c => !c.quantity || c.quantity < 1);
    if (invalidItem) {
      toast.error(`Please enter a valid quantity for "${invalidItem.name}".`);
      return;
    }
    for (const cartItem of cart) {
      const latestProduct = products.find(p => p.id === cartItem.id);
      if (latestProduct && cartItem.quantity > latestProduct.stock) {
        toast.error(`Cannot process: "${cartItem.name}" has only ${latestProduct.stock} in stock but ${cartItem.quantity} requested.`);
        return;
      }
    }
    const isWalkIn = newSaleCustomerType === 'walkin';
    const customerId = isWalkIn ? null : (selectedCustomerId || null);
    if (!isWalkIn && !customerId) {
      toast.error('Please select a regular customer, or switch to Walk-in mode.');
      return;
    }
    let paidAmount = 0;
    if (isWalkIn) {
      paidAmount = finalTotalAmount;
    } else if (regularPaymentStatus === 'unpaid') {
      paidAmount = 0;
    } else if (regularPaymentMode === 'full') {
      paidAmount = netAmountDue;
    } else {
      paidAmount = amountPaidInput === '' ? 0 : parseFloat(amountPaidInput) || 0;
    }
    const orderData = {
      total: finalTotalAmount,
      items: cart.map(c => ({ productId: c.id, name: c.name, quantity: c.quantity, price: c.price, perPieceDiscount: isRegularMode ? c.perPieceDiscount : undefined })),
      customerId, amountPaid: paidAmount, discountAmount,
      discountType: isRegularMode && discountValue ? discountType : undefined,
      discountValue: isRegularMode && discountValue ? discountValue : undefined,
      sellerName: sellerNameValue,
    };
    const res = await fetch('/api/sales', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderData),
    });
    if (res.ok) {
      const newSale = await res.json();
      const matchingCust = customers.find(c => c.id === customerId);
      const saleWithCustomerName = { ...newSale, customerName: matchingCust ? matchingCust.name : null };
      try { printReceipt(saleWithCustomerName, products, settings); } catch (e) { console.error("Print failed", e); }
      setCart([]); setSelectedCustomerId(''); setAmountPaidInput(''); setDiscountValue(''); setDiscountType('fixed');
      setNewSaleCustomerType('walkin'); fetchSales(); fetchProducts(); fetchCustomers();
      toast.success('Sale completed successfully.');
    } else {
      const err = await res.json().catch(() => ({ error: 'Failed to process sale' }));
      toast.error(err.error || 'Failed to process sale');
    }
  };

  const handleDeleteSale = async (id: string) => {
    toast('Delete this sale? Products will be restocked.', {
      action: { label: 'Delete', onClick: async () => {
        const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Sale deleted.'); fetchSales(); fetchProducts(); }
        else { toast.error('Failed to delete sale.'); }
      }},
      cancel: { label: 'Cancel', onClick: () => {} },
      duration: 10000,
    });
  };

  if (view === 'new') {
    return (
      <div className="h-full flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/sales')} className="p-1.5"><ArrowLeft className="w-4 h-4" /></Button>
          <p className="text-xs text-neutral-400">Scan or search products to add to the bill.</p>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
          {/* Left: Product Search */}
          <div className="lg:col-span-7 flex flex-col gap-4 min-h-0">
            <div className="relative">
              <form onSubmit={handleBarcodeSubmit} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search by name, SKU, or scan barcode..."
                  value={barcodeInput}
                  onChange={e => { setBarcodeInput(e.target.value); setShowSuggestions(true); setActiveSuggestionIndex(0); }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={handleKeyDown}
                  className="pl-9 pr-20 h-11"
                />
                <Button type="submit" size="sm" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </form>
              {showSuggestions && barcodeInput && filteredProductsForSearch.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-10 max-h-72 overflow-y-auto">
                  <div className="sticky top-0 bg-neutral-50 border-b border-border px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-4">
                    <span className="flex-1">Product</span>
                    <span className="w-16 text-right">Price</span>
                  </div>
                  {filteredProductsForSearch.map((p, idx) => (
                    <button
                      key={p.id} type="button"
                      onClick={() => addToCart(p)}
                      onMouseEnter={() => setActiveSuggestionIndex(idx)}
                      className={`w-full flex items-center gap-3 text-sm transition-colors ${idx === activeSuggestionIndex ? 'bg-primary-50 border-l-2 border-primary-500' : 'hover:bg-primary-50/60 border-l-2 border-transparent'}`}
                    >
                      <div className="pl-3 py-2.5 flex items-center gap-3 flex-1 min-w-0">
                        <ProductImage imageUrl={p.imageUrl} name={p.name} className="w-9 h-9 rounded-lg shrink-0 ring-1 ring-neutral-200" />
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium text-neutral-900 truncate">{p.name}</p>
                          <p className="text-xs text-neutral-400 truncate">
                            <span className="text-neutral-300">SKU:</span> {p.sku}
                            <span className="mx-1.5 text-neutral-200">|</span>
                            <span className={p.stock > 0 ? 'text-emerald-600' : 'text-rose-500'}>{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</span>
                          </p>
                        </div>
                        <p className="text-sm font-bold text-primary-700 shrink-0 px-2">Rs. {p.price.toFixed(2)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSuggestions && barcodeInput.trim() && filteredProductsForSearch.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-10 p-6 text-center">
                  <Package className="w-8 h-8 text-neutral-200 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No product found</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Try a different name, SKU, or barcode.</p>
                </div>
              )}
            </div>

            {/* Customer type toggle */}
            <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg w-fit">
              <button type="button" onClick={() => { setNewSaleCustomerType('walkin'); setSelectedCustomerId(''); setAmountPaidInput(''); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${newSaleCustomerType === 'walkin' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
                <User className="w-3.5 h-3.5 inline mr-1" /> Walk-in
              </button>
              <button type="button" onClick={() => setNewSaleCustomerType('regular')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${newSaleCustomerType === 'regular' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
                <Users className="w-3.5 h-3.5 inline mr-1" /> Account Customer
              </button>
            </div>

            {/* Cart table */}
            <Card className="flex-1 flex flex-col min-h-0">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Cart ({cart.length} items)</span>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-neutral-400 hover:text-rose-600 transition-colors">Clear all</button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex items-center justify-center h-full py-12">
                    <div className="text-center">
                      <ShoppingCart className="w-10 h-10 text-neutral-200 mx-auto mb-2" />
                      <p className="text-sm text-neutral-400">Cart is empty</p>
                      <p className="text-xs text-neutral-300 mt-1">Search and add products above.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {cart.map((item, idx) => {
                      const lineTotal = ((item.price - (isRegularMode ? (item.perPieceDiscount || 0) : 0)) * item.quantity);
                      const hasDiscount = isRegularMode && item.perPieceDiscount;
                      return (
                      <div key={item.id} className="bg-white rounded-xl border border-neutral-200/70 shadow-xs hover:shadow-sm transition-shadow">
                        <div className="flex items-start gap-3 px-4 pt-3 pb-2">
                          <div className="w-1 h-full min-h-[2.5rem] rounded-full bg-primary-400 shrink-0 mt-0.5" />
                          <ProductImage imageUrl={item.imageUrl} name={item.name} className="w-11 h-11 rounded-lg shrink-0 ring-1 ring-neutral-200" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-neutral-900 truncate leading-snug">{item.name}</p>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                  <span className="font-medium text-primary-600">Rs. {item.price.toFixed(2)}</span>
                                  {hasDiscount && (
                                    <span className="text-emerald-600 ml-1.5 font-medium">-Rs. {item.perPieceDiscount!.toFixed(2)}/pc</span>
                                  )}
                                </p>
                              </div>
                              <p className="text-sm font-bold text-primary-700 tabular-nums shrink-0 ml-2">
                                Rs. {lineTotal.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-4 pb-3 pl-[4.25rem]">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleQuantityChange(item.id, Math.max(0, item.quantity - 1))}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 hover:bg-primary-100 hover:text-primary-700 active:bg-primary-200 transition-colors text-base font-medium">−</button>
                            <input type="number" min="1" value={item.quantity}
                              onChange={e => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                              onWheel={e => (e.target as HTMLInputElement).blur()}
                              className="w-12 h-8 text-sm font-semibold text-center border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 hover:bg-primary-100 hover:text-primary-700 active:bg-primary-200 transition-colors text-base font-medium">+</button>
                          </div>
                          <div className="flex items-center gap-2">
                            {newSaleCustomerType === 'regular' && (
                              <div className="flex items-center gap-1.5">
                                <Percent className="w-3.5 h-3.5 text-neutral-400" />
                                <input type="number" min="0" placeholder="Disc"
                                  className="w-14 h-8 text-xs text-center border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={item.perPieceDiscount === undefined ? '' : item.perPieceDiscount}
                                  onChange={e => handlePerPieceDiscountChange(item.id, e.target.value)}
                                  onWheel={e => (e.target as HTMLInputElement).blur()}
                                />
                              </div>
                            )}
                            <button onClick={() => removeCartItem(item.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <Card className="sticky top-0">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-neutral-900">Order Summary</h3>
              </div>
              <div className="p-5 space-y-4">
                {/* Customer info (regular mode) */}
                {newSaleCustomerType === 'regular' && (
                  <div className="space-y-3 pb-4 border-b border-border">
                    <select value={selectedCustomerId} onChange={e => { setSelectedCustomerId(e.target.value); setAmountPaidInput(''); }}
                      className="w-full h-10 border border-border bg-white rounded-lg text-sm px-3 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                      <option value="">Select a customer...</option>
                      {customers.map(c => {
                        const out = c.totalAmount - c.paidAmount;
                        return <option key={c.id} value={c.id}>{c.name} {out > 0 ? `(owes Rs. ${out.toLocaleString()})` : ''}</option>;
                      })}
                    </select>

                    {selectedCustomerId && (
                      <div className="text-xs text-neutral-500 space-y-1.5 bg-neutral-50 rounded-lg p-3">
                        {(() => {
                          const c = customers.find(c => c.id === selectedCustomerId);
                          if (!c) return null;
                          const prevOwes = c.totalAmount - c.paidAmount;
                          return (
                            <>
                              <div className="flex justify-between"><span>Phone:</span><span className="font-medium text-neutral-700">{c.phone || 'N/A'}</span></div>
                              <div className="flex justify-between"><span>Balance:</span><span className={prevOwes < 0 ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>{prevOwes < 0 ? `Rs. ${Math.abs(prevOwes).toLocaleString()} advance` : `Rs. ${prevOwes.toLocaleString()} due`}</span></div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Discount */}
                    <div className="flex gap-2">
                      <select value={discountType} onChange={e => { setDiscountType(e.target.value as 'percent' | 'fixed'); setDiscountValue(''); }}
                        className="h-10 border border-border bg-white rounded-lg text-xs px-2 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40 w-24">
                        <option value="fixed">Rs. Flat</option>
                        <option value="percent">% Percent</option>
                      </select>
                      <Input type="number" min="0" placeholder={discountType === 'percent' ? "Discount %" : "Discount Rs."}
                        value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                        onWheel={e => (e.target as HTMLInputElement).blur()} className="flex-1" />
                    </div>
                  </div>
                )}

                {/* Price breakdown */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-neutral-500">
                    <span>Subtotal</span>
                    <span>Rs. {totalAmount.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount</span>
                      <span>- Rs. {discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-neutral-500">
                    <span>Tax ({settings?.taxRate || 0}%)</span>
                    <span>Rs. {calculatedTax.toFixed(2)}</span>
                  </div>
                  {creditDeducted > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Advance credit used</span>
                      <span>- Rs. {creditDeducted.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold text-neutral-900 pt-2 border-t border-border">
                    <span>Total</span>
                    <span>Rs. {finalTotalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment section (regular mode with items) */}
                {newSaleCustomerType === 'regular' && netAmountDue > 0 && cart.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setRegularPaymentStatus('paid'); setRegularPaymentMode('full'); setAmountPaidInput(''); }}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${regularPaymentStatus === 'paid' ? 'bg-success-500 text-white' : 'bg-neutral-100 text-neutral-500'}`}>Paid</button>
                      <button type="button" onClick={() => { setRegularPaymentStatus('unpaid'); setAmountPaidInput('0'); }}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${regularPaymentStatus === 'unpaid' ? 'bg-danger-500 text-white' : 'bg-neutral-100 text-neutral-500'}`}>Unpaid</button>
                    </div>
                    {regularPaymentStatus === 'paid' && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setRegularPaymentMode('full'); setAmountPaidInput(''); }}
                          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${regularPaymentMode === 'full' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-500'}`}>Full Payment</button>
                        <button type="button" onClick={() => setRegularPaymentMode('custom')}
                          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${regularPaymentMode === 'custom' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-500'}`}>Custom</button>
                      </div>
                    )}
                    {regularPaymentStatus === 'paid' && regularPaymentMode === 'custom' && (
                      <Input type="number" min="0" placeholder="Amount received..."
                        value={amountPaidInput} onChange={e => setAmountPaidInput(e.target.value)}
                        onWheel={e => (e.target as HTMLInputElement).blur()} />
                    )}
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t border-border">
                <Button onClick={processOrder} disabled={cart.length === 0} size="lg" className="w-full text-sm font-semibold">
                  {newSaleCustomerType === 'walkin' ? 'Complete Sale' : netAmountDue > 0 ? `Process Order — Rs. ${netAmountDue.toFixed(2)}` : 'Process Order — Rs. 0'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  {/* ==================== SALES LIST VIEW ==================== */}
  const overallTotalVolume = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const walkinTotalVolume = sales.filter(s => !s.customerId).reduce((sum, s) => sum + (s.total || 0), 0);
  const regularTotalVolume = sales.filter(s => s.customerId).reduce((sum, s) => sum + (s.total || 0), 0);
  const overallCount = sales.length;
  const walkinCount = sales.filter(s => !s.customerId).length;
  const regularCount = sales.filter(s => s.customerId).length;
  const filteredSalesFilteredByTab = sales.filter(s => {
    if (salesTabFilter === 'walkin') return !s.customerId;
    if (salesTabFilter === 'regular') return !!s.customerId;
    return true;
  });
  const q = searchTerm.toLowerCase();
  const filteredSales = filteredSalesFilteredByTab.filter(s => {
    const matchesId = s.id?.toLowerCase().includes(q);
    const cust = s.customerId ? customers.find(c => c.id === s.customerId) : null;
    const matchesCustomer = cust?.name?.toLowerCase().includes(q);
    return matchesId || matchesCustomer;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-neutral-400">{sales.length} total sales</p>
        <Button onClick={() => navigate('/sales/new')} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> New Sale
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-neutral-400">Total Volume</p>
          <p className="text-lg font-semibold text-neutral-900 mt-1">Rs. {overallTotalVolume.toLocaleString()}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{overallCount} sales</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-neutral-400">Walk-in</p>
          <p className="text-lg font-semibold text-neutral-900 mt-1">Rs. {walkinTotalVolume.toLocaleString()}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{walkinCount} sales</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-neutral-400">Account Customers</p>
          <p className="text-lg font-semibold text-neutral-900 mt-1">Rs. {regularTotalVolume.toLocaleString()}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{regularCount} sales</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(['all', 'walkin', 'regular'] as const).map(tab => (
          <button key={tab} onClick={() => setSalesTabFilter(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              salesTabFilter === tab ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:text-neutral-700'
            }`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <Input placeholder="Search by ID or customer..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 h-9 w-48 text-xs" />
        </div>
      </div>

      <div className="space-y-2">
        {filteredSales.map((sale) => {
          const client = sale.customerId ? customers.find(c => c.id === sale.customerId) : null;
          const formatted = formatSaleDateTime(sale.date);
          const isRegular = !!sale.customerId;
          return (
            <div key={sale.id} className="bg-white rounded-xl border border-border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-sm font-semibold text-neutral-900">{sale.id}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isRegular ? 'bg-primary-50 text-primary-700' : 'bg-neutral-100 text-neutral-600'}`}>
                      {isRegular ? 'Account' : 'Walk-in'}
                    </span>
                    {sale.returnAmount > 0 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Returned</span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {client ? client.name : 'Walk-in Customer'} • {formatted.date} {formatted.time}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {sale.items?.slice(0, 3).map((item: any, idx: number) => (
                      <span key={idx} className="text-[11px] text-neutral-500 bg-neutral-50 px-2 py-0.5 rounded border border-border">
                        {item.quantity}x {item.name}
                      </span>
                    ))}
                    {sale.items?.length > 3 && (
                      <span className="text-[11px] text-neutral-400">+{sale.items.length - 3} more</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-semibold text-neutral-900">Rs. {(sale.total || 0).toFixed(2)}</p>
                  {sale.amountPaid > 0 && <p className="text-[11px] text-emerald-600">Paid: Rs. {sale.amountPaid.toFixed(2)}</p>}
                  {isRegular && sale.amountPaid < sale.total && (
                    <p className="text-[11px] text-amber-600">Due: Rs. {(sale.total - sale.amountPaid).toFixed(2)}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2 justify-end">
                    {sale.sellerName && <span className="text-[10px] text-neutral-400">{sale.sellerName}</span>}
                    <button onClick={() => handleDeleteSale(sale.id)}
                      className="p-1 text-neutral-300 hover:text-rose-500 transition-colors" title="Delete sale">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filteredSales.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-neutral-200" />
            <p className="text-sm font-medium">No sales found</p>
            <p className="text-xs mt-1">Create your first sale to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
