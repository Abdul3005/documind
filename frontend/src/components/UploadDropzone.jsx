import React, { useState } from 'react';
import { UploadCloud, FileText, Image, CheckCircle, AlertCircle, X, Loader2, Sparkles, Scan, Database } from 'lucide-react';

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export default function UploadDropzone({
  onUpload,
  isUploading = false,
  uploadProgress = 0,
  uploadStage = 'idle', // 'idle' | 'uploading' | 'processing' | 'indexing' | 'ready'
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState('');

  const validateAndProcessFile = (file) => {
    if (!file) return;
    setValidationError('');

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setValidationError(`Unsupported file type (${ext}). Please upload a PDF, PNG, or JPG document.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setValidationError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 50 MB.`);
      return;
    }

    setSelectedFile(file);
    if (onUpload) onUpload(file);
  };

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
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Inline Validation Error Chip */}
      {validationError && (
        <div className="flex items-center justify-between p-3.5 bg-red-950/70 border border-red-800/60 rounded-xl text-xs text-red-200 shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-medium">{validationError}</span>
          </div>
          <button
            onClick={() => setValidationError('')}
            className="p-1 hover:bg-red-900/50 rounded-lg text-red-400 hover:text-white transition"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Dropzone Container */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
          dragActive
            ? 'border-indigo-400 bg-indigo-950/40 shadow-xl shadow-indigo-500/10 scale-[1.01]'
            : isUploading
            ? 'border-indigo-500/40 bg-slate-900/80 cursor-wait'
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

        {isUploading ? (
          /* Multi-Stage Active Processing Display */
          <div className="w-full max-w-md flex flex-col items-center text-center space-y-4 py-2">
            <div className="relative p-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
            </div>

            <div>
              <h4 className="text-base font-semibold text-slate-100">
                {uploadStage === 'uploading' && `Uploading Document (${uploadProgress}%)`}
                {uploadStage === 'processing' && 'Extracting Text & Running OCR...'}
                {uploadStage === 'indexing' && 'Generating 768-Dim Vector Embeddings...'}
                {uploadStage === 'ready' && 'Document Ingestion Complete!'}
                {uploadStage === 'idle' && 'Processing Document...'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {selectedFile?.name || 'Please wait while DocuMind processes your document'}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/50">
              <div
                className="bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    uploadStage === 'uploading'
                      ? Math.min(uploadProgress, 85)
                      : uploadStage === 'processing'
                      ? 90
                      : uploadStage === 'indexing'
                      ? 96
                      : 100
                  }%`,
                }}
              />
            </div>

            {/* Stepper Status Indicators */}
            <div className="grid grid-cols-3 gap-2 w-full pt-1 text-[11px]">
              <div
                className={`flex items-center justify-center space-x-1 p-1.5 rounded-lg border transition ${
                  uploadStage === 'uploading'
                    ? 'bg-indigo-950/60 border-indigo-700/50 text-indigo-300 font-medium'
                    : 'bg-slate-900 border-slate-800 text-emerald-400'
                }`}
              >
                <UploadCloud className="w-3 h-3" />
                <span>1. Upload</span>
              </div>

              <div
                className={`flex items-center justify-center space-x-1 p-1.5 rounded-lg border transition ${
                  uploadStage === 'processing'
                    ? 'bg-indigo-950/60 border-indigo-700/50 text-indigo-300 font-medium'
                    : uploadStage === 'indexing' || uploadStage === 'ready'
                    ? 'bg-slate-900 border-slate-800 text-emerald-400'
                    : 'bg-slate-900/40 border-slate-800 text-slate-500'
                }`}
              >
                <Scan className="w-3 h-3" />
                <span>2. OCR/Text</span>
              </div>

              <div
                className={`flex items-center justify-center space-x-1 p-1.5 rounded-lg border transition ${
                  uploadStage === 'indexing'
                    ? 'bg-indigo-950/60 border-indigo-700/50 text-indigo-300 font-medium'
                    : uploadStage === 'ready'
                    ? 'bg-slate-900 border-slate-800 text-emerald-400'
                    : 'bg-slate-900/40 border-slate-800 text-slate-500'
                }`}
              >
                <Database className="w-3 h-3" />
                <span>3. Vector Index</span>
              </div>
            </div>
          </div>
        ) : (
          /* Normal Dropzone UI */
          <>
            <div className="p-4 mb-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-105 transition">
              <UploadCloud className="w-10 h-10 animate-bounce" />
            </div>

            <h4 className="text-lg font-semibold text-slate-200 mb-1">
              {dragActive ? 'Drop your document here' : 'Click or Drag & Drop Document'}
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Supports PDF documents, JPG, or PNG images (Max 50MB, PDF max 3000 pages)
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-slate-400 bg-slate-800/60 px-4 py-2 rounded-xl border border-slate-700/50">
              <span className="flex items-center space-x-1">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>PDF Documents (Max 3000 pages)</span>
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="flex items-center space-x-1">
                <Image className="w-3.5 h-3.5 text-emerald-400" />
                <span>OCR Images (PNG/JPG)</span>
              </span>
            </div>

            {selectedFile && !isUploading && (
              <div className="mt-4 p-2.5 bg-indigo-950/60 border border-indigo-700/50 rounded-xl flex items-center space-x-2 text-xs text-indigo-200">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="font-medium truncate max-w-xs">{selectedFile.name}</span>
                <span className="text-slate-400">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
