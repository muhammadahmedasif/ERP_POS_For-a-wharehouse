import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function Logo({ className = "", size = "md", showText = true }: LogoProps) {
  const sizeClasses = { sm: "w-6 h-6", md: "w-8 h-8", lg: "w-10 h-10" };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${sizeClasses[size]} relative flex-shrink-0 flex items-center justify-center`}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative w-full h-full">
          <rect x="8" y="8" width="84" height="84" rx="20" fill="#171717" />
          <path d="M32 42C32 36.4772 36.4772 32 42 32H68V50C68 59.9411 59.9411 68 50 68H32V42Z" fill="white" opacity="0.95" />
          <path d="M68 58C68 63.5228 63.5228 68 58 68H32V50C32 40.0589 40.0589 32 50 32H68V58Z" fill="white" opacity="0.3" />
          <circle cx="50" cy="50" r="10" fill="#171717" />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={`font-heading font-extrabold tracking-tight text-neutral-900 ${size === "sm" ? "text-base" : "text-lg"} leading-none`}>
            Aura
          </span>
          {size !== 'sm' && (
            <span className="text-[10px] uppercase tracking-[0.15em] font-medium text-neutral-400 mt-0.5">
              Workspace
            </span>
          )}
        </div>
      )}
    </div>
  );
}
