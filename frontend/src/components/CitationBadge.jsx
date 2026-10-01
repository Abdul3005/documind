import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronUp, CheckCircle, FileText, Copy, Check } from 'lucide-react';

export default function CitationBadge({ sources = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);

  if (!Array.isArray(sources) || sources.length === 0) {
    return null;
  }

  const handleCopyChunk = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  return (
    <div className="mt-3 pt-2.5 border-t border-slate-800/80">
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Answer grounded in retrieved document context</span>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/60 hover:border-emerald-700/80 rounded-full text-xs font-medium shadow-sm hover:shadow-[0_0_12px_rgba(16,185,129,0.2)] transition-all duration-150 active:scale-95 focus-visible:ring-1 focus-visible:ring-emerald-500"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>{sources.length} {sources.length === 1 ? 'Chunk Source' : 'Chunk Sources'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5 space-y-2.5 p-3.5 glass-panel rounded-xl border border-white/10 text-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] shadow-soft-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-emerald-300">
              Retrieved RAG Vector Chunks:
            </p>
            <span className="text-[10px] text-slate-300/90 font-medium">Click a chunk to preview excerpt</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {sources.map((src, idx) => {
              const scorePct = src.similarity != null ? (src.similarity * 100).toFixed(1) : null;
              const isSelected = selectedChunk === idx;

              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setSelectedChunk(isSelected ? null : idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] transition-all duration-200 text-left cursor-pointer active:scale-95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ${
                    isSelected
                      ? 'bg-emerald-950/70 border-emerald-600 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : 'bg-slate-900/80 border-slate-800 hover:border-emerald-700/60 hover:-translate-y-0.5 hover:shadow-md text-slate-300/90 hover:text-emerald-200'
                  }`}
                  title="Click to view chunk text snippet"
                >
                  <span className="font-mono text-slate-200 font-semibold">Chunk #{src.chunkIndex}</span>
                  {scorePct && (
                    <span className="text-slate-300/90 font-medium ml-2">
                      Sim: <span className="text-emerald-400 font-semibold">{scorePct}%</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Popover / Expanded Preview for Selected Chunk */}
          {selectedChunk !== null && sources[selectedChunk] && (
            <div className="mt-2.5 p-3.5 bg-slate-950/80 rounded-xl border border-emerald-900/40 text-xs space-y-2.5 shadow-soft-sm">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center space-x-1.5 text-slate-300/90 font-medium text-[11px]">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Chunk #{sources[selectedChunk].chunkIndex} Context Snippet</span>
                </div>

                <button
                  onClick={() =>
                    handleCopyChunk(
                      sources[selectedChunk].text ||
                        `Chunk #${sources[selectedChunk].chunkIndex} retrieved with similarity ${(sources[selectedChunk].similarity * 100).toFixed(1)}%`,
                      selectedChunk
                    )
                  }
                  className="flex items-center space-x-1 text-[10px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded-md bg-slate-800/90 hover:bg-slate-750 transition-all border border-slate-700/60 active:scale-95"
                >
                  {copiedIdx === selectedChunk ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed font-sans whitespace-pre-wrap bg-slate-950/80 p-3 rounded-lg border border-slate-850">
                {sources[selectedChunk].text ||
                  'Text chunk extracted from source document and indexed into 768-dimensional vector space.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
