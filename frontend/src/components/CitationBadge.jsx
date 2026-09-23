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
          className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition text-[10px] border border-slate-700/60"
        >
          <Layers className="w-3 h-3 text-indigo-400" />
          <span>{sources.length} {sources.length === 1 ? 'Chunk Source' : 'Chunk Sources'}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5 space-y-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800/90 text-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-300">
              Retrieved RAG Vector Chunks:
            </p>
            <span className="text-[10px] text-slate-500">Click a chunk to preview excerpt</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {sources.map((src, idx) => {
              const scorePct = src.similarity != null ? (src.similarity * 100).toFixed(1) : null;
              const isSelected = selectedChunk === idx;

              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setSelectedChunk(isSelected ? null : idx)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg border text-[11px] transition text-left cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-950/70 border-indigo-600/70 text-indigo-200 shadow-md shadow-indigo-950/50'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                  title="Click to view chunk text snippet"
                >
                  <span className="font-mono text-indigo-300 font-semibold">Chunk #{src.chunkIndex}</span>
                  {scorePct && (
                    <span className="text-slate-400 font-medium ml-2">
                      Sim: <span className="text-emerald-400">{scorePct}%</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Popover / Expanded Preview for Selected Chunk */}
          {selectedChunk !== null && sources[selectedChunk] && (
            <div className="mt-2 p-3 bg-slate-900/90 rounded-xl border border-indigo-500/30 text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center space-x-1.5 text-indigo-300 font-medium text-[11px]">
                  <FileText className="w-3.5 h-3.5" />
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
                  className="flex items-center space-x-1 text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition"
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

              <p className="text-[11px] text-slate-300 leading-relaxed font-sans whitespace-pre-wrap bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
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
