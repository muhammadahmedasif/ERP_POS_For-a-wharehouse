import React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export function Dialog({ open, onOpenChange, children }: { open: boolean, onOpenChange: (o: boolean) => void, children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => onOpenChange(false)}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn("px-6 py-4 border-b border-slate-100 flex items-center justify-between", className)}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: React.ReactNode, className?: string }) {
  return <h2 className={cn("text-lg font-bold text-slate-800", className)}>{children}</h2>;
}

export function DialogContent({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn("p-6 overflow-y-auto", className)}>{children}</div>;
}

export function DialogFooter({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn("px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3", className)}>{children}</div>;
}
