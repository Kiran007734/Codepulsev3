import React, { useState, useRef, useEffect } from 'react';
import CodePulseLogo from './CodePulseLogo';
import { useLocation } from 'react-router-dom';

const FAQ_CHIPS = [
  "What is CodePulse?",
  "How do I connect a repository?",
  "What does Developer Impact mean?",
  "What is Knowledge Risk?",
  "What is Requirement Mapping?",
  "What pages does CodePulse have?",
];

export default function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Welcome to CodePulse AI! I can answer your questions about this platform. Pick a question below or type your own!',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userText = text.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setIsLoading(true);

    try {
      // Use explicit backend URL as requested for local dev reliability
      const isProd = import.meta.env.PROD;
      const baseUrl = isProd ? (import.meta.env.VITE_API_BASE_URL || 'https://vasanth-sjr-codepulse-api.hf.space') : 'http://localhost:8000';
      
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          contextPath: location.pathname,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      // Use 'reply' field as per new backend requirement
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || data.response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'AI assistant is currently running in guided mode. I can help you understand CodePulse, developer impact, knowledge risks, and more!',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const showFaqChips = messages.length <= 2;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            background: 'rgba(10, 18, 36, 0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          className="border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.15)] w-80 sm:w-96 h-[520px] mb-4 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div
            style={{ background: 'rgba(6, 182, 212, 0.08)' }}
            className="px-4 py-3 flex items-center justify-between border-b border-cyan-500/20"
          >
            <div className="flex items-center gap-3">
              <CodePulseLogo size={28} />
              <div>
                <h3 className="font-semibold text-white text-sm">CodePulse AI</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-slate-400">Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-cyan-600 text-white rounded-br-sm'
                      : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* FAQ Chips */}
            {showFaqChips && !isLoading && (
              <div className="pt-2 space-y-2">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium ml-1">
                  Suggested Questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {FAQ_CHIPS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs px-3 py-1.5 rounded-full border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all duration-200"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '-0.3s' }} />
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '-0.15s' }} />
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{ background: 'rgba(6, 182, 212, 0.05)' }}
            className="px-4 py-3 border-t border-cyan-500/20"
          >
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 bg-slate-800/60 border border-slate-600/50 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2.5 rounded-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative group rounded-full p-1 transition-transform duration-300 ${
          isOpen ? 'scale-90' : 'hover:scale-110'
        }`}
        title="Chat with CodePulse AI"
      >
        <div className="absolute inset-0 bg-cyan-500/25 rounded-full blur-xl group-hover:bg-cyan-400/30 transition-colors" />
        <CodePulseLogo size={56} className="relative z-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
      </button>
    </div>
  );
}
