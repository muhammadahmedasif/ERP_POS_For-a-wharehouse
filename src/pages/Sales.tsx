import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ProductImage } from '../components/ProductImage';
import { Search, Plus, Filter, Download, ArrowLeft, Trash2, Printer, Users, User, TrendingUp, DollarSign, Wallet, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { Product } from '../types';

import { useLocation, useNavigate } from 'react-router-dom';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { printReceipt } from '../lib/printReceipt';
import { useAppStore } from '../store';

const formatSaleDateTime = (dateString: string) => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) {
      return {
        date: dateString,
        day: 'Thursday',
        time: '12:00 PM'
      };
    }
    const dateFormatted = d.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' });
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[d.getDay()];
    const timeFormatted = d.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true });
    return {
      date: dateFormatted,
      day: dayName,
      time: timeFormatted
    };
  } catch (e) {
    return {
      date: dateString,
      day: 'Thursday',
      time: '12:00 PM'
    };
  }
};

export default function Sales({ initialView = 'list' }: { initialView?: 'list' | 'new' }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'list' | 'new'>(initialView);
  
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const { customers, fetchCustomers, user } = useAppStore();
  const { settings, fetchSettings: fetchGlobalSettings } = useAppStore();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [amountPaidInput, setAmountPaidInput] = useState('');
  // Use global seller name, no need for local state that doesn't sync
  const sellerNameValue = user?.name || settings.sellerName || 'Admin';
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState<string>('');
  
  // Custom modes requested: dynamic toggle between walkin and regular customers
  const [newSaleCustomerType, setNewSaleCustomerType] = useState<'walkin' | 'regular'>('walkin');
  const [salesTabFilter, setSalesTabFilter] = useState<'all' | 'walkin' | 'regular'>('all');

  // New Order State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [cart, setCart] = useState<(Product & { quantity: number })[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [regularPaymentStatus, setRegularPaymentStatus] = useState<'paid' | 'unpaid'>('paid');
  const [regularPaymentMode, setRegularPaymentMode] = useState<'full' | 'custom'>('full');

  const normalizeScanKey = (value?: string) => (value || '').trim().toLowerCase();
  const findProductByScan = (scanValue: string) => {
    const scanKey = normalizeScanKey(scanValue);
    if (!scanKey) return undefined;

    return products.find(p => 
      normalizeScanKey(p.barcode) === scanKey
      || normalizeScanKey(p.sku) === scanKey
      || normalizeScanKey(p.id) === scanKey
      || normalizeScanKey(p.name) === scanKey
    );
  };

  useEffect(() => {
    if (location.pathname === '/sales/new') {
      setView('new');
    } else {
      setView('list');
    }
  }, [location.pathname]);

  // Focus keeper for search bar
  useEffect(() => {
    if (view === 'new' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (view !== 'new') return;
      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement;
      
      if (!isInputFocused && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [view]);

  // Auto-add product on exact barcode match
  useEffect(() => {
    if (view === 'new' && barcodeInput.trim()) {
      const scanKey = normalizeScanKey(barcodeInput);
      // We only auto-match exact barcode or SKU since name can have partial overlap easily
      const exactMatch = products.find(p => 
        (p.barcode && normalizeScanKey(p.barcode) === scanKey) || 
        (p.sku && normalizeScanKey(p.sku) === scanKey)
      );
      if (exactMatch) {
        addToCart(exactMatch);
      }
    }
  }, [barcodeInput, products, view]);

  useEffect(() => {
    fetchSales();
    fetchProducts();
    fetchGlobalSettings();
    fetchCustomers();
  }, []);

  const fetchSales = () => {
    fetch('/api/sales').then(r => r.json()).then(setSales);
  };
  const fetchProducts = () => {
    fetch('/api/products').then(r => r.json()).then(setProducts);
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(c => c.id === product.id);
    const newQty = existing ? existing.quantity + 1 : 1;
    
    if (newQty > product.stock) {
      alert(`Cannot add ${product.name}. Only ${product.stock} items available in stock.`);
      return;
    }

    setBarcodeInput('');
    setShowSuggestions(false);
    
    if (existing) {
      setCart(cart.map(c => c.id === product.id ? { ...c, quantity: newQty } : c));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  useBarcodeScanner((barcode) => {
    if (view === 'new') {
      const product = findProductByScan(barcode);
      if (product) {
        addToCart(product);
      }
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
      alert('Product not found! Please check the barcode or name.');
    }
  };

  const filteredProductsForSearch = products.filter(p => 
    barcodeInput && 
    (p.name?.toLowerCase().includes(barcodeInput.toLowerCase()) || 
     p.barcode?.includes(barcodeInput) || 
     p.id.includes(barcodeInput) || 
     p.sku?.toLowerCase().includes(barcodeInput.toLowerCase()))
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && barcodeInput && filteredProductsForSearch.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => (prev + 1) % filteredProductsForSearch.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => (prev - 1 + filteredProductsForSearch.length) % filteredProductsForSearch.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedProduct = filteredProductsForSearch[activeSuggestionIndex];
        if (selectedProduct) {
          addToCart(selectedProduct);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  const removeCartItem = (id: string) => {
    setCart(cart.filter(c => c.id !== id));
  };
  
  const handleQuantityChange = (id: string, qty: number) => {
    const val = isNaN(qty) ? 0 : qty;
    const product = products.find(p => p.id === id);
    if (product && val > product.stock) {
      alert(`Only ${product.stock} items available in stock for ${product.name}.`);
      setCart(cart.map(c => c.id === id ? { ...c, quantity: product.stock } : c));
      return;
    }
    setCart(cart.map(c => c.id === id ? { ...c, quantity: val } : c));
  };

  const totalAmount = cart.reduce((acc, item) => acc + (item.price * (item.quantity || 0)), 0);

  // regular customer mode specific discount calculation
  const discountValNum = parseFloat(discountValue) || 0;
  const isRegularMode = newSaleCustomerType === 'regular';
  const discountAmount = isRegularMode
    ? (discountType === 'percent'
        ? (totalAmount * discountValNum / 100)
        : discountValNum)
    : 0;

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
      alert(`Please enter a valid quantity of 1 or more for article "${invalidItem.name}" before processing the sale.`);
      return;
    }

    // Final stock overflow check
    for (const cartItem of cart) {
      const latestProduct = products.find(p => p.id === cartItem.id);
      if (latestProduct && cartItem.quantity > latestProduct.stock) {
        alert(`Cannot process sale: "${cartItem.name}" has only ${latestProduct.stock} in stock but ${cartItem.quantity} requested.`);
        return;
      }
    }
    
    const isWalkIn = newSaleCustomerType === 'walkin';
    const customerId = isWalkIn ? null : (selectedCustomerId || null);

    if (!isWalkIn && !customerId) {
      alert("Please select a regular customer from the dropdown list, or switch to Walk-in customer mode.");
      return;
    }
    
    let paidAmount = 0;
    if (isWalkIn) {
      // Walk-in is always fully paid in cash
      paidAmount = finalTotalAmount;
    } else {
      // Regular customer: use toggle logic
      if (regularPaymentStatus === 'unpaid') {
        paidAmount = 0;
      } else if (regularPaymentMode === 'full') {
        paidAmount = netAmountDue;
      } else {
        paidAmount = amountPaidInput === '' ? 0 : parseFloat(amountPaidInput) || 0;
      }
    }

    const orderData = {
      total: finalTotalAmount,
      items: cart.map(c => ({ productId: c.id, name: c.name, quantity: c.quantity, price: c.price })),
      customerId,
      amountPaid: paidAmount,
      discountAmount,
      discountType: isRegularMode && discountValue ? discountType : undefined,
      discountValue: isRegularMode && discountValue ? discountValue : undefined,
      sellerName: sellerNameValue,
      creditDeducted
    };

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    if (res.ok) {
      const newSale = await res.json();
      
      // Inject matching customer name for beautiful tax invoice printing
      const matchingCust = customers.find(c => c.id === customerId);
      const saleWithCustomerName = {
        ...newSale,
        customerName: matchingCust ? matchingCust.name : null
      };

      // Auto-print invoice, even if blocked it won't crash
      try {
        printReceipt(saleWithCustomerName, products, settings);
      } catch (e) {
        console.error("Print failed", e);
      }

      setCart([]);
      setSelectedCustomerId('');
      setAmountPaidInput('');
      setDiscountValue('');
      setDiscountType('fixed');
      setNewSaleCustomerType('walkin');
      navigate('/sales');
      fetchSales();
      fetchProducts(); // Refresh stock
      fetchCustomers(); // Refresh customer balances
    }
  };

  const handleDeleteSale = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sale? This will revert the inventory values.')) {
      return;
    }
    const res = await fetch(`/api/sales/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      alert('Sale deleted and products restocked successfully.');
      fetchSales();
      fetchProducts();
    } else {
      alert('Failed to delete sale.');
    }
  };

  if (view === 'new') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/sales')} className="p-2">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Button>
          <h2 className="text-xl font-bold text-slate-800">New Sale / Bill Generation</h2>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 space-y-6">
            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleBarcodeSubmit} className="relative w-full">
                  <div className="flex gap-4">
                    <Input 
                      ref={searchInputRef}
                      id="barcode-input"
                      placeholder="Search for products" 
                      value={barcodeInput}
                      onChange={(e) => {
                        setBarcodeInput(e.target.value);
                        setShowSuggestions(true);
                        setActiveSuggestionIndex(0);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="flex-1"
                    />
                    <Button type="submit">Add to Bill</Button>
                  </div>
                  
                  {showSuggestions && barcodeInput && filteredProductsForSearch.length > 0 && (
                    <div className="absolute top-full left-0 right-[100px] mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                      {filteredProductsForSearch.map((p, idx) => {
                        const isActive = idx === activeSuggestionIndex;
                        return (
                          <div 
                            key={p.id}
                            className={`px-4 py-2 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0 transition-colors ${
                              isActive ? 'bg-indigo-50 border-l-4 border-indigo-600 pl-3' : 'hover:bg-slate-50'
                            }`}
                            onClick={() => addToCart(p)}
                            onMouseEnter={() => setActiveSuggestionIndex(idx)}
                          >
                            <div>
                              <div className="font-semibold text-sm text-slate-900">{p.name}</div>
                              <div className="text-xs text-slate-500">ID: {p.id} | SKU: {p.sku} | Barcode: {p.barcode}</div>
                            </div>
                            <div className="font-bold text-sm text-indigo-600">
                              Rs. {p.price.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 font-medium">Product</th>
                      <th className="px-6 py-3 font-medium">Price</th>
                      <th className="px-6 py-3 font-medium">Qty</th>
                      <th className="px-6 py-3 font-medium text-right">Total</th>
                      <th className="px-6 py-3 font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-2">
                          <ProductImage imageUrl={item.imageUrl} name={item.name} className="w-8 h-8"/>
                          {item.name}
                      </td>
                        <td className="px-6 py-4 text-slate-500 font-mono font-bold">Rs. {item.price.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <Input 
                            type="number" 
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            className="w-20"
                          />
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 text-right font-mono">
                          Rs. {(item.price * item.quantity).toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => removeCartItem(item.id)} className="text-slate-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {cart.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          No products selected. Search products on the left to add them to this bill.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
          
          <div className="col-span-4 space-y-6">
            <Card className="border border-slate-100 shadow-sm overflow-hidden">
              <CardContent className="p-6 space-y-6 bg-white">
                <div className="space-y-4 pb-4 border-b border-rose-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Customer Type</span>
                  
                  {/* Choice Buttons for Customer Mode */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setNewSaleCustomerType('walkin');
                        setSelectedCustomerId('');
                        setAmountPaidInput('');
                      }}
                      className={`py-2 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        newSaleCustomerType === 'walkin'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      Walk-In Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewSaleCustomerType('regular');
                      }}
                      className={`py-2 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        newSaleCustomerType === 'regular'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      Account Customer
                    </button>
                  </div>

                  {newSaleCustomerType === 'walkin' ? (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Walk-in Customer
                      </div>
                      <p className="text-[11px] leading-relaxed">Paid in Cash at counter.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-1">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block">Select Customer</label>
                        <select
                          value={selectedCustomerId}
                          onChange={(e) => {
                            setSelectedCustomerId(e.target.value);
                            setAmountPaidInput('');
                          }}
                          className="w-full h-10 border border-slate-200 bg-white rounded-md text-slate-800 text-xs px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">-- Choose Account --</option>
                          {customers.map(c => {
                            const out = c.totalAmount - c.paidAmount;
                            return (
                              <option key={c.id} value={c.id}>
                                {c.name} {out > 0 ? `(Owes Rs. ${out.toLocaleString()})` : '(No outstanding)'}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Customer Discount</label>
                        <div className="flex gap-2 mt-1">
                          <select
                            value={discountType}
                            onChange={(e) => {
                              setDiscountType(e.target.value as 'percent' | 'fixed');
                              setDiscountValue('');
                            }}
                            className="h-9 border border-slate-200 bg-white rounded-md text-slate-850 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-24"
                          >
                            <option value="fixed">Rs. Flat</option>
                            <option value="percent">% Percent</option>
                          </select>
                          <Input
                            type="number"
                            min="0"
                            placeholder={discountType === 'percent' ? "e.g. 10" : "e.g. 500"}
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value)}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            className="h-9 text-xs border-slate-200 font-mono flex-1"
                          />
                        </div>
                      </div>

                      {selectedCustomerId && (
                        <div className="space-y-3 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                          {(() => {
                            const currentCust = customers.find(c => c.id === selectedCustomerId);
                            if (!currentCust) return null;
                            const prevOwes = currentCust.totalAmount - currentCust.paidAmount;
                            return (
                              <div className="text-[11px] space-y-1 text-slate-600 border-b border-indigo-100/40 pb-2 mb-2">
                                <div className="flex justify-between">
                                  <span>Phone:</span>
                                  <span className="font-semibold text-slate-800">{currentCust.phone || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Total Account Balance:</span>
                                  <span className={prevOwes < 0 ? "font-bold text-emerald-600" : "font-bold text-amber-600"}>
                                    {prevOwes < 0 ? `Extra Paid: Rs. ${Math.abs(prevOwes).toLocaleString()}` : `Pending Dues: Rs. ${prevOwes.toLocaleString()}`}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}

                          {creditDeducted > 0 && (
                            <div className="bg-emerald-50 border border-emerald-205 p-2.5 rounded-lg text-emerald-900 text-[11px] space-y-1">
                              <div className="font-bold flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Extra Cash Used!
                              </div>
                              <div className="flex justify-between">
                                  <span>Available Extra Cash:</span>
                                <span className="font-mono font-bold">Rs. {availableAdvanceCredit.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Subtracted from this bill:</span>
                                <span className="font-mono font-semibold text-emerald-700">- Rs. {creditDeducted.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-emerald-200">
                                <span>Remaining Extra Cash:</span>
                                <span className="font-mono font-bold text-slate-800">Rs. {(availableAdvanceCredit - creditDeducted).toFixed(2)}</span>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2 pt-2 border-t border-indigo-100/40">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Payment</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRegularPaymentStatus('paid');
                                  setRegularPaymentMode('full');
                                  setAmountPaidInput('');
                                }}
                                className={`py-2 px-2 text-xs font-bold rounded-md transition-colors ${regularPaymentStatus === 'paid' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}
                              >
                                Paid
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRegularPaymentStatus('unpaid');
                                  setAmountPaidInput('0');
                                }}
                                className={`py-2 px-2 text-xs font-bold rounded-md transition-colors ${regularPaymentStatus === 'unpaid' ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}
                              >
                                Unpaid
                              </button>
                            </div>
                          </div>

                          {regularPaymentStatus === 'paid' && (
                            <div className="space-y-2 pt-2 border-t border-indigo-100/40">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cash Received</label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRegularPaymentMode('full');
                                    setAmountPaidInput('');
                                  }}
                                  className={`py-1.5 px-2 text-xs font-bold rounded-md transition-colors ${regularPaymentMode === 'full' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}
                                >
                                  Full Paid
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRegularPaymentMode('custom');
                                    setAmountPaidInput('');
                                  }}
                                  className={`py-1.5 px-2 text-xs font-bold rounded-md transition-colors ${regularPaymentMode === 'custom' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}
                                >
                                  Custom / Cash
                                </button>
                              </div>
                              {regularPaymentMode === 'custom' && (
                                <div className="pt-2">
                                  <Input
                                    type="number"
                                    placeholder={`Cash Received (e.g. ${netAmountDue.toFixed(2)})`}
                                    value={amountPaidInput}
                                    onChange={(e) => setAmountPaidInput(e.target.value)}
                                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                    className="h-9 text-xs border-slate-200 font-mono"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex justify-between items-center text-xs font-semibold pt-2 border-t border-indigo-100/40">
                            <span className="text-slate-500">Remaining Bill Amount:</span>
                            {(() => {
                              const cashPaid = regularPaymentStatus === 'unpaid' ? 0 : regularPaymentMode === 'full' ? netAmountDue : (amountPaidInput === '' ? 0 : parseFloat(amountPaidInput) || 0);
                              const owed = Math.max(0, finalTotalAmount - creditDeducted - cashPaid);
                              return (
                                <span className={`${owed > 0 ? 'text-red-600 font-black' : 'text-emerald-700 font-bold'} font-mono`}>
                                  Rs. {owed.toFixed(2)}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 space-y-3">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-mono font-bold">Rs. {totalAmount.toFixed(2)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold bg-emerald-50 px-2 py-1.5 rounded text-xs border border-emerald-100">
                      <span>Discount ({discountType === 'percent' ? `${discountValue}%` : 'Flat'})</span>
                      <span className="font-mono font-bold">- Rs. {discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-slate-400 text-[11px] font-mono">
                      <span>Discounted Subtotal</span>
                      <span className="font-mono font-bold">Rs. {discountedSubtotal.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-550">
                    <span>Tax ({settings?.taxRate || 0}%)</span>
                    <span className="font-mono font-bold">Rs. {calculatedTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-100">
                    <span>Total Amount</span>
                    <span className="text-indigo-600 font-mono">Rs. {finalTotalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 text-xs font-bold" onClick={processOrder} disabled={cart.length === 0}>
                  Process Bill
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

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

  const filteredSales = filteredSalesFilteredByTab.filter(s => {
    const matchesSearch = s.id?.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesCustomerName = false;
    
    if (s.customerId) {
      const matchCust = customers.find(c => c.id === s.customerId);
      if (matchCust && matchCust.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
        matchesCustomerName = true;
      }
    }
    return matchesSearch || matchesCustomerName;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800">{t('sales')} Ledger</h2>
          <p className="text-xs text-slate-500">Track walk-in cash flow and wholesale regular customer balances.</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" className="bg-white border hover:bg-gray-50 text-gray-800">
             <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={() => navigate('/sales/new')}>
            <Plus className="w-4 h-4 mr-2" /> New Sale
          </Button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <Card className="border border-indigo-100 shadow-xs bg-gradient-to-br from-white to-indigo-50/25">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Stores Sales (All)</span>
              <span className="text-2xl font-black text-indigo-700 font-mono">Rs. {overallTotalVolume.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              <span className="text-[11px] text-slate-500 font-semibold block">{overallCount} Invoices Registered</span>
            </div>
            <div className="p-3 bg-indigo-50/80 text-indigo-600 rounded-full">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-150 shadow-xs bg-gradient-to-br from-white to-slate-50/25">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase block">Walk-In Customer Sales</span>
              <span className="text-2xl font-black text-slate-800 font-mono">Rs. {walkinTotalVolume.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              <span className="text-[11px] text-slate-500 font-semibold block">{walkinCount} Cash Transactions</span>
            </div>
            <div className="p-3 bg-slate-50 text-slate-650 rounded-full">
              <User className="w-5 h-5 text-slate-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-amber-100 shadow-xs bg-gradient-to-br from-white to-amber-50/15">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase block">Regular Customer Billing</span>
              <span className="text-2xl font-black text-amber-700 font-mono">Rs. {regularTotalVolume.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              <span className="text-[11px] text-slate-500 font-semibold block">{regularCount} Account Invoices</span>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segmented Filter Sections for Walkin and Regular Customers */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setSalesTabFilter('all')}
          className={`py-3 px-6 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            salesTabFilter === 'all'
              ? 'border-indigo-600 text-indigo-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          All Transactions ({overallCount})
        </button>
        <button
          onClick={() => setSalesTabFilter('walkin')}
          className={`py-3 px-6 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            salesTabFilter === 'walkin'
              ? 'border-slate-700 text-slate-800 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Walk-In Customers ({walkinCount})
        </button>
        <button
          onClick={() => setSalesTabFilter('regular')}
          className={`py-3 px-6 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            salesTabFilter === 'regular'
              ? 'border-amber-600 text-amber-700 font-black'
              : 'border-transparent text-slate-500 hover:text-amber-650'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Regular Customer Ledgers ({regularCount})
        </button>
      </div>

      <Card className="border border-slate-100 shadow-sm mt-4">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center w-full">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search by Bill ID or Regular Customer Name..."
                className="pl-9"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="bg-white border text-gray-800 ml-3">
              <Filter className="w-4 h-4 mr-2" /> Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5 font-bold text-slate-600 uppercase tracking-wider text-xs">Bill Details</th>
                  <th className="px-6 py-3.5 font-bold text-slate-600 uppercase tracking-wider text-xs">Customer Profile / Type</th>
                  <th className="px-6 py-3.5 font-bold text-slate-600 uppercase tracking-wider text-xs">Products Sold</th>
                  <th className="px-6 py-3.5 font-bold text-slate-600 uppercase tracking-wider text-right text-xs">Bill & Ledger Status</th>
                  <th className="px-6 py-3.5 font-bold w-24 text-center text-slate-600 uppercase tracking-wider text-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSales.map((sale) => {
                  const dateTime = formatSaleDateTime(sale.date);
                  
                  // Extract matching regular customer details
                  const client = sale.customerId 
                    ? customers.find(c => c.id === sale.customerId)
                    : null;
                  
                  const outstandingBalance = sale.customerId
                    ? Math.max(0, sale.total - (sale.amountPaid || 0) - (sale.creditDeducted || 0))
                    : 0;

                  // Generate custom parameters for printable ticket
                  const printPayload = {
                    ...sale,
                    customerName: client ? client.name : null
                  };

                  return (() => {
                    const isAISale = (sale.sellerName || '').toLowerCase().includes('ai voice assistant');
                    const displaySellerName = isAISale 
                      ? (sale.sellerName || '').replace(/AI Voice Assistant on behalf of /i, '').replace(/AI Voice Assistant/i, 'AI').trim() || 'AI'
                      : (sale.sellerName || 'Admin');
                    return (
                    <tr key={sale.id} className={`hover:bg-slate-50/50 transition-colors align-top ${isAISale ? 'bg-violet-50/20' : ''}`}>
                      <td className="px-6 py-4 space-y-1">
                        <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/40 px-2 py-0.5 rounded block w-fit">
                          {sale.id}
                        </span>
                        {isAISale ? (
                          <div className="text-[11px] text-violet-600 font-bold flex items-center gap-1.5 mt-2">
                            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                            AI Assistant Sale
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-2">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            Authenticated Invoice
                          </div>
                        )}
                        <div className="mt-2 text-xs text-slate-700 font-medium flex items-center gap-1.5 pt-2 border-t border-slate-100">
                           <User className="w-3.5 h-3.5 text-indigo-500" />
                           <span className="font-bold">{displaySellerName}</span>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 space-y-2">
                        {client ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 font-bold text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                              <Users className="w-3.5 h-3.5 text-amber-500" />
                              {client.name}
                            </span>
                            <div className="text-xs font-medium text-slate-500 font-mono">
                              Phone: {client.phone || "No Contact"}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              Registered wholesale regular client
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 font-bold text-xs text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              Walk-in Customer
                            </span>
                            <div className="text-[10px] text-slate-400 font-medium">
                              Instant store trade / No ledger account
                            </div>
                          </div>
                        )}
                        
                        <div className="pt-1.5 border-t border-slate-100/50 space-y-1">
                          <div className="font-semibold text-slate-800 text-xs">{dateTime.day}</div>
                          <div className="text-[11px] font-mono text-slate-400">{dateTime.date} @ {dateTime.time}</div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {sale.items && sale.items.length > 0 ? (
                          <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-100 max-w-md shadow-xs">
                            <table className="w-full text-[11px] text-left border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  <th className="pb-1 text-left">Product Name</th>
                                  <th className="pb-1 text-center w-12">Qty</th>
                                  <th className="pb-1 text-right w-24">Unit Price</th>
                                  <th className="pb-1 text-right w-28">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-150">
                                {sale.items.map((item: any, idx: number) => {
                                  const p = products.find(prod => prod.id === item.productId);
                                  const prodName = p ? p.name : `Product #${item.productId}`;
                                  return (
                                    <tr key={idx} className="text-slate-600">
                                      <td className="py-1.5 pr-2 font-medium text-slate-800 flex items-center gap-2">
                                        <ProductImage imageUrl={p?.imageUrl} name={prodName} className="w-8 h-8"/>
                                        {prodName}
                                      </td>
                                      <td className="py-1.5 text-center text-slate-500 font-bold font-mono">{item.quantity}</td>
                                      <td className="py-1.5 text-right text-slate-400 font-mono">Rs. {item.price.toFixed(2)}</td>
                                      <td className="py-1.5 text-right font-bold text-slate-700 font-mono">Rs. {(item.quantity * item.price).toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No items stored</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right space-y-1.5">
                        <div>
                          <span className="text-slate-400 text-[11px] font-medium block">Bill Total</span>
                          <span className="font-extrabold text-sm text-slate-900 font-mono">Rs. {sale.total.toFixed(2)}</span>
                          {sale.discountAmount && sale.discountAmount > 0 && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded block w-fit ml-auto mt-0.5 font-sans">
                              Disc: Rs. {parseFloat(sale.discountAmount).toFixed(2)}
                            </span>
                          )}
                        </div>

                        {sale.customerId ? (
                          <div className="space-y-1 border-t border-slate-100 pt-1.5 align-right text-right">
                            {sale.creditDeducted && sale.creditDeducted > 0 ? (
                              <div className="text-[11px] font-medium text-slate-500">
                                Paid via Advance Credit: <span className="font-bold text-indigo-600 font-mono">Rs. {parseFloat(sale.creditDeducted).toFixed(2)}</span>
                              </div>
                            ) : null}
                            <div className="text-[11px] font-medium text-slate-500">
                              Cash Received: <span className="font-bold text-emerald-600 font-mono">Rs. {(sale.amountPaid || 0).toFixed(2)}</span>
                            </div>
                            {outstandingBalance > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                                Unpaid Balance: Rs. {outstandingBalance.toFixed(2)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                <CheckCircle className="w-2.5 h-2.5" /> All paid
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="pt-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                              <Wallet className="w-3 h-3 text-emerald-600" /> Fully Paid in Cash
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-2.5">
                          <button 
                            onClick={() => printReceipt(printPayload, products, settings)} 
                            className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors" 
                            title="Print Invoice"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteSale(sale.id)} 
                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md transition-colors" 
                            title="Delete Sale"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })();
                })}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                      <div className="max-w-sm mx-auto space-y-2">
                        <p className="font-bold text-slate-500">No transactions recorded</p>
                        <p className="text-xs text-slate-400">No invoices matched the path, search queries, or selected customer category.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
