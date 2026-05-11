"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, Sparkles, Loader2, AlertCircle, Plus, Trash2, Download, Paperclip } from 'lucide-react';
import api from '@/lib/api';
import { PageTransition } from '@/components/PageTransition';

interface Thread {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_preview: string;
}

interface Message {
  id: number;
  thread: number;
  role: 'ai' | 'user' | 'system';
  content: string;
  created_at: string;
}

interface Attachment {
  id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  file_url: string | null;
  created_at: string;
}

export default function AIChat() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadThreads = async () => {
    try {
      setLoadingThreads(true);
      const res = await api.get('ai/threads/');
      const fetchedThreads: Thread[] = res.data ?? [];
      setThreads(fetchedThreads);

      if (fetchedThreads.length > 0) {
        setSelectedThreadId((prev) => prev ?? fetchedThreads[0].id);
      } else {
        const created = await api.post('ai/threads/', { title: 'New chat' });
        setThreads([created.data]);
        setSelectedThreadId(created.data.id);
      }
    } catch (err) {
      console.error('Failed to load threads:', err);
      setError('Unable to load chat threads.');
    } finally {
      setLoadingThreads(false);
    }
  };

  const loadMessagesAndAttachments = async (threadId: number) => {
    try {
      const [msgRes, exportRes] = await Promise.all([
        api.get(`ai/threads/${threadId}/messages/`),
        api.get(`ai/threads/${threadId}/export/`),
      ]);
      setMessages(msgRes.data ?? []);
      setAttachments(exportRes.data?.attachments ?? []);
    } catch (err) {
      console.error('Failed to load messages/attachments:', err);
      setError('Unable to load conversation history.');
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (!selectedThreadId) return;
    loadMessagesAndAttachments(selectedThreadId);
  }, [selectedThreadId]);

  const createThread = async () => {
    try {
      const res = await api.post('ai/threads/', { title: 'New chat' });
      setThreads((prev) => [res.data, ...prev]);
      setSelectedThreadId(res.data.id);
    } catch (err) {
      console.error('Create thread failed:', err);
      setError('Unable to create a new chat.');
    }
  };

  const deleteThread = async (threadId: number) => {
    try {
      await api.delete(`ai/threads/${threadId}/`);
      const nextThreads = threads.filter((t) => t.id !== threadId);
      setThreads(nextThreads);
      if (selectedThreadId === threadId) {
        setSelectedThreadId(nextThreads[0]?.id ?? null);
      }
      if (nextThreads.length === 0) {
        await createThread();
      }
    } catch (err) {
      console.error('Delete thread failed:', err);
      setError('Unable to delete chat.');
    }
  };

  const renameThreadIfNeeded = async (threadId: number, firstUserMessage: string) => {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread || thread.title !== 'New chat') return;

    const title = firstUserMessage.slice(0, 60);
    try {
      await api.patch(`ai/threads/${threadId}/`, { title });
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, title } : t)));
    } catch {
      // non-blocking
    }
  };

  const sendChat = async () => {
    if (!input.trim() || loading || !selectedThreadId) return;

    const userText = input.trim();
    const tempUserMessage: Message = {
      id: Date.now(),
      thread: selectedThreadId,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };
    const tempAiMessageId = Date.now() + 1;
    const tempAiMessage: Message = {
      id: tempAiMessageId,
      thread: selectedThreadId,
      role: 'ai',
      content: '',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMessage, tempAiMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      await renameThreadIfNeeded(selectedThreadId, userText);

      const token = localStorage.getItem('token');
      const baseURL = api.defaults.baseURL || '/api/';
      const res = await fetch(`${baseURL}ai/threads/${selectedThreadId}/chat/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: userText }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Streaming failed with status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          if (!evt.startsWith('data: ')) continue;
          const payload = JSON.parse(evt.slice(6));
          if (payload.type === 'chunk') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAiMessageId ? { ...m, content: m.content + payload.text } : m
              )
            );
          }
        }
      }

      await loadMessagesAndAttachments(selectedThreadId);
      await loadThreads();
    } catch (err) {
      console.error('Chat error:', err);
      setError('Sorry, I had trouble processing your message. Please try again.');
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          thread: selectedThreadId,
          role: 'ai',
          content: 'Sorry, I had trouble processing your message. Please try again.',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file?: File) => {
    if (!file || !selectedThreadId) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`ai/threads/${selectedThreadId}/attachments/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadMessagesAndAttachments(selectedThreadId);
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Attachment upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportThread = async (format: 'json' | 'csv') => {
    if (!selectedThreadId) return;
    try {
      const response = await api.get(`ai/threads/${selectedThreadId}/export/?format=${format}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chat-thread-${selectedThreadId}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      setError('Export failed.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-120px)] flex gap-4">
        <aside className="w-72 bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-3 flex flex-col">
          <button
            onClick={createThread}
            className="w-full mb-3 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus size={16} /> New chat
          </button>

          <div className="flex-1 overflow-y-auto space-y-2">
            {loadingThreads ? (
              <div className="text-sm text-slate-500">Loading chats...</div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.id}
                  className={`group rounded-lg p-3 cursor-pointer border ${
                    selectedThreadId === thread.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                  onClick={() => setSelectedThreadId(thread.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{thread.title}</p>
                      <p className="text-xs text-slate-500 truncate">{thread.last_message_preview || 'No messages yet'}</p>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteThread(thread.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden flex flex-col transition-colors duration-500">
          <div className="border-b dark:border-slate-800 p-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{selectedThread?.title || 'AI Assistant'}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Sparkles size={12} className="text-amber-500" />
                Context-aware assistant for usage, bills, and support
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportThread('json')}
                disabled={!selectedThreadId}
                className="px-3 py-2 text-xs border rounded-lg flex items-center gap-1 dark:border-slate-700 cursor-pointer disabled:cursor-not-allowed"
              >
                <Download size={14} /> JSON
              </button>
              <button
                onClick={() => exportThread('csv')}
                disabled={!selectedThreadId}
                className="px-3 py-2 text-xs border rounded-lg flex items-center gap-1 dark:border-slate-700 cursor-pointer disabled:cursor-not-allowed"
              >
                <Download size={14} /> CSV
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div
                key={`${m.id}-${i}`}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[80%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${m.role === 'user'
                    ? 'bg-blue-600'
                    : 'bg-gradient-to-br from-blue-500 to-purple-600'
                    }`}>
                    {m.role === 'user' ? (
                      <User size={16} className="text-white" />
                    ) : (
                      <Bot size={16} className="text-white" />
                    )}
                  </div>

                  <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-4 rounded-2xl transition-colors ${m.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md shadow-lg shadow-blue-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
                        }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    </div>
                    <span className="text-xs text-slate-400 mt-1 px-1">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[80%]">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md p-4 transition-colors">
                    <div className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center gap-2 transition-colors">
                  <AlertCircle size={16} className="text-red-500 dark:text-red-400" />
                  <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/50 transition-colors">
            <div className="mb-3 flex flex-wrap gap-2">
              {attachments.slice(-6).map((a) => (
                <a
                  key={a.id}
                  href={a.file_url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2 py-1 rounded-full border dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  {a.original_name}
                </a>
              ))}
            </div>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  className="w-full p-3 pr-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:cursor-not-allowed transition-all"
                  placeholder="Ask about your usage, bills, or get help..."
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hidden sm:block">
                  Press Enter to send
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg,.pdf,.txt,.csv"
                onChange={(e) => handleUpload(e.target.files?.[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !selectedThreadId}
                className="px-3 py-3 border dark:border-slate-700 rounded-xl cursor-pointer disabled:cursor-not-allowed"
                title="Attach file"
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
              </button>
              <button
                onClick={sendChat}
                disabled={loading || !input.trim() || !selectedThreadId}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 py-1 transition-colors">Try asking:</span>
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
                  className="text-xs px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
