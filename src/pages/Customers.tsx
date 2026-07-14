import React, { useEffect, useState } from "react";

import { useAppStore } from "../store";
import { Customer, Product, Sale } from "../types";
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Search,
  Plus,
  User,
  Phone,
  Mail,
  MapPin,
  History,
  Trash2,
  Edit,
  ArrowLeft,
  DollarSign,
  X,
  FileText
} from "lucide-react";
import { format } from "date-fns";

export default function Customers() {
  
  const {
    customers,
    fetchCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    recordPayment,
  } = useAppStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  
  // Navigation & Interactive states
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formOpenBalance, setFormOpenBalance] = useState("0");
  const [formOpenPaid, setFormOpenPaid] = useState("0");
  
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [activeTab, setActiveTab] = useState<"orders" | "payments">("orders");

  useEffect(() => {
    fetchCustomers();
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error(err));
    fetch("/api/sales")
      .then((res) => res.json())
      .then((data) => setSales(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  }, []);

  const handleOpenAdd = () => {
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormOpenBalance("0");
    setFormOpenPaid("0");
    setShowAddModal(true);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Please enter a customer name.');
      return;
    }
    const tot = parseFloat(formOpenBalance) || 0;
    const paid = parseFloat(formOpenPaid) || 0;
    
    try {
      await addCustomer({
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        address: formAddress.trim(),
        totalAmount: tot,
        paidAmount: paid,
      });
      setShowAddModal(false);
      fetchCustomers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to add customer.');
    }
  };

  const handleOpenEdit = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(customer);
    setFormName(customer.name);
    setFormPhone(customer.phone);
    setFormEmail(customer.email || "");
    setFormAddress(customer.address || "");
    setFormOpenBalance(String(customer.totalAmount));
    setFormOpenPaid(String(customer.paidAmount));
    setShowEditModal(true);
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (!formName.trim()) {
      toast.error('Please enter a customer name.');
      return;
    }

    const tot = parseFloat(formOpenBalance) || 0;
    const paid = parseFloat(formOpenPaid) || 0;

    try {
      await updateCustomer(editingCustomer.id, {
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        address: formAddress.trim(),
        totalAmount: tot,
        paidAmount: paid,
      });
      setShowEditModal(false);
      setEditingCustomer(null);
      fetchCustomers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update customer.');
    }
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast(`Remove customer "${name}"?`, {
      action: {
        label: 'Yes, Remove',
        onClick: async () => {
          try {
            await deleteCustomer(id);
            if (selectedCustomerId === id) {
              setSelectedCustomerId(null);
            }
            fetchCustomers();
            toast.success(`Customer "${name}" removed.`);
          } catch (err: any) {
            toast.error('Failed to delete customer.');
          }
        }
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {}
      },
      duration: 10000,
    });
  };

  const handleOpenReceivePayment = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(customer);
    setPaymentAmount("");
    setPaymentNotes("");
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) {
      toast.error('Please enter a valid payment amount.');
      return;
    }

    const maxOutstanding = editingCustomer.totalAmount - editingCustomer.paidAmount;

    let resolvedNotes = paymentNotes.trim();
    if (!resolvedNotes) {
      if (maxOutstanding <= 0) {
        resolvedNotes = `Advance Payment Received: Rs. ${amount.toLocaleString()}`;
      } else if (amount > maxOutstanding) {
        resolvedNotes = `Cleared Debt Rs. ${maxOutstanding.toLocaleString()} (Advance Credit Recorded Rs. ${(amount - maxOutstanding).toLocaleString()})`;
      } else if (amount === maxOutstanding) {
        resolvedNotes = `Cleared Outstanding Debt: Rs. ${amount.toLocaleString()}`;
      } else {
        resolvedNotes = `Cash Payment installment: Rs. ${amount.toLocaleString()}`;
      }
    }

    try {
      await recordPayment(editingCustomer.id, amount, resolvedNotes);
      setShowPaymentModal(false);
      // Update our details context
      const updatedCustListRes = await fetch("/api/customers");
      await updatedCustListRes.json();
      await fetchCustomers();
      
      // Update selected profile state if in profile view
      setEditingCustomer(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to record payment.');
    }
  };

  // Filter customers list
  const filteredCustomers = customers.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Filter sales for the chosen profile
  const customerSales = sales.filter((s) => s.customerId === selectedCustomerId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-neutral-400">
          {selectedCustomer ? "Account details and transaction history" : `${customers.length} registered customers`}
        </p>
        {!selectedCustomerId ? (
          <Button size="sm" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Customer
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setSelectedCustomerId(null)}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
          </Button>
        )}
      </div>

      {selectedCustomer ? (
        <div className="grid grid-cols-12 gap-5 items-start">
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <Card>
              <CardContent className="p-5 text-center">
                <div className="mx-auto w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-500 mb-3">
                  <User className="w-7 h-7" />
                </div>
                <h3 className="text-base font-semibold text-neutral-900">{selectedCustomer.name}</h3>

                {/* Balance */}
                {(() => {
                  const outstanding = selectedCustomer.totalAmount - selectedCustomer.paidAmount;
                  if (outstanding > 0) {
                    return (
                      <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
                        <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">Outstanding Balance</p>
                        <p className="text-2xl font-bold text-amber-700 mt-1">Rs. {outstanding.toLocaleString()}</p>
                      </div>
                    );
                  } else if (outstanding < 0) {
                    return (
                      <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                        <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Advance Balance</p>
                        <p className="text-2xl font-bold text-emerald-700 mt-1">Rs. {Math.abs(outstanding).toLocaleString()}</p>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-4 p-4 bg-neutral-50 rounded-xl border border-border text-center">
                      <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Account Balance</p>
                      <p className="text-2xl font-bold text-neutral-500 mt-1">Rs. 0.00</p>
                    </div>
                  );
                })()}

                {/* Stats block */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
                  <div className="text-left bg-neutral-50 p-3 rounded-lg">
                    <span className="text-[9px] font-medium text-neutral-400 uppercase block">Total Purchases</span>
                    <span className="text-sm font-semibold text-neutral-900 mt-0.5 block">Rs. {selectedCustomer.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="text-left bg-neutral-50 p-3 rounded-lg">
                    <span className="text-[9px] font-medium text-neutral-400 uppercase block">Total Paid</span>
                    <span className="text-sm font-semibold text-neutral-900 mt-0.5 block">Rs. {selectedCustomer.paidAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2 mt-5">
                  {(() => {
                    const outstanding = selectedCustomer.totalAmount - selectedCustomer.paidAmount;
                    const isDues = outstanding > 0;
                    return (
                      <Button 
                        onClick={(e) => handleOpenReceivePayment(selectedCustomer, e)}
                        className="w-full"
                      >
                        <DollarSign className="w-4 h-4 mr-1.5" />
                        {isDues ? "Receive Cash Payment" : "Record Advance Payment"}
                      </Button>
                    );
                  })()}
                  <Button 
                    onClick={(e) => handleOpenEdit(selectedCustomer, e)}
                    variant="outline"
                    className="w-full"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase">Phone</p>
                    <p className="font-medium text-neutral-900">{selectedCustomer.phone || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase">Email</p>
                    <p className="font-medium text-neutral-900">{selectedCustomer.email || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-neutral-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase">Address</p>
                    <p className="font-medium text-neutral-900">{selectedCustomer.address || "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL: TRANSACTIONS */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <Card>
              <CardHeader className="p-0">
                <div className="flex bg-neutral-50 rounded-t-xl p-1 gap-1 border-b border-border">
                  <button 
                    onClick={() => setActiveTab("orders")}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                      activeTab === "orders" 
                        ? 'bg-white text-neutral-900 shadow-sm border border-border' 
                        : 'text-neutral-500 hover:bg-neutral-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" /> Purchases ({customerSales.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab("payments")}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                      activeTab === "payments" 
                        ? 'bg-white text-neutral-900 shadow-sm border border-border' 
                        : 'text-neutral-500 hover:bg-neutral-100'
                    }`}
                  >
                    <History className="w-4 h-4" /> Payments ({selectedCustomer.payments?.length || 0})
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                
                {/* TAB: PURCHASE ORDERS */}
                {activeTab === "orders" && (
                  <div className="space-y-4">
                    {customerSales.length === 0 ? (
                      <div className="text-center py-12 text-neutral-400">
                        <FileText className="w-10 h-10 mx-auto mb-3 text-neutral-200" />
                        <p className="text-sm font-medium">No purchases yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {customerSales.map((sale) => (
                          <div key={sale.id} className="border border-border rounded-xl overflow-hidden">
                            <div className="bg-neutral-50 px-4 py-2.5 border-b border-border flex flex-wrap justify-between items-center gap-2">
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-sm text-neutral-900">#{sale.id}</span>
                                <span className="text-[10px] text-neutral-400">{format(new Date(sale.date), "dd MMM yyyy, h:mm a")}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-neutral-400">Paid:</span>
                                <span className="font-semibold text-emerald-600">Rs. {(sale.amountPaid ?? sale.total).toLocaleString()}</span>
                                <span className="text-xs font-semibold text-neutral-900 ml-1">Rs. {sale.total.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="p-4">
                              <table className="w-full text-xs text-left">
                                <thead className="text-neutral-400 border-b border-border">
                                  <tr>
                                    <th className="pb-1.5 font-medium">Product</th>
                                    <th className="pb-1.5 font-medium text-center w-12">Qty</th>
                                    <th className="pb-1.5 font-medium text-right w-20">Price</th>
                                    <th className="pb-1.5 font-medium text-right w-24">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-neutral-600">
                                  {sale.items?.map((item, idx) => {
                                    const p = products.find((prod) => prod.id === item.productId);
                                    return (
                                      <tr key={idx}>
                                        <td className="py-2 pr-2 font-medium text-neutral-900">{p ? p.name : `SKU #${item.productId}`}</td>
                                        <td className="py-2 text-center font-medium">{item.quantity}</td>
                                        <td className="py-2 text-right">Rs. {item.price.toFixed(2)}</td>
                                        <td className="py-2 text-right font-semibold">Rs. {(item.quantity * item.price).toFixed(2)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "payments" && (
                  <div className="space-y-2">
                    {!selectedCustomer.payments || selectedCustomer.payments.length === 0 ? (
                      <div className="text-center py-12 text-neutral-400">
                        <History className="w-10 h-10 mx-auto mb-3 text-neutral-200" />
                        <p className="text-sm font-medium">No payments recorded yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedCustomer.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-neutral-900">{p.notes || "Payment received"}</p>
                              <p className="text-xs text-neutral-400 mt-0.5">{format(new Date(p.date), "dd MMM yyyy, h:mm a")}</p>
                            </div>
                            <span className="text-base font-semibold text-emerald-700">+ Rs. {p.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* --- CORE DIRECTORY INDEX VIEW --- */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input placeholder="Search by name or phone..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <span className="text-xs text-neutral-400">{filteredCustomers.length} customers</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {filteredCustomers.map((c) => {
              const outstanding = c.totalAmount - c.paidAmount;
              return (
                <div key={c.id} onClick={() => setSelectedCustomerId(c.id)}
                  className="bg-white rounded-xl border border-border p-4 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 text-neutral-500">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-neutral-900 text-sm truncate">{c.name}</h3>
                        <p className="text-xs text-neutral-400">{c.phone || "No phone"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-neutral-400">Purchases</p>
                        <p className="font-semibold text-neutral-900">Rs. {c.totalAmount.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-neutral-400">Status</p>
                        {outstanding > 0 ? (
                          <span className="text-xs font-medium text-amber-600">Rs. {outstanding.toLocaleString()} due</span>
                        ) : outstanding < 0 ? (
                          <span className="text-xs font-medium text-emerald-600">Rs. {Math.abs(outstanding).toLocaleString()} adv.</span>
                        ) : (
                          <span className="text-xs font-medium text-neutral-400">Cleared</span>
                        )}
                      </div>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={e => handleOpenReceivePayment(c, e)} className="p-1.5 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Payment">
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button onClick={e => handleOpenEdit(c, e)} className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={e => handleDelete(c.id, c.name, e)} className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredCustomers.length === 0 && (
              <div className="text-center py-12 text-neutral-400">
                <User className="w-10 h-10 mx-auto mb-3 text-neutral-200" />
                <p className="text-sm font-medium">No customers found</p>
              </div>
            )}
         </div>
        </div>
      )}
      {/* --- MODAL: ADD CUSTOMER --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-border overflow-hidden w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Register Customer</h3>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">Customer / Shop Name <span className="text-rose-500">*</span></label>
                  <Input 
                    placeholder="e.g. Zahid Traders"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">Phone / Mobile</label>
                    <Input 
                      placeholder="e.g. 03001234567"
                      value={formPhone}
                      onChange={(e) => {
                        const onlyNums = e.target.value.replace(/[^0-9]/g, "");
                        setFormPhone(onlyNums);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">Email (Optional)</label>
                    <Input 
                      type="email"
                      placeholder="contact@traders.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">Address</label>
                  <Input 
                    placeholder="e.g. Near Shell Pump, Circular Road"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">Opening Balance</label>
                    <Input 
                      type="number"
                      min="0"
                      value={formOpenBalance}
                      onChange={(e) => setFormOpenBalance(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">Opening Advance</label>
                    <Input 
                      type="number"
                      min="0"
                      value={formOpenPaid}
                      onChange={(e) => setFormOpenPaid(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-neutral-50 px-6 py-4 border-t border-border flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Customer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: EDIT CUSTOMER --- */}
      {showEditModal && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-border overflow-hidden w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Edit Customer</h3>
              <button onClick={() => { setShowEditModal(false); setEditingCustomer(null); }} className="text-neutral-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateCustomer}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">Customer / Shop Name <span className="text-rose-500">*</span></label>
                  <Input 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">Phone / Mobile</label>
                    <Input 
                      placeholder="e.g. 03001234567"
                      value={formPhone}
                      onChange={(e) => {
                        const onlyNums = e.target.value.replace(/[^0-9]/g, "");
                        setFormPhone(onlyNums);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">Email (Optional)</label>
                    <Input 
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                    />
                  </div>
                </div>
                 <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">Address</label>
                  <Input 
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">Opening Balance</label>
                    <Input 
                      type="number"
                      min="0"
                      value={formOpenBalance}
                      onChange={(e) => setFormOpenBalance(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">Opening Advance</label>
                    <Input 
                      type="number"
                      min="0"
                      value={formOpenPaid}
                      onChange={(e) => setFormOpenPaid(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-neutral-50 px-6 py-4 border-t border-border flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setShowEditModal(false); setEditingCustomer(null); }}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: RECEIVE PAYMENT --- */}
      {showPaymentModal && editingCustomer && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-border overflow-hidden w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Receive Payment</h3>
              <button onClick={() => { setShowPaymentModal(false); setEditingCustomer(null); }} className="text-neutral-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="p-6 space-y-4">
                {(() => {
                  const outstanding = editingCustomer.totalAmount - editingCustomer.paidAmount;
                  const enteredVal = parseFloat(paymentAmount) || 0;
                  
                  let clearDebt = 0;
                  let addToAdvance = 0;
                  if (outstanding > 0) {
                    clearDebt = Math.min(outstanding, enteredVal);
                    addToAdvance = Math.max(0, enteredVal - outstanding);
                  } else {
                    addToAdvance = enteredVal;
                  }
                  
                  const nextOutstanding = Math.max(0, outstanding - clearDebt);
                  const baseAdvanceCredit = outstanding < 0 ? Math.abs(outstanding) : 0;
                  const nextAdvance = baseAdvanceCredit + addToAdvance;

                  return (
                    <>
                      <div className={`p-3.5 rounded-xl border ${outstanding > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} text-sm`}>
                        <p className="font-medium text-neutral-900">{editingCustomer.name}</p>
                        {outstanding > 0 ? (
                          <p className="text-xs text-amber-600 mt-1">Outstanding: <strong>Rs. {outstanding.toLocaleString()}</strong></p>
                        ) : (
                          <p className="text-xs text-emerald-600 mt-1">All cleared. Advance: <strong>Rs. {baseAdvanceCredit.toLocaleString()}</strong></p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-neutral-500">Amount Received <span className="text-rose-500">*</span></label>
                        <Input 
                          type="number"
                          placeholder="e.g. 5000"
                          min="1"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          required
                        />
                      </div>

                      {enteredVal > 0 && (
                        <div className="bg-neutral-50 border border-border p-3.5 rounded-xl space-y-2 text-xs">
                          <p className="font-medium text-neutral-400 uppercase text-[10px] tracking-wider">Calculation</p>
                          {clearDebt > 0 && (
                            <div className="flex justify-between">
                              <span className="text-neutral-500">Clears debt:</span>
                              <span className="font-semibold font-mono">Rs. {clearDebt.toLocaleString()}</span>
                            </div>
                          )}
                          {addToAdvance > 0 && (
                            <div className="flex justify-between">
                              <span className="text-emerald-600 font-medium">Added to advance:</span>
                              <span className="font-semibold font-mono text-emerald-700">+ Rs. {addToAdvance.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="border-t border-border pt-2 space-y-1">
                            {outstanding > 0 && (
                              <div className="flex justify-between text-neutral-500">
                                <span>New outstanding:</span>
                                <span className="font-semibold">Rs. {nextOutstanding.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-medium text-emerald-800">
                              <span>New advance:</span>
                              <span className="font-mono">Rs. {nextAdvance.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">Note</label>
                  <Input 
                    placeholder="e.g. Paid via Zahid's brother"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="bg-neutral-50 px-6 py-4 border-t border-border flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setShowPaymentModal(false); setEditingCustomer(null); }}>
                  Cancel
                </Button>
                {(() => {
                  const outstanding = editingCustomer.totalAmount - editingCustomer.paidAmount;
                  const enteredVal = parseFloat(paymentAmount) || 0;
                  return (
                    <Button type="submit">
                      {outstanding > 0 && enteredVal > outstanding ? "Pay & Add Advance" : outstanding > 0 ? "Record Payment" : "Add Advance"}
                    </Button>
                  );
                })()}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
