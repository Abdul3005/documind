import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Delete Document',
  message = 'Are you sure you want to delete this document? All associated chat messages and vector embeddings will be permanently removed.',
  confirmLabel = 'Delete Document',
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="max-w-md w-full glass-panel p-6 rounded-2xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] shadow-elevation-3 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-red-950/60 text-red-400 border border-red-800/50 shadow-soft-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent font-bold tracking-tight">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="p-1 text-slate-300/90 hover:text-white rounded-lg active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300/90 font-medium leading-relaxed">{message}</p>

        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-xl border border-slate-700/80 shadow-soft-xs active:scale-95 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold rounded-xl shadow-[0_0_25px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.45)] active:scale-95 transition-all duration-200 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{loading ? 'Deleting...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
