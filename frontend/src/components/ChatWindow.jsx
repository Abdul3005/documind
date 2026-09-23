import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage.jsx';
import ChatInput from './ChatInput.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import { MessageSquare, Bot, Trash2, RotateCcw, Sparkles, AlertCircle } from 'lucide-react';

const STARTER_PROMPTS = [
  'Summarize key points and obligations',
  'List all numbers, dates & financial figures',
  'What are the main findings or conclusions?',
  'Are there any risks, warnings, or penalties?',
];

export default function ChatWindow({
  messages = [],
  onSendMessage,
  onClearChat,
  onRetryLastQuestion,
  lastFailedQuestion = null,
  isLoading = false,
}) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, lastFailedQuestion]);

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/80 border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">AI Document Assistant</h3>
            <p className="text-xs text-slate-400">Ask questions grounded in document text</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {messages.length > 0 && onClearChat && (
            <button
              onClick={onClearChat}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-red-950/40 border border-slate-800 hover:border-red-800/40 rounded-xl transition disabled:opacity-40"
              title="Clear conversation history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}

          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 rounded-full text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>AI Ready</span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/40">
        {messages.length === 0 ? (
          /* Empty Chat State with Starter Prompt Chips */
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-5">
            <div className="p-4 rounded-3xl bg-indigo-950/50 border border-indigo-800/40 text-indigo-400 shadow-xl shadow-indigo-950/40">
              <Bot className="w-10 h-10" />
            </div>

            <div>
              <p className="text-base font-semibold text-slate-200">Start Exploring Your Document</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Ask specific questions or select an interactive starter prompt below to analyze this document with AI.
              </p>
            </div>

            {/* Clickable Starter Prompt Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md pt-2">
              {STARTER_PROMPTS.map((promptText, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage && onSendMessage(promptText)}
                  disabled={isLoading}
                  className="flex items-center space-x-2 p-2.5 bg-slate-900/90 hover:bg-indigo-950/50 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-left text-xs text-slate-300 hover:text-indigo-200 transition shadow-sm group disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition shrink-0" />
                  <span className="line-clamp-2">{promptText}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id || msg._id || Math.random()} message={msg} />)
        )}

        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="flex items-center space-x-2 p-3 text-indigo-400 text-xs bg-slate-900/80 border border-slate-800 rounded-xl w-max shadow-md">
            <LoadingSpinner size="sm" label="" />
            <span>DocuMind is retrieving document context & generating grounded answer...</span>
          </div>
        )}

        {/* Inline Failed Question Retry Banner */}
        {lastFailedQuestion && !isLoading && (
          <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-xl flex items-center justify-between text-xs text-red-200 shadow-md">
            <div className="flex items-center space-x-2 mr-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Failed to send: "{lastFailedQuestion}"</span>
            </div>
            {onRetryLastQuestion && (
              <button
                onClick={onRetryLastQuestion}
                className="flex items-center space-x-1 px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white rounded-lg transition text-[11px] font-medium shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSendMessage={onSendMessage} disabled={isLoading} />
    </div>
  );
}
