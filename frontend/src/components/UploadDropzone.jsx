import React, { useState } from 'react';
import { UploadCloud, FileText, Image, CheckCircle, AlertCircle } from 'lucide-react';

export default function UploadDropzone({ onUpload, isUploading = false }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (onUpload) onUpload(file);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (onUpload) onUpload(file);
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
        dragActive
          ? 'border-indigo-400 bg-indigo-950/40 shadow-xl shadow-indigo-500/10 scale-[1.01]'
          : 'border-slate-700/80 hover:border-indigo-500/60 bg-slate-900/40 hover:bg-slate-900/60'
      }`}
    >
      <input
        type="file"
        id="file-upload-input"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleChange}
        disabled={isUploading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />

      <div className="p-4 mb-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
        <UploadCloud className="w-10 h-10 animate-bounce" />
      </div>

      <h4 className="text-lg font-semibold text-slate-200 mb-1">
        {dragActive ? 'Drop your document here' : 'Click or Drag & Drop Document'}
      </h4>
      <p className="text-xs text-slate-400 mb-4">
        Supports PDF documents, JPG, or PNG images (Max 10MB)
      </p>

      <div className="flex items-center space-x-4 text-xs text-slate-400 bg-slate-800/60 px-4 py-2 rounded-xl border border-slate-700/50">
        <span className="flex items-center space-x-1">
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span>PDF Documents</span>
        </span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center space-x-1">
          <Image className="w-3.5 h-3.5 text-emerald-400" />
          <span>OCR Images</span>
        </span>
      </div>

      {selectedFile && (
        <div className="mt-4 p-3 bg-indigo-950/60 border border-indigo-700/50 rounded-xl flex items-center space-x-3 text-xs text-indigo-200">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="font-medium truncate max-w-xs">{selectedFile.name}</span>
          <span className="text-slate-400">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
        </div>
      )}
    </div>
  );
}
