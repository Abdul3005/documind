import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'error', onClose, duration = 6000 }) {
  useEffect(() => {
    if (!message || !onClose || duration <= 0) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  const isSuccess = type === 'success';
  const isInfo = type === 'info';

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm sm:max-w-md w-full px-4 pointer-events-none transition-all duration-300">
      <div
        className={`pointer-events-auto flex items-start justify-between p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] ${
          isSuccess
            ? 'bg-emerald-950/90 border-emerald-700/60 text-emerald-200 shadow-emerald-950/50'
            : isInfo
            ? 'bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-slate-950/50'
            : 'bg-red-950/90 border-red-700/60 text-red-200 shadow-red-950/50'
        }`}
      >
        <div className="flex items-start space-x-3 pr-2">
          {isSuccess ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : isInfo ? (
            <Info className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="text-xs sm:text-sm font-medium leading-snug">
            {message}
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition shrink-0 ml-2"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
