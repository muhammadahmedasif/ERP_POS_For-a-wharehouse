import React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export function Dialog({ open, onOpenChange, children }: { open: boolean, onOpenChange: (o: boolean) => void, children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => onOpenChange(false)}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("px-6 py-4 border-b border-border flex items-center justify-between", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className }: { children: React.ReactNode, className?: string }) {
  return <h2 className={cn("text-base font-semibold text-neutral-900", className)}>{children}</h2>;
}

export function DialogContent({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn("p-6 overflow-y-auto", className)}>{children}</div>;
}

export function DialogFooter({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn("px-6 py-4 border-t border-border flex items-center justify-end gap-3", className)}>{children}</div>;
}
