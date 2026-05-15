"use client";
import { useEffect, useState } from 'react';
import { Calendar, Clock, Search, Plus, AlertCircle, Tag } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import api from '@/lib/api';

interface JournalEntry {
  id: number;
  author: number;
  author_username: string;
  occurred_at: string;
  title: string;
  body: string;
  related_alarm_event: number | null;
  related_tag: number | null;
  created_at: string;
}

export default function OperatorJournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [alarms, setAlarms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showNewEntryForm, setShowNewEntryForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    title: '',
    body: '',
    occurred_at: new Date().toISOString().slice(0, 16),
    related_tag: '',
    related_alarm_event: '',
  });

  const loadEntries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('start_time', `${startDate}T00:00:00Z`);
      if (endDate) params.append('end_time', `${endDate}T23:59:59Z`);

      const res = await api.get(`/operations/journal/?${params.toString()}`);
      setEntries(res.data || []);
    } catch (err) {
      console.error('Failed to load journal entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const [tagRes, alarmRes] = await Promise.all([
        api.get('/tags/'),
        api.get('/alarms/events/?state=active'),
      ]);
      setTags(tagRes.data || []);
      setAlarms(alarmRes.data || []);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  useEffect(() => {
    loadEntries();
    loadMetadata();
  }, [startDate, endDate]);

  const createEntry = async () => {
    try {
      await api.post('/operations/journal/', {
        ...newEntry,
        occurred_at: new Date(newEntry.occurred_at).toISOString(),
        related_tag: newEntry.related_tag || null,
        related_alarm_event: newEntry.related_alarm_event || null,
      });
      setNewEntry({
        title: '',
        body: '',
        occurred_at: new Date().toISOString().slice(0, 16),
        related_tag: '',
        related_alarm_event: '',
      });
      setShowNewEntryForm(false);
      loadEntries();
    } catch (err) {
      console.error('Failed to create entry:', err);
      alert('Failed to create entry');
    }
  };

  const filteredEntries = entries.filter(entry =>
    entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.body.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="p-6 max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            Operator Journal
          </h1>
          <p className="text-slate-600 dark:text-slate-300">
            Shift log with event-tied comments and full-text search
          </p>
        </header>

        {/* Controls */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Calendar size={16} className="inline mr-2" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Search size={16} className="inline mr-2" />
                Search
              </label>
              <input
                type="text"
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Actions
              </label>
              <button
                onClick={() => setShowNewEntryForm(!showNewEntryForm)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Plus size={16} /> New Entry
              </button>
            </div>
          </div>
        </div>

        {/* New Entry Form */}
        {showNewEntryForm && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-6 mb-8 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Plus className="text-blue-600" size={24} />
              New Log Entry
            </h2>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                    Event Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newEntry.occurred_at}
                    onChange={(e) => setNewEntry({ ...newEntry, occurred_at: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="Short summary of event..."
                    value={newEntry.title}
                    onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                    Linked Tag (Optional)
                  </label>
                  <select
                    value={newEntry.related_tag}
                    onChange={(e) => setNewEntry({ ...newEntry, related_tag: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  >
                    <option value="">No tag linked</option>
                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                    Linked Alarm (Optional)
                  </label>
                  <select
                    value={newEntry.related_alarm_event}
                    onChange={(e) => setNewEntry({ ...newEntry, related_alarm_event: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  >
                    <option value="">No alarm linked</option>
                    {alarms.map(a => <option key={a.id} value={a.id}>{a.rule_name || a.message}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                  Detailed Observations
                </label>
                <textarea
                  placeholder="What happened? What actions were taken?..."
                  value={newEntry.body}
                  onChange={(e) => setNewEntry({ ...newEntry, body: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowNewEntryForm(false)}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Discard
                </button>
                <button
                  onClick={createEntry}
                  className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all"
                >
                  Post Entry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entries List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-slate-500">Retrieving shift logs...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-24 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-slate-500 text-lg">No log entries found for this period</p>
            <button onClick={() => setShowNewEntryForm(true)} className="mt-4 text-blue-600 font-bold hover:underline">Create the first one</button>
          </div>
        ) : (
          <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            {filteredEntries.map((entry, idx) => (
              <div key={entry.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                {/* Dot */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 group-[.is-active]:bg-blue-600 group-[.is-active]:text-white transition-all duration-500 group-hover:scale-125 z-10">
                  <Clock size={16} />
                </div>
                {/* Card */}
                <div className="w-[calc(100%-4rem)] md:w-[45%] bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
                  <div className="flex items-center justify-between space-x-2 mb-1">
                    <time className="font-mono text-sm font-bold text-blue-600">
                      {new Date(entry.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                    <span className="text-xs text-slate-400">{new Date(entry.occurred_at).toLocaleDateString()}</span>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white text-lg mb-2">{entry.title}</div>
                  <div className="text-slate-600 dark:text-slate-400 text-sm mb-4 leading-relaxed">{entry.body}</div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {entry.related_alarm_event && (
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold rounded uppercase flex items-center gap-1">
                        <AlertCircle size={10} /> Linked Alarm
                      </span>
                    )}
                    {entry.related_tag && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold rounded uppercase flex items-center gap-1">
                        <Tag size={10} /> Tag Event
                      </span>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                        {entry.author_username ? entry.author_username[0].toUpperCase() : 'U'}
                      </div>
                      <span className="text-xs font-medium text-slate-500">{entry.author_username}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
