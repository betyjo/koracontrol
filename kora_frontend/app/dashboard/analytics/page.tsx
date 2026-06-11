"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Sparkles, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { PageTransition } from "@/components/PageTransition";

interface AIAnalysisRow {
  id: number;
  tag: number;
  tag_name: string;
  is_anomaly: boolean;
  confidence_score: number;
  explanation: string;
  detected_at: string;
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("analysisId");
  const [rows, setRows] = useState<AIAnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<AIAnalysisRow[]>("ai/analyses/");
      setRows(res.data);
    } catch {
      setError("Could not load AI analytics. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    
    // Set up automatic polling for real-time updates (every 30 seconds)
    let intervalId: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        load();
      }, 30000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`analysis-row-${highlightId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add(
        "ring-2",
        "ring-blue-500",
        "ring-offset-2",
        "rounded-xl",
      );
      window.setTimeout(() => {
        el?.classList.remove(
          "ring-2",
          "ring-blue-500",
          "ring-offset-2",
          "rounded-xl",
        );
      }, 2600);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [highlightId, loading, rows]);

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="p-6 max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl transition-colors">
                <Sparkles className="text-indigo-600 dark:text-indigo-400" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                  AI analytics
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  Automated anomaly snapshots from monitored tags — matches the AI
                  analysis records behind the Django admin screens.
                </p>
              </div>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4 flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Auto-refresh (30s)
          </label>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-16 text-center text-slate-500 dark:text-slate-400">
            No analyses yet. Trigger one via the API{' '}
            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              POST /api/ai/analyze/
            </code>{' '}
            from the dashboard or tooling.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <article
                key={r.id}
                id={`analysis-row-${r.id}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                      Tag · #{r.tag}
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {r.tag_name || "Untitled tag"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.is_anomaly ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle size={14} /> Anomaly
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle size={14} /> Healthy
                      </span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {Math.round(r.confidence_score * 100)}% confidence
                    </span>
                  </div>
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-3">
                  {r.explanation}
                </p>
                <time className="text-xs text-slate-400 dark:text-slate-500">
                  {new Date(r.detected_at).toLocaleString()}
                </time>
              </article>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64 p-6">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}