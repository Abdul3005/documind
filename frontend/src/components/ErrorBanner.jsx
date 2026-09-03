import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ErrorBanner({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="flex items-center justify-between p-4 mb-4 text-red-200 bg-red-950/80 border border-red-800/60 rounded-xl shadow-lg backdrop-blur-md">
      <div className="flex items-center space-x-3">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 text-red-400 hover:text-white hover:bg-red-900/60 rounded-lg transition"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
