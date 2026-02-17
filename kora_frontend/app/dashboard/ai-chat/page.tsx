"use client";

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface Message {
  role: 'ai' | 'user';
  text: string;
  timestamp?: Date;
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'ai', 
      text: 'Hello! I am your Kora Assistant. How can I help with your utilities today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChat = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    const userMsg: Message = { 
      role: 'user', 
      text: userText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('ai/chat/', { message: userText });
      const aiMsg: Message = { 
        role: 'ai', 
        text: res.data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setError('Sorry, I had trouble processing your message. Please try again.');
      // Add error message as AI response
      const errorMsg: Message = { 
        role: 'ai', 
        text: 'Sorry, I had trouble processing your message. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Bot className="text-blue-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Assistant</h1>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <Sparkles size={14} className="text-amber-500" />
              Powered by AI - Ask about your usage, bills, or get support
            </p>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div 
              key={i} 
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[80%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  m.role === 'user' 
                    ? 'bg-blue-600' 
                    : 'bg-gradient-to-br from-blue-500 to-purple-600'
                }`}>
                  {m.role === 'user' ? (
                    <User size={16} className="text-white" />
                  ) : (
                    <Bot size={16} className="text-white" />
                  )}
                </div>

                {/* Message Bubble */}
                <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`p-4 rounded-2xl ${
                      m.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-md' 
                        : 'bg-slate-100 text-slate-800 rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 px-1">
                    {m.timestamp ? formatTime(m.timestamp) : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[80%]">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-bl-md p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                    <span className="text-sm text-slate-600">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4 bg-slate-50">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input 
                value={input} 
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                className="w-full p-3 pr-12 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed transition-all" 
                placeholder="Ask about your usage, bills, or get help..."
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hidden sm:block">
                Press Enter to send
              </span>
            </div>
            <button 
              onClick={sendChat} 
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>

          {/* Suggested Questions */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 py-1">Try asking:</span>
            {[
              "What's my current usage?",
              "How much is my pending bill?",
              "Why is my bill high this month?",
              "How can I save energy?"
            ].map((question, idx) => (
              <button
                key={idx}
                onClick={() => setInput(question)}
                disabled={loading}
                className="text-xs px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-colors disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Beta Notice */}
      <div className="mt-4 text-center">
        <p className="text-xs text-slate-400">
          AI Assistant is currently in beta. Responses may not always be accurate.
        </p>
      </div>
    </div>
  );
}
