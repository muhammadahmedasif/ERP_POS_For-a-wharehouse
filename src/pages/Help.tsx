import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Mail, MessageSquare, HelpCircle, HeartHandshake } from "lucide-react";

export default function Help() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="rounded-xl bg-white border border-border shadow-sm p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-medium tracking-widest text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full border border-border">
              Customer Support Center
            </span>
            <h1 className="text-3xl font-medium tracking-tight text-neutral-900 mt-1">How can we help you today?</h1>
            <p className="text-sm text-neutral-500 max-w-lg leading-relaxed">
              Get in touch with our operations desk. Find immediate resolution for billing queries, inventory audits, or general software questions.
            </p>
          </div>
          <div className="p-3 bg-neutral-100 rounded-xl border border-border hidden md:block">
            <HelpCircle className="w-12 h-12 text-primary-600" />
          </div>
        </div>
      </div>

      {/* CHANNELS GRID */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* EMAIL CHANNEL */}
        <Card className="border-border bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-3.5">
              <div className="p-2.5 bg-primary-100 text-primary-600 rounded-xl">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium text-neutral-900">Email Support Desk</CardTitle>
                <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider mt-0.5">Average Response: &lt; 2 Hours</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <p className="text-xs text-neutral-500 leading-relaxed">
              For account changes, developer assistance, custom requests, and business invoices details, shoot an email to our official representative.
            </p>
            <div className="mt-5 p-3 rounded-lg bg-neutral-50 border border-border flex items-center justify-between">
              <a
                href="mailto:muhammadahmedasif13@gmail.com"
                className="text-xs font-mono font-medium text-primary-600 hover:underline"
              >
                muhammadahmedasif13@gmail.com
              </a>
              <span className="text-[9px] font-medium uppercase bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                Direct Inquiry
              </span>
            </div>
          </CardContent>
        </Card>

        {/* PHONE / WHATSAPP CHANNEL */}
        <Card className="border-border bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-3.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium text-neutral-900">WhatsApp & Phone Hotline</CardTitle>
                <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider mt-0.5">Response Time: Immediate</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Need instant assistance with an active sale or barcode scan error? Reach us directly via call or WhatsApp. Available 24/7.
            </p>
            <div className="mt-5 p-3 rounded-lg bg-neutral-50 border border-border flex items-center justify-between">
              <a
                href="https://wa.me/923078526478"
                target="_blank"
                rel="no-referrer"
                className="text-xs font-mono font-medium text-emerald-600 hover:underline"
              >
                03078526478
              </a>
              <span className="text-[9px] font-medium uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                Live Support
              </span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* HELP ARTICLES & FAQS */}
      <Card className="border-border bg-white">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <HeartHandshake className="w-5 h-5 text-primary-600" />
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-neutral-700">Frequently Asked Operational Guide</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 divide-y divide-border">

          <div className="py-4 first:pt-0">
            <h4 className="text-xs font-medium text-neutral-900">How do I process custom client advance payments?</h4>
            <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
              Navigate to the <strong>Customer Accounts Ledger</strong>. Search the customer, click "Record Advance Payment" on card detail actions. The total advance balance will automatically reduce any future total bill automatically when creating new sale invoices.
            </p>
          </div>

          <div className="py-4">
            <h4 className="text-xs font-medium text-neutral-900">What if a barcode scan doesn't fetch products automatically?</h4>
            <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
              First, check if the specific product barcode is registered inside the <strong>Inventory & Stock Control</strong>. If it exists but is not detected, ensure your hardware keyboard language is in English/US standard before barcode scanning.
            </p>
          </div>

          <div className="py-4 last:pb-0">
            <h4 className="text-xs font-medium text-neutral-900">Is data synced across remote logistics networks?</h4>
            <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
              Yes. All inventory entries, customer ledger transactions, and sales invoices are processed through real-time distribution modules connected to clean web databases, keeping operations perfectly synchronized.
            </p>
          </div>

        </CardContent>
      </Card>

    </div>
  );
}
