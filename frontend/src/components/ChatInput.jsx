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
    <form onSubmit={handleSubmit} className="relative p-3 bg-slate-900/90 border-t border-slate-800 backdrop-blur-md">
      <div className="relative flex items-end">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask any question about this document..."
          disabled={disabled}
          className="w-full pr-12 pl-4 py-3 bg-slate-950/80 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition resize-none disabled:opacity-50 max-h-36 overflow-y-auto leading-relaxed"
          style={{ minHeight: '44px' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className="absolute right-2 bottom-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-40 disabled:hover:bg-indigo-600 shadow-md shadow-indigo-600/30"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-500">
        <span className="flex items-center space-x-1 text-indigo-400">
          <Sparkles className="w-3 h-3" />
          <span>Grounded in document content</span>
        </span>
        <span>
          Press <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400 text-[10px]">Enter ↵</kbd> to send, <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400 text-[10px]">Shift+Enter</kbd> for new line
        </span>
      </div>
    </form>
  );
}
