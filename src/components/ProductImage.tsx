import React from 'react';
import { Tag } from 'lucide-react';

export const ProductImage = ({ imageUrl, name, className = "w-10 h-10" }: { imageUrl?: string; name: string; className?: string }) => {
  return (
    <div className={`${className} rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0`}>
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <Tag className="w-4 h-4 text-slate-400" />
      )}
    </div>
  );
};
