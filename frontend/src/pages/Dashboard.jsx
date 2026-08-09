import React, { useState } from 'react';
import UploadDropzone from '../components/UploadDropzone.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { FileText, Image, ArrowRight, Trash2, Clock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function Dashboard({ documents = [], onUpload, onSelectDocument, onDeleteDocument, isUploading = false }) {
  // Sample mock fallback data for UI shell demo if array is empty
  const displayDocs = documents.length > 0 ? documents : [
    {
      id: 'mock-1',
      filename: 'DocuMind_Employment_Agreement.pdf',
      fileType: 'pdf',
      status: 'ready',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mock-2',
      filename: 'Invoice_10492_Vendor.png',
      fileType: 'image',
      status: 'ready',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-indigo-950/20 to-slate-900/90">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Document Intelligence Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload PDF contracts or image receipts to extract text, chat with AI, and generate summaries.
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300">
            Total Docs: <span className="font-semibold text-indigo-400">{displayDocs.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300">
            OCR Engine: <span className="font-semibold text-emerald-400">PDF + Tesseract</span>
          </div>
        </div>
      </div>

      {/* Upload Dropzone Section */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span>Upload New Document</span>
        </h2>
        <UploadDropzone onUpload={onUpload} isUploading={isUploading} />
      </div>

      {/* Document Library Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200">Document Library</h2>
          <span className="text-xs text-slate-400">{displayDocs.length} items available</span>
        </div>

        {displayDocs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayDocs.map((doc) => (
              <div
                key={doc.id || doc._id}
                className="group relative glass-card p-5 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-all hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition">
                      {doc.fileType === 'pdf' ? <FileText className="w-6 h-6" /> : <Image className="w-6 h-6 text-emerald-400" />}
                    </div>

                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                        doc.status === 'ready'
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                          : doc.status === 'processing'
                          ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                          : 'bg-red-950/60 text-red-400 border-red-800/50'
                      }`}
                    >
                      {doc.status === 'ready' && <CheckCircle2 className="w-3 h-3" />}
                      {doc.status === 'processing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                      {doc.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                      <span className="capitalize">{doc.status}</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 truncate mb-1" title={doc.filename}>
                    {doc.filename}
                  </h3>

                  <div className="flex items-center space-x-2 text-xs text-slate-400 mb-4">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="uppercase">{doc.fileType}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => onSelectDocument && onSelectDocument(doc)}
                    className="inline-flex items-center space-x-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {onDeleteDocument && (
                    <button
                      onClick={() => onDeleteDocument(doc.id || doc._id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition"
                      title="Delete Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
