import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Mail, Phone, Clock, HelpCircle, MessageSquare, ArrowLeftRight, ShieldCheck, HeartHandshake } from "lucide-react";

export default function Help() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      
      {/* HEADER HERO */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-8 text-white relative overflow-hidden shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-5 left-1/3 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-mono font-extrabold tracking-widest text-indigo-300 bg-indigo-505/30 px-2.5 py-1 rounded-full border border-indigo-400/20">
              Customer Support Center
            </span>
            <h1 className="text-3xl font-black tracking-tight mt-1">How can we help you today?</h1>
            <p className="text-sm text-slate-300 max-w-lg font-medium leading-relaxed">
              Get in touch with our operations desk. Find immediate resolution for billing queries, inventory audits, or general software questions.
            </p>
          </div>
          <div className="p-3 bg-white/10 rounded-2xl border border-white/15 shadow-inner backdrop-blur-md hidden md:block">
            <HelpCircle className="w-12 h-12 text-indigo-300" />
          </div>
        </div>
      </div>

      {/* CHANNELS GRID */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* EMAIL CHANNEL */}
        <Card className="border border-slate-100 hover:border-slate-200 transition-all hover:shadow-xs group duration-250 bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-3.5">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-black text-slate-800">Email Support Desk</CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Average Response: &lt; 2 Hours</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              For account changes, developer assistance, custom requests, and business invoices details, shoot an email to our official representative.
            </p>
            <div className="mt-5 p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <a 
                href="mailto:muhammadahmedasif13@gmail.com" 
                className="text-xs font-mono font-bold text-indigo-600 hover:underline hover:text-indigo-750"
              >
                muhammadahmedasif13@gmail.com
              </a>
              <span className="text-[9px] font-extrabold uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                Direct Inquiry
              </span>
            </div>
          </CardContent>
        </Card>

        {/* PHONE / WHATSAPP CHANNEL */}
        <Card className="border border-slate-100 hover:border-slate-200 transition-all hover:shadow-xs group duration-250 bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-3.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-black text-slate-800">WhatsApp & Phone Hotline</CardTitle>
                <p className="text-[10px] text-slate- 400 font-bold uppercase tracking-wider mt-0.5">Response Time: Immediate</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Need instant assistance with an active sale or barcode scan error? Reach us directly via call or WhatsApp. Available 24/7.
            </p>
            <div className="mt-5 p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <a 
                href="https://wa.me/923078526478" 
                target="_blank" 
                rel="no-referrer"
                className="text-xs font-mono font-bold text-emerald-600 hover:underline hover:text-emerald-700"
              >
                03078526478
              </a>
              <span className="text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                Live Support
              </span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* HELP ARTICLES & ACCORDION FAQS */}
      <Card className="border border-slate-100 shadow-xs bg-white">
        <CardHeader className="pb-4 border-b border-slate-50">
          <div className="flex items-center space-x-2">
            <HeartHandshake className="w-5 h-5 text-indigo-600" />
            <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-slate-700">Frequently Asked Operational Guide</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 divide-y divide-slate-100">
          
          <div className="py-4 first:pt-0">
            <h4 className="text-xs font-black text-slate-800">How do I process custom client advance payments?</h4>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed font-medium">
              Navigate to the <strong>Customer Accounts Ledger</strong>. Search the customer, click "Record Advance Payment" on card detail actions. The total advance balance will automatically reduce any future total bill automatically when creating new sale invoices.
            </p>
          </div>

          <div className="py-4">
            <h4 className="text-xs font-black text-slate-800">What if a barcode scan doesn't fetch products automatically?</h4>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed font-semibold">
              First, check if the specific product barcode is registered inside the <strong>Inventory & Stock Control</strong>. If it exists but is not detected, ensure your hardware keyboard language is in English/US standard before barcode scanning.
            </p>
          </div>

          <div className="py-4 last:pb-0">
            <h4 className="text-xs font-black text-slate-800">Is data synced across remote logistics networks?</h4>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed font-semibold">
              Yes. All inventory entries, customer ledger transactions, and sales invoices are processed through real-time distribution modules connected to clean web databases, keeping operations perfectly synchronized.
            </p>
          </div>

        </CardContent>
      </Card>

    </div>
  );
}
