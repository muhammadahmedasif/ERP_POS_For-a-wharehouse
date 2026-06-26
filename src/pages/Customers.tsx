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
  CreditCard,
  History,
  Trash2,
  Edit,
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  X,
  PlusCircle,
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
      .then((data) => setSales(data))
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
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {selectedCustomer ? "Customer Account Details" : "Customer Accounts List"}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {selectedCustomer 
              ? `View billing history, outstanding balance, and payments for ${selectedCustomer.name}`
              : "Keep track of customer accounts, outstanding balances, and advanced credits."}
          </p>
        </div>
        
        {!selectedCustomerId ? (
          <Button onClick={handleOpenAdd} className="bg-indigo-600 hover:bg-slate-800 font-bold text-xs h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Add New Customer
          </Button>
        ) : (
          <Button 
            variant="outline" 
            onClick={() => setSelectedCustomerId(null)} 
            className="border-slate-200 hover:bg-slate-50 text-xs font-bold h-9"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Directory
          </Button>
        )}
      </div>

      {/* --- SCROLLING PROFILE DETAIL VIEW --- */}
      {selectedCustomer ? (
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* LEFT PANEL: PROFILE SPECIFICATIONS & DIRECT ACTIONS */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <Card className="border border-slate-200">
              <CardContent className="p-6 text-center">
                {/* Avatar Badge */}
                <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100 text-indigo-600 mb-4 shadow-inner">
                  <User className="w-8 h-8" />
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 leading-tight">{selectedCustomer.name}</h3>
                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full inline-block mt-2 font-mono uppercase tracking-widest">
                  REGISTERED ACCOUNT
                </span>

                {/* Outstanding balance calculations */}
                {(() => {
                  const outstanding = selectedCustomer.totalAmount - selectedCustomer.paidAmount;
                  if (outstanding > 0) {
                    return (
                      <div className="mt-6 space-y-3">
                        <div className="p-4 rounded-xl border bg-amber-50/50 border-amber-200 text-amber-900 shadow-sm text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                            Pending bill dues
                          </div>
                          <div className="text-2xl font-black mt-1 font-mono text-amber-700">
                            Rs. {outstanding.toLocaleString()}
                          </div>
                          <div className="text-xs font-semibold mt-1 inline-flex items-center gap-1.5 text-amber-600">
                            <AlertTriangle className="w-3.5 h-3.5" /> Customer has outstanding dues
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Advance Credit</span>
                          <span className="font-mono font-bold text-slate-500">Rs. 0.00</span>
                        </div>
                      </div>
                    );
                  } else if (outstanding < 0) {
                    const absAdvance = Math.abs(outstanding);
                    return (
                      <div className="mt-6 space-y-3">
                        <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-950 shadow-sm text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                            Advance Balance
                          </div>
                          <div className="text-2xl font-black mt-1 font-mono text-emerald-700">
                            Rs. {absAdvance.toLocaleString()}
                          </div>
                          <div className="text-xs font-semibold mt-1 inline-flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle className="w-3.5 h-3.5" /> Paid extra in advance
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Outstanding Dues</span>
                          <span className="font-mono font-bold text-slate-500">Rs. 0.00</span>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="mt-6 space-y-3">
                        <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 text-slate-900 shadow-sm text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Account Balance
                          </div>
                          <div className="text-2xl font-black mt-1 font-mono text-slate-700 font-semibold">
                            Rs. 0.00
                          </div>
                          <div className="text-xs font-semibold mt-1 inline-flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle className="w-3.5 h-3.5" /> Account fully cleared!
                          </div>
                        </div>
                      </div>
                    );
                  }
                })()}

                {/* Stats block */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <div className="text-left bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Total Purchases Bill</span>
                    <span className="text-xs font-bold text-slate-900 mt-1 block font-mono">
                      Rs. {selectedCustomer.totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-left bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Total Bill Paid</span>
                    <span className="text-xs font-bold text-slate-900 mt-1 block font-mono">
                      Rs. {selectedCustomer.paidAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 mt-6">
                  {(() => {
                    const outstanding = selectedCustomer.totalAmount - selectedCustomer.paidAmount;
                    const isDues = outstanding > 0;
                    return (
                      <Button 
                        onClick={(e) => handleOpenReceivePayment(selectedCustomer, e)}
                        className={`w-full text-white font-bold text-xs h-10 shadow-sm ${
                          isDues ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        {isDues ? "Receive Cash Payment" : "Record Advance Payment"}
                      </Button>
                    );
                  })()}
                  <Button 
                    onClick={(e) => handleOpenEdit(selectedCustomer, e)}
                    variant="outline" 
                    className="w-full border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" /> Change Account/Phone/Address Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200">
              <CardHeader className="py-4 border-b border-slate-100">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Phone Number</span>
                    <span className="text-slate-800 font-bold font-mono">{selectedCustomer.phone}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Email Address</span>
                    <span className="text-slate-800 font-bold">{selectedCustomer.email || "No Email Joined"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Billing address</span>
                    <span className="text-slate-800 font-bold leading-tight block mt-0.5">{selectedCustomer.address || "No Address Supplied"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL: TRANSACTION INDEX & PAYMENTS REGISTER */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <Card className="border border-slate-200">
              <CardHeader className="p-0 border-b border-slate-150">
                <div className="flex bg-slate-50 rounded-t-lg p-1.5 gap-1 border-b border-slate-200">
                  <button 
                    onClick={() => setActiveTab("orders")}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-colors ${
                      activeTab === "orders" 
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' 
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <FileText className="w-4 h-4" /> Purchases ({customerSales.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab("payments")}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-colors ${
                      activeTab === "payments" 
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' 
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <History className="w-4 h-4" /> Payments Made ({selectedCustomer.payments?.length || 0})
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                
                {/* TAB 1: ORDERED PRODUCTS LIST */}
                {activeTab === "orders" && (
                  <div className="space-y-6">
                    {customerSales.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-xl">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h4 className="font-bold text-slate-700">No Bills Printed Yet</h4>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                          No bills have been printed for this customer yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {customerSales.map((sale) => (
                          <div key={sale.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/20 shadow-sm hover:border-slate-300 transition-colors">
                            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-indigo-600 text-sm">{sale.id}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {format(new Date(sale.date), "PPP - p")}
                                </span>
                              </div>
                              <div className="text-right flex items-center gap-3">
                                <div className="text-xs">
                                  <span className="text-slate-500 mr-1.5">Paid Cash:</span>
                                  <span className="font-bold text-emerald-600 font-mono">Rs. {(sale.amountPaid ?? sale.total).toLocaleString()}</span>
                                </div>
                                <div className="text-sm rounded bg-indigo-50/50 border border-indigo-100 px-2.5 py-0.5 text-indigo-950 font-black font-mono">
                                  Rs. {sale.total.toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="p-5">
                              <table className="w-full text-xs text-left">
                                <table className="w-full text-xs text-left">
                                  <thead className="text-slate-400 border-b border-slate-200 pb-2">
                                    <tr>
                                      <th className="pb-2 font-bold uppercase text-[10px] tracking-wider text-left">Product Name</th>
                                      <th className="pb-2 font-bold uppercase text-[10px] tracking-wider text-center w-16">Qty</th>
                                      <th className="pb-2 font-bold uppercase text-[10px] tracking-wider text-right w-24">Price</th>
                                      <th className="pb-2 font-bold uppercase text-[10px] tracking-wider text-right w-28">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-600">
                                    {sale.items?.map((item, idx) => {
                                      const p = products.find((prod) => prod.id === item.productId);
                                      return (
                                        <tr key={idx} className="hover:bg-slate-50/30">
                                          <td className="py-2.5 pr-2 font-semibold text-slate-800">
                                            {p ? p.name : `SKU #${item.productId}`}
                                          </td>
                                          <td className="py-2.5 text-center font-bold text-slate-500 font-mono">{item.quantity}</td>
                                          <td className="py-2.5 text-right text-slate-500 font-mono">Rs. {item.price.toFixed(2)}</td>
                                          <td className="py-2.5 text-right font-bold text-slate-700 font-mono">Rs. {(item.quantity * item.price).toFixed(2)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "payments" && (
                  <div className="space-y-3">
                    {!selectedCustomer.payments || selectedCustomer.payments.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-xl">
                        <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <h4 className="font-bold text-slate-700">No Payments Yet</h4>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                          Record a payment from this customer when they pay their dues.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedCustomer.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{p.notes || "Payment received"}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{format(new Date(p.date), "dd MMM yyyy, h:mm a")}</p>
                            </div>
                            <span className="text-base font-black text-emerald-700 font-mono">+ Rs. {p.amount.toLocaleString()}</span>
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
        <div className="space-y-6">
          <Card className="border border-slate-200">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center w-full">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search customer by name or phone..."
                    className="pl-9 h-10 border border-slate-220 placeholder:text-slate-400 text-sm focus:border-indigo-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-bold bg-slate-100 border border-slate-200 rounded px-2 py-1">
                    Total: {filteredCustomers.length} Accounts Checked
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 gap-3 p-4">
                {filteredCustomers.map((c) => {
                  const outstanding = c.totalAmount - c.paidAmount;
                  const hasOutstanding = outstanding > 0;
                  return (
                    <div 
                      key={c.id} 
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="bg-white rounded-xl p-4 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-300 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          <User className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-800 text-lg truncate group-hover:text-indigo-600 transition-colors">
                            {c.name}
                          </h3>
                          <p className="text-sm text-slate-500 truncate mt-0.5">{c.phone || "No Phone Number"}</p>
                          <p className="text-xs text-slate-400 mt-1 truncate" title={c.address}>{c.address || "No Address Added"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                          <div className="mt-1">
                            {outstanding > 0 ? (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                                Owes Rs. {outstanding.toLocaleString()}
                              </span>
                            ) : outstanding < 0 ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                Adv: Rs. {Math.abs(outstanding).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                Cleared
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right ml-4">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Purchases</p>
                          <p className="font-bold text-slate-800 text-lg">Rs. {c.totalAmount.toLocaleString()}</p>
                        </div>

                        <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleOpenReceivePayment(c, e)}
                            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                            title={outstanding > 0 ? "Clear Ledger Payment" : "Record Advance Payment"}
                          >
                            <DollarSign className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => handleOpenEdit(c, e)}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Modify Profile"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(c.id, c.name, e)}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Delete Account"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-medium">
                    <User className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No regular customers registered matching search parameters.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- MODAL 1: ADD NEW CUSTOMER SLIDEOVER/DIALOG --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-150 overflow-hidden w-full max-w-lg animate-in fade-in zoom-in duration-205">
            <div className="bg-[#0f172a] text-white p-5 flex items-center justify-between border-b border-slate-800">
              <h3 className="font-bold text-sm tracking-wide uppercase">Register Customer Account</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="p-6 space-y-4 text-xs font-semibold">
                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide block">Customer / Shop Name <span className="text-red-500">*</span></label>
                  <Input 
                    placeholder="e.g. Zahid Traders, Lahore"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="h-10 text-sm border-slate-200 focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-500 uppercase tracking-wide block">Phone / Mobile</label>
                    <Input 
                      placeholder="e.g. 03001234567"
                      value={formPhone}
                      onChange={(e) => {
                        const onlyNums = e.target.value.replace(/[^0-9]/g, "");
                        setFormPhone(onlyNums);
                      }}
                      className="h-10 text-sm border-slate-200 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 uppercase tracking-wide block">Email Address (Optional)</label>
                    <Input 
                      type="email"
                      placeholder="e.g. contact@traders.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="h-10 text-sm border-slate-200"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 uppercase tracking-wide block">Shop/Home Address</label>
                  <Input 
                    placeholder="e.g. Near Shell Pump, Circular Road, Lahore"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="h-10 text-sm border-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-slate-500 uppercase tracking-wide block">Previous Balance Owed (Starting Dues)</label>
                    <Input 
                      type="number"
                      min="0"
                      value={formOpenBalance}
                      onChange={(e) => setFormOpenBalance(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className="h-10 text-sm border-slate-200 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 uppercase tracking-wide block">Previous Advance Credit</label>
                    <Input 
                      type="number"
                      min="0"
                      value={formOpenPaid}
                      onChange={(e) => setFormOpenPaid(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className="h-10 text-sm border-slate-200 font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3.5">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="text-xs h-9 font-bold">
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-slate-800 text-white font-bold text-xs h-9">
                  Create Customer Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: EDIT CUSTOMER DIALOG --- */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-150 overflow-hidden w-full max-w-lg">
            <div className="bg-[#0f172a] text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-wide uppercase">Modify Account Details</h3>
              <button onClick={() => { setShowEditModal(false); setEditingCustomer(null); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateCustomer}>
              <div className="p-6 space-y-4 text-xs font-semibold">
                <div className="space-y-1">
                  <label className="text-slate-500 uppercase block">Customer / Shop Name <span className="text-red-500">*</span></label>
                  <Input 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="h-10 text-sm border-slate-200 focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-500 uppercase block">Phone / Mobile</label>
                    <Input 
                      placeholder="e.g. 03001234567"
                      value={formPhone}
                      onChange={(e) => {
                        const onlyNums = e.target.value.replace(/[^0-9]/g, "");
                        setFormPhone(onlyNums);
                      }}
                      className="h-10 text-sm border-slate-200 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 uppercase block">Email Address (Optional)</label>
                    <Input 
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="h-10 text-sm border-slate-200"
                    />
                  </div>
                </div>
                 <div className="space-y-1">
                  <label className="text-slate-500 uppercase block">Shop/Home Address</label>
                  <Input 
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="h-10 text-sm border-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-slate-500 uppercase block">Previous Balance Owed (Starting Dues)</label>
                    <Input 
                      type="number"
                      min="0"
                      value={formOpenBalance}
                      onChange={(e) => setFormOpenBalance(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className="h-10 text-sm border-slate-200 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 uppercase block">Previous Advance Credit</label>
                    <Input 
                      type="number"
                      min="0"
                      value={formOpenPaid}
                      onChange={(e) => setFormOpenPaid(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className="h-10 text-sm border-slate-200 font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3.5">
                <Button type="button" variant="outline" onClick={() => { setShowEditModal(false); setEditingCustomer(null); }} className="text-xs h-9 font-bold">
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-slate-800 text-white font-bold text-xs h-9">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: RECEIVE LEDGER PAYMENT MODAL --- */}
      {showPaymentModal && editingCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-150 overflow-hidden w-full max-w-sm">
            <div className="bg-[#0f172a] text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-wide uppercase">Receive Cash Payment</h3>
              <button onClick={() => { setShowPaymentModal(false); setEditingCustomer(null); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="p-6 space-y-4 text-xs font-semibold">
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
                      <div className={`p-4 rounded-xl border ${outstanding > 0 ? 'bg-amber-50/50 border-amber-200 text-amber-900 shadow-sm' : 'bg-emerald-50 border-emerald-200 text-emerald-950 shadow-sm'} text-[11px] leading-relaxed`}>
                        <span className="font-bold block text-xs mb-1 text-slate-800">Customer Name: {editingCustomer.name}</span>
                        {outstanding > 0 ? (
                          <span>Outstanding Balance (Pending Owed Bills): <strong className="font-mono text-xs text-rose-700">Rs. {outstanding.toLocaleString()}</strong></span>
                        ) : (
                          <span>All Balances Cleared! Previous Advance balance: <strong className="font-mono text-xs text-emerald-700">Rs. {baseAdvanceCredit.toLocaleString()}</strong></span>
                        )}
                      </div>
 
                      <div className="space-y-1">
                        <label className="text-slate-500 uppercase block">Cash Received <span className="text-red-500">*</span></label>
                        <Input 
                          type="number"
                          placeholder="e.g. 5000"
                          min="1"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          required
                          className="h-11 text-base border-slate-200 font-semibold font-mono text-slate-800"
                        />
                      </div>
 
                      {enteredVal > 0 && (
                        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2 text-[11px] select-none">
                          <span className="font-black text-[9px] uppercase tracking-wider text-slate-400 block mb-1">
                            New Account Calculations
                          </span>
                          
                          {clearDebt > 0 && (
                            <div className="flex justify-between font-medium">
                              <span className="text-slate-500">Subtracted from Owed Balance:</span>
                              <span className="font-mono font-bold text-slate-850">Rs. {clearDebt.toLocaleString()}</span>
                            </div>
                          )}
                          
                          {addToAdvance > 0 && (
                            <div className="flex justify-between font-medium">
                              <span className="text-emerald-600 font-bold">Saved to Advance Credit:</span>
                              <span className="font-mono font-bold text-emerald-700">+ Rs. {addToAdvance.toLocaleString()}</span>
                            </div>
                          )}
  
                          <div className="border-t border-slate-200 pt-2 space-y-1">
                            {outstanding > 0 && (
                              <div className="flex justify-between text-slate-500">
                                <span>New Outstanding Balance:</span>
                                <span className="font-mono font-bold text-slate-800">Rs. {nextOutstanding.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-emerald-800 font-semibold">
                              <span>New Advance Balance:</span>
                              <span className="font-mono font-bold text-emerald-700">Rs. {nextAdvance.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                
                <div className="space-y-1">
                  <label className="text-slate-500 uppercase block">Payment Note / Reminder</label>
                  <Input 
                    placeholder="e.g. Paid cash installment via Zahid's brother"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="h-10 text-sm border-slate-200"
                  />
                </div>
              </div>
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setShowPaymentModal(false); setEditingCustomer(null); }} className="text-xs h-9 font-bold">
                  Close
                </Button>
                {(() => {
                  const outstanding = editingCustomer.totalAmount - editingCustomer.paidAmount;
                  const enteredVal = parseFloat(paymentAmount) || 0;
                  const isDues = outstanding > 0;
                  return (
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9">
                      {isDues 
                        ? (enteredVal > outstanding ? "Save & Add Advance" : "Save Payment") 
                        : "Save Advance"}
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
