import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

export default function CitationBadge({ sources = [] }) {
  const [expanded, setExpanded] = useState(false);

  if (!Array.isArray(sources) || sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 pt-2.5 border-t border-slate-800/80">
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Answer grounded in retrieved document context</span>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition text-[10px]"
        >
          <Layers className="w-3 h-3 text-indigo-400" />
          <span>{sources.length} {sources.length === 1 ? 'Chunk Source' : 'Chunk Sources'}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
          <p className="text-[11px] font-semibold text-slate-300 mb-1">Retrieved RAG Vector Chunks:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {sources.map((src, idx) => {
              const scorePct = src.similarity != null ? (src.similarity * 100).toFixed(1) : null;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px]"
                >
                  <span className="font-mono text-indigo-300 font-semibold">Chunk #{src.chunkIndex}</span>
                  {scorePct && (
                    <span className="text-slate-400 font-medium">
                      Sim: <span className="text-emerald-400">{scorePct}%</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
