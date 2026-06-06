import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function Logo({ className = "", size = "md", showText = true }: LogoProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
    xl: "text-4xl"
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${sizeClasses[size]} relative flex-shrink-0 flex items-center justify-center`}>
        {/* Soft glowing backdrop */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-300 via-purple-300 to-emerald-200 rounded-2xl blur-[6px] opacity-60"></div>
        
        {/* Premium 3D SVG Shape */}
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="relative w-full h-full drop-shadow-md"
        >
          <defs>
            <linearGradient id="auraGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <linearGradient id="auraAccent" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <filter id="glass" x="0" y="0" width="100" height="100">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.1" />
            </filter>
          </defs>
          
          {/* Base shape */}
          <rect x="10" y="10" width="80" height="80" rx="24" fill="url(#auraGradient)" filter="url(#glass)" />
          
          {/* Interlocking geometric aesthetics */}
          <path d="M30 40C30 34.4772 34.4772 30 40 30H70V50C70 61.0457 61.0457 70 50 70H30V40Z" fill="url(#auraAccent)" opacity="0.9" />
          <path d="M70 60C70 65.5228 65.5228 70 60 70H30V50C30 38.9543 38.9543 30 50 30H70V60Z" fill="white" opacity="0.4" />
          
          {/* Inner crystal reflection */}
          <circle cx="50" cy="50" r="12" fill="white" opacity="0.8" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className={`font-extrabold tracking-tight text-slate-800 ${textSizeClasses[size]} leading-none`}>
            Aura
          </span>
          {size !== 'sm' && (
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mt-0.5">
              Workspace
            </span>
          )}
        </div>
      )}
    </div>
  );
}
