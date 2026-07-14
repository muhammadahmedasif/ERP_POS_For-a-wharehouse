import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ShoppingCart, Users, LayoutDashboard, FileText, Settings, Bot, HelpCircle, Tag, Award, RotateCcw, PlusCircle } from 'lucide-react';
import { useAppStore } from '../store';

const searchItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, keywords: 'home main' },
  { label: 'New Sale', path: '/sales/new', icon: PlusCircle, keywords: 'create order sell pos' },
  { label: 'Sales History', path: '/sales', icon: ShoppingCart, keywords: 'orders invoices bills' },
  { label: 'Returns', path: '/returns', icon: RotateCcw, keywords: 'refund return exchange' },
  { label: 'Products', path: '/inventory', icon: Package, keywords: 'stock items inventory' },
  { label: 'Categories & Brands', path: '/categories', icon: Tag, keywords: 'taxonomy groups' },
  { label: 'Customers', path: '/customers', icon: Users, keywords: 'clients accounts buyers' },
  { label: 'Top Items', path: '/top-products', icon: Award, keywords: 'best selling popular' },
  { label: 'Reports', path: '/reports', icon: FileText, keywords: 'summary analytics charts' },
  { label: 'Settings', path: '/settings', icon: Settings, keywords: 'configuration preferences' },
  { label: 'AI Assistant', path: '/ai', icon: Bot, keywords: 'help voice chat' },
  { label: 'Help', path: '/help', icon: HelpCircle, keywords: 'support contact' },
];

export default function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { products, customers } = useAppStore();

  const filtered = query.trim()
    ? searchItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.keywords.toLowerCase().includes(query.toLowerCase())
      )
    : searchItems;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const handleSelect = useCallback((path: string) => {
    setOpen(false);
    navigate(path);
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex].path);
    }
  };

  const quickLinks = [
    { label: 'New Sale', path: '/sales/new', icon: PlusCircle },
    { label: 'Add Product', path: '/inventory', icon: Package },
    { label: 'Add Customer', path: '/customers', icon: Users },
  ];

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)} />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl">
        <div className="bg-white rounded-xl shadow-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search pages, products, customers..."
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-neutral-400 text-neutral-900"
            />
            <kbd className="hidden sm:inline-flex text-[10px] font-medium text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded border border-border">ESC</kbd>
          </div>

          {!query && (
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-2">Quick Actions</p>
              <div className="flex gap-2">
                {quickLinks.map(link => (
                  <button
                    key={link.path}
                    onClick={() => handleSelect(link.path)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                  >
                    <link.icon className="w-3.5 h-3.5" />
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-neutral-400">No results found.</div>
            ) : (
              filtered.map((item, i) => (
                <button
                  key={item.path}
                  onClick={() => handleSelect(item.path)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    i === selectedIndex ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[11px] text-neutral-400">
            <span><kbd className="text-[10px] font-medium bg-neutral-100 px-1 py-0.5 rounded border border-border mr-1">↑↓</kbd> Navigate</span>
            <span><kbd className="text-[10px] font-medium bg-neutral-100 px-1 py-0.5 rounded border border-border mr-1">↵</kbd> Open</span>
            <span className="ml-auto"><kbd className="text-[10px] font-medium bg-neutral-100 px-1 py-0.5 rounded border border-border mr-1">⌘K</kbd> Open search</span>
          </div>
        </div>
      </div>
    </>
  );
}
