import React from 'react';
import { FileQuestion, Upload } from 'lucide-react';

export default function EmptyState({ title = 'No Documents Found', description = 'Upload your first PDF or image document to start asking questions and generating AI summaries.', onAction }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center glass-panel rounded-2xl border border-slate-800">
      <div className="p-4 mb-4 rounded-2xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
        <FileQuestion className="w-12 h-12" />
      </div>
      <h3 className="text-xl font-semibold text-slate-100 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-md mb-6">{description}</p>
      {onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      )}
    </div>
  );
}
