"use client";
import { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ComposedChart, Area } from 'recharts';
import { Download, Plus, Minus, RotateCcw, Calendar, Tag, ChevronLeft, ChevronRight, MessageSquarePlus, AlertTriangle, Brain, Loader2 } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import api, { alarmApi, aiInsightsApi, type AlarmEvent as AlarmEventType, type AITrendAbnormalityResult } from '@/lib/api';
import { toPng } from 'html-to-image';

interface TrendData {
  timestamp: string;
  [key: string]: number | string | undefined;
}

interface TagInfo {
  id: number;
  name: string;
}

interface SelectedTag extends TagInfo {
  color: string;
}

interface Annotation {
  label: string;
  notes?: string;
  at: string;
}

interface AnnotationInput {
  label: string;
  notes: string;
  at: string;
}

type SeriesPoint = { t: string; v: number };

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export default function TrendsPage() {
  const [data, setData] = useState<TrendData[]>([]);
  const [compareData, setCompareData] = useState<TrendData[]>([]);
  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([]);
  const [startTime, setStartTime] = useState<string>(new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 16));
  const [endTime, setEndTime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState<AnnotationInput>({ label: '', notes: '', at: '' });
  const [alarmOverlay, setAlarmOverlay] = useState(false);
  const [alarmEvents, setAlarmEvents] = useState<AlarmEventType[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AITrendAbnormalityResult | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);

  // Load available tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await api.get('/tags/');
        setAllTags(res.data);
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
    };
    fetchTags();
  }, []);

  // Load trend data
  const loadTrendData = async () => {
    if (selectedTags.length === 0) {
      alert('Please select at least one tag');
      return;
    }

    setLoading(true);
    try {
      // Primary Data
      const tagIdsStr = selectedTags.map(t => t.id).join(',');
      const res = await api.get(`/history/query/?tag_ids=${tagIdsStr}&start=${new Date(startTime).toISOString()}&end=${new Date(endTime).toISOString()}`);
      
      const merged: Record<string, TrendData> = {};
      
      if (res.data.series) {
        Object.entries(res.data.series as Record<string, SeriesPoint[]>).forEach(([tagId, points]) => {
          const tag = selectedTags.find(t => t.id === parseInt(tagId));
          if (!tag) return;
          const tagName = tag.name;
          points.forEach((point) => {
            const timestamp = point.t;
            if (!merged[timestamp]) {
              merged[timestamp] = { timestamp };
            }
            merged[timestamp][tagName] = point.v;
          });
        });
      }

      // Comparison Data
      if (compareMode) {
        const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
        const compStart = new Date(new Date(startTime).getTime() - duration).toISOString();
        const compEnd = new Date(new Date(endTime).getTime() - duration).toISOString();

        const compRes = await api.get(`/history/query/?tag_ids=${tagIdsStr}&start=${compStart}&end=${compEnd}`);
        
        if (compRes.data.series) {
          Object.entries(compRes.data.series as Record<string, SeriesPoint[]>).forEach(([tagId, points]) => {
            const tag = selectedTags.find(t => t.id === parseInt(tagId));
            if (!tag) return;
            const tagName = `${tag.name} (Prev)`;
            points.forEach((point) => {
              // Align by offset time
              const alignedTime = new Date(new Date(point.t).getTime() + duration).toISOString();
              if (!merged[alignedTime]) {
                merged[alignedTime] = { timestamp: alignedTime };
              }
              merged[alignedTime][tagName] = point.v;
            });
          });
        }
      }

      const formattedData = Object.values(merged).sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      setData(formattedData);

      // Load annotations
      const annotRes = await api.get(`/trends/annotations/?tag_id=${selectedTags[0].id}`);
      setAnnotations((annotRes.data || []) as Annotation[]);

      // Load alarm events for overlay
      if (alarmOverlay) {
        try {
          const alarmRes = await alarmApi.listEvents({ tag_id: selectedTags[0].id });
          setAlarmEvents(alarmRes.data || []);
        } catch {
          setAlarmEvents([]);
        }
      }
    } catch (err) {
      console.error('Failed to load trend data:', err);
    } finally {
      setLoading(false);
    }
  };

  const addTag = (tag: TagInfo) => {
    if (!selectedTags.find(t => t.id === tag.id)) {
      const color = COLORS[selectedTags.length % COLORS.length];
      setSelectedTags([...selectedTags, { id: tag.id, name: tag.name, color }]);
    }
  };

  const removeTag = (tagId: number) => {
    setSelectedTags(selectedTags.filter(t => t.id !== tagId));
  };

  const pan = (direction: 'left' | 'right') => {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const duration = end - start;
    const shift = duration * 0.25;

    if (direction === 'left') {
      setStartTime(new Date(start - shift).toISOString().slice(0, 16));
      setEndTime(new Date(end - shift).toISOString().slice(0, 16));
    } else {
      setStartTime(new Date(start + shift).toISOString().slice(0, 16));
      setEndTime(new Date(end + shift).toISOString().slice(0, 16));
    }
  };

  const zoom = (factor: number) => {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const duration = end - start;
    const center = start + duration / 2;
    const newDuration = duration * factor;

    setStartTime(new Date(center - newDuration / 2).toISOString().slice(0, 16));
    setEndTime(new Date(center + newDuration / 2).toISOString().slice(0, 16));
  };

  const handleAddAnnotation = async () => {
    if (!newAnnotation.label || !newAnnotation.at || selectedTags.length === 0) {
      alert('Please select a tag and fill annotation details');
      return;
    }

    try {
      await api.post('/trends/annotations/', {
        tag: selectedTags[0].id,
        label: newAnnotation.label,
        notes: newAnnotation.notes,
        at: new Date(newAnnotation.at).toISOString(),
      });
      setShowAnnotationForm(false);
      setNewAnnotation({ label: '', notes: '', at: '' });
      // Refresh annotations
      const annotRes = await api.get(`/trends/annotations/?tag_id=${selectedTags[0].id}`);
      setAnnotations(annotRes.data || []);
    } catch (err) {
      console.error('Failed to add annotation:', err);
    }
  };

  const exportData = async (format: 'csv' | 'png') => {
    if (format === 'csv') {
      try {
        const res = await api.get(`/history/export.csv/?tag_ids=${selectedTags[0].id}&start=${new Date(startTime).toISOString()}&end=${new Date(endTime).toISOString()}`, {
          responseType: 'blob',
        });
        const url = window.URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trends-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
      } catch (err) {
        console.error('Export failed:', err);
      }
    } else if (format === 'png') {
      if (chartRef.current) {
        const dataUrl = await toPng(chartRef.current, { backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.download = 'trend-chart.png';
        link.href = dataUrl;
        link.click();
      }
    }
  };

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Advanced Trends</h1>
          <p className="text-slate-600 dark:text-slate-300">Multi-tag analysis with zoom, pan, and comparison tools</p>
        </header>

        {/* Controls */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Calendar className="inline mr-2" size={16} /> Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Navigation & Zoom
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => pan('left')}
                  className="p-2 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200"
                  title="Pan Left"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => zoom(0.5)}
                  className="p-2 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200"
                  title="Zoom In"
                >
                  <Plus size={20} />
                </button>
                <button
                  onClick={() => zoom(2.0)}
                  className="p-2 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200"
                  title="Zoom Out"
                >
                  <Minus size={20} />
                </button>
                <button
                  onClick={() => pan('right')}
                  className="p-2 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200"
                  title="Pan Right"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Actions
              </label>
              <div className="flex gap-2">
                <button
                  onClick={loadTrendData}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold"
                >
                  {loading ? '...' : 'Refresh'}
                </button>
                <button
                  onClick={() => setShowAnnotationForm(!showAnnotationForm)}
                  className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded hover:bg-amber-200"
                  title="Add Annotation"
                >
                  <MessageSquarePlus size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Tag Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Tag className="inline mr-2" size={16} /> Select Tags
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => addTag(tag)}
                  disabled={selectedTags.some(t => t.id === tag.id)}
                  className="px-3 py-2 border rounded text-sm hover:bg-blue-50 dark:hover:bg-blue-900 disabled:opacity-50"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {selectedTags.map(tag => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700"
                  style={{ borderLeft: `4px solid ${tag.color}` }}
                >
                  <span className="text-sm font-medium">{tag.name}</span>
                  <button
                    onClick={() => removeTag(tag.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <input
                  type="checkbox"
                  id="compareMode"
                  checked={compareMode}
                  onChange={(e) => setCompareMode(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="compareMode" className="text-sm font-medium">Overlay Previous Period</label>
              </div>
            </div>
          )}
        </div>

        {/* Annotation Form */}
        {showAnnotationForm && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <MessageSquarePlus size={20} className="text-amber-600" />
              Add Incident Annotation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Label</label>
                <input
                  type="text"
                  value={newAnnotation.label}
                  onChange={(e) => setNewAnnotation({ ...newAnnotation, label: e.target.value })}
                  placeholder="e.g. Pump Failure"
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Timestamp</label>
                <input
                  type="datetime-local"
                  value={newAnnotation.at}
                  onChange={(e) => setNewAnnotation({ ...newAnnotation, at: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddAnnotation}
                  className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  Save Annotation
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={newAnnotation.notes}
                onChange={(e) => setNewAnnotation({ ...newAnnotation, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700"
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Chart */}
        {data.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">Trend Analysis</h2>
                <p className="text-sm text-slate-500">
                  {new Date(startTime).toLocaleString()} - {new Date(endTime).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => exportData('csv')}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200"
                >
                  <Download size={16} /> CSV
                </button>
                <button
                  onClick={() => exportData('png')}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Download size={16} /> PNG
                </button>
                <button
                  onClick={() => setAlarmOverlay(!alarmOverlay)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${alarmOverlay ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                >
                  <AlertTriangle size={16} /> Alarms
                </button>
                <button
                  onClick={async () => {
                    if (selectedTags.length === 0) return;
                    setAiAnalysisLoading(true);
                    setShowAIPanel(true);
                    try {
                      const res = await aiInsightsApi.getTrendAbnormality(selectedTags[0].id);
                      setAiAnalysisResult(res.data);
                    } catch {
                      setAiAnalysisResult(null);
                    } finally {
                      setAiAnalysisLoading(false);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  {aiAnalysisLoading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                  AI Analysis
                </button>
              </div>
            </div>

            <div ref={chartRef} className="bg-white dark:bg-slate-900 p-4 rounded-lg">
              <ResponsiveContainer width="100%" height={450}>
                <ComposedChart
                  data={data}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    minTickGap={30}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  {selectedTags.map(tag => (
                    <Line
                      key={tag.id}
                      type="monotone"
                      dataKey={tag.name}
                      stroke={tag.color}
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={true}
                    />
                  ))}
                  {compareMode && selectedTags.map(tag => (
                    <Line
                      key={`comp-${tag.id}`}
                      type="monotone"
                      dataKey={`${tag.name} (Prev)`}
                      stroke={tag.color}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      isAnimationActive={true}
                      opacity={0.5}
                    />
                  ))}
                  {annotations.map((ann, idx) => (
                    <ReferenceLine
                      key={`ann-${idx}`}
                      x={ann.at}
                      stroke="#EF4444"
                      strokeDasharray="3 3"
                      label={{ value: ann.label, position: 'top', fill: '#EF4444', fontSize: 12 }}
                    />
                  ))}
                  {/* Alarm overlay reference lines */}
                  {alarmOverlay && alarmEvents.map((evt, idx) => (
                    <ReferenceLine
                      key={`alarm-${idx}`}
                      x={evt.triggered_at}
                      stroke={evt.severity === 'critical' ? '#DC2626' : evt.severity === 'high' ? '#F97316' : '#EAB308'}
                      strokeDasharray="6 3"
                      strokeWidth={2}
                      label={{ value: `⚠ ${evt.rule_name || evt.message || 'Alarm'}`.slice(0, 30), position: 'insideTopRight', fill: '#DC2626', fontSize: 10 }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* AI Analysis Side Panel */}
        {showAIPanel && aiAnalysisResult && (
          <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                <Brain size={20} /> AI Trend Analysis: {aiAnalysisResult.tag_name}
              </h3>
              <button onClick={() => setShowAIPanel(false)} className="text-purple-500 hover:text-purple-700 text-sm">Dismiss</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
                <div className="text-sm text-slate-500">Status</div>
                <div className={`text-lg font-bold ${aiAnalysisResult.is_abnormal ? 'text-red-600' : 'text-green-600'}`}>
                  {aiAnalysisResult.is_abnormal ? 'ABNORMAL' : 'NORMAL'}
                </div>
                <div className="text-xs text-slate-400 mt-1">Confidence: {(aiAnalysisResult.confidence * 100).toFixed(0)}%</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
                <div className="text-sm text-slate-500">Z-Score</div>
                <div className="text-lg font-bold font-mono">{aiAnalysisResult.z_score.toFixed(3)}</div>
                <div className="text-xs text-slate-400 mt-1">Trend: {aiAnalysisResult.trend_direction}</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
                <div className="text-sm text-slate-500">Rate of Change</div>
                <div className="text-lg font-bold font-mono">{aiAnalysisResult.rate_of_change.toFixed(4)}</div>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">{aiAnalysisResult.explanation}</p>
          </div>
        )}

        {/* Statistics + Alarm Summary */}
        {data.length > 0 && selectedTags.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {selectedTags.map(tag => {
              const values = data
                .map(d => d[tag.name])
                .filter(v => typeof v === 'number');
              const min = Math.min(...values);
              const max = Math.max(...values);
              const avg = values.reduce((a, b) => a + b, 0) / values.length;
              const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length);

              return (
                <div
                  key={tag.id}
                  className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4"
                  style={{ borderTop: `4px solid ${tag.color}` }}
                >
                  <h3 className="font-bold mb-2">{tag.name}</h3>
                  <div className="text-sm space-y-1">
                    <div>Min: <span className="font-mono">{min.toFixed(2)}</span></div>
                    <div>Max: <span className="font-mono">{max.toFixed(2)}</span></div>
                    <div>Avg: <span className="font-mono">{avg.toFixed(2)}</span></div>
                    <div>StdDev: <span className="font-mono">{stdDev.toFixed(2)}</span></div>
                    <div>Samples: <span className="font-mono">{values.length}</span></div>
                  </div>
                </div>
              );
            })}
            {/* Alarm summary panel */}
            {alarmOverlay && alarmEvents.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-800 p-4" style={{ borderTop: '4px solid #EF4444' }}>
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" />
                  Alarm Events ({alarmEvents.length})
                </h3>
                <div className="text-sm space-y-1 max-h-40 overflow-y-auto">
                  {alarmEvents.slice(0, 10).map((evt) => (
                    <div key={evt.id} className="flex items-center justify-between">
                      <span className="text-red-600 dark:text-red-400 truncate max-w-[200px]">{evt.rule_name}</span>
                      <span className="text-xs text-slate-500">{new Date(evt.triggered_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
