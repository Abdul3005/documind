import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';

export default function ChatInput({ onSendMessage, disabled = false }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative p-3 bg-slate-900/40 border-t border-slate-800/60 backdrop-blur-md">
      <div className="relative flex items-end backdrop-blur-xl bg-slate-900/70 border border-slate-800/80 rounded-2xl p-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:border-emerald-500 focus-within:shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all duration-200">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask any question about this document..."
          disabled={disabled}
          className="w-full pr-12 pl-3 py-2 bg-transparent text-sm text-slate-100 placeholder-slate-400 font-medium focus:outline-none transition-all duration-200 resize-none disabled:opacity-50 max-h-36 overflow-y-auto leading-relaxed border-none"
          style={{ minHeight: '40px' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-semibold rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.45)] transition-all duration-200 disabled:opacity-30 disabled:hover:from-emerald-500 disabled:shadow-none active:scale-95 shrink-0 ml-1 mb-0.5"
          title="Send message"
        >
          <Send className="w-4 h-4 text-slate-950" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-300/90 font-medium">
        <span className="flex items-center space-x-1.5 text-emerald-400 font-medium">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>Grounded in document content</span>
        </span>
        <span className="text-slate-300/90 font-medium">
          Press <kbd className="px-1.5 py-0.5 bg-slate-900/80 rounded border border-slate-800 text-slate-200 font-medium text-[10px]">Enter ↵</kbd> to send, <kbd className="px-1.5 py-0.5 bg-slate-900/80 rounded border border-slate-800 text-slate-200 font-medium text-[10px]">Shift+Enter</kbd> for new line
        </span>
      </div>
    </form>
  );
}
