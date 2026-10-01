import React from 'react';
import { FileQuestion, Upload } from 'lucide-react';

export default function EmptyState({ title = 'No Documents Found', description = 'Upload your first PDF or image document to start asking questions and generating AI summaries.', onAction }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center glass-panel rounded-2xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] shadow-soft-sm">
      <div className="p-4 mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
        <FileQuestion className="w-12 h-12" />
      </div>
      <h3 className="text-xl font-bold bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-slate-300/90 font-medium max-w-md mb-6">{description}</p>
      {onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-sm font-semibold rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.45)] hover:-translate-y-1 active:scale-95 transition-all duration-300 ease-out"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      )}
    </div>
  );
}
