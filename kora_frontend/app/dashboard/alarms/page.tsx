"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, Brain, CheckCircle2, Loader2, PauseCircle, RefreshCw, Search, X } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { alarmApi, AlarmEvent, AlarmKpis, aiInsightsApi, type AIAlarmPriority, type AIRootCauseResult } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { getUserRole, hasPermission, UserRole } from "@/lib/permissions";

const severityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function AlarmsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [events, setEvents] = useState<AlarmEvent[]>([]);
  const [kpis, setKpis] = useState<AlarmKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [aiPriorities, setAiPriorities] = useState<AIAlarmPriority[]>([]);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [rootCauseModal, setRootCauseModal] = useState<number | null>(null);
  const [rootCauseResult, setRootCauseResult] = useState<AIRootCauseResult | null>(null);
  const [rootCauseLoading, setRootCauseLoading] = useState(false);

  useEffect(() => {
    // Check user permissions - all roles can view alarms, but with different capabilities
    const role = getUserRole();
    if (!role || !hasPermission(role, 'canViewAlarms')) {
      router.replace('/dashboard');
      return;
    }
    setUserRole(role);
  }, [router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: { state?: string; severity?: string } = {};
      if (stateFilter !== "all") params.state = stateFilter;
      if (severityFilter !== "all") params.severity = severityFilter;

      const [eventsRes, kpisRes, aiPriorityRes] = await Promise.all([
        alarmApi.listEvents(params),
        alarmApi.getKpis(),
        aiInsightsApi.getAlarmPrioritization().catch(() => ({ data: [] })),
      ]);
      setEvents(eventsRes.data);
      setKpis(kpisRes.data);
      setAiPriorities(Array.isArray(aiPriorityRes.data) ? aiPriorityRes.data : []);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'status' in err.response && err.response.status === 403) {
        setError("Access Denied: You do not have the required role (Admin/Operator) to view or manage alarms.");
      } else {
        setError("Failed to load alarms. Please retry.");
      }
    } finally {
      setLoading(false);
    }
  }, [severityFilter, stateFilter]);

  useEffect(() => {
    if (userRole) {
      load();
      const timer = setInterval(load, 10000);
      return () => clearInterval(timer);
    }
  }, [load, userRole]);

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const sev = (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
        if (sev !== 0) return sev;
        return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime();
      }),
    [events]
  );

  const handleAck = async (id: number) => {
    if (!userRole || !hasPermission(userRole, 'canManageAlarms')) {
      showToast("Permission Denied: Only Admins/Operators can act on alarms.", "error");
      return;
    }

    try {
      setActionLoadingId(id);
      await alarmApi.acknowledge(id, "Acknowledged from alarm console");
      showToast("Alarm acknowledged successfully", "success");
      await load();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'status' in err.response && err.response.status === 403
        ? "Permission Denied: Only Admins/Operators can act on alarms."
        : "Failed to acknowledge alarm.";
      showToast(msg, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleShelve = async (id: number) => {
    if (!userRole || !hasPermission(userRole, 'canManageAlarms')) {
      showToast("Permission Denied: Only Admins/Operators can act on alarms.", "error");
      return;
    }

    try {
      setActionLoadingId(id);
      await alarmApi.shelve(id, 30, "Temporary shelving from alarm console");
      showToast("Alarm shelved for 30 minutes", "success");
      await load();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'status' in err.response && err.response.status === 403
        ? "Permission Denied: Only Admins/Operators can act on alarms."
        : "Failed to shelve alarm.";
      showToast(msg, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnshelve = async (id: number) => {
    if (!userRole || !hasPermission(userRole, 'canManageAlarms')) {
      showToast("Permission Denied: Only Admins/Operators can act on alarms.", "error");
      return;
    }

    try {
      setActionLoadingId(id);
      await alarmApi.unshelve(id);
      showToast("Alarm unshelved successfully", "success");
      await load();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'status' in err.response && err.response.status === 403
        ? "Permission Denied: Only Admins/Operators can act on alarms."
        : "Failed to unshelve alarm.";
      showToast(msg, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const canManageAlarms = userRole && hasPermission(userRole, 'canManageAlarms');

  if (loading && !events.length) {
    return (
      <PageTransition>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white transition-colors">
            Alarm Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">
            {canManageAlarms 
              ? "Monitor and manage system alarms with full control capabilities."
              : "View system alarms and their current states (read-only access)."
            }
          </p>
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KpiCard
              title="Standing Alarms"
              value={kpis.standing_alarms}
              icon={<AlertTriangle className="text-red-500 dark:text-red-400" />}
              bgColor="bg-red-50 dark:bg-red-900/20"
            />
            <KpiCard
              title="Critical Open"
              value={kpis.critical_open}
              icon={<Bell className="text-orange-500 dark:text-orange-400" />}
              bgColor="bg-orange-50 dark:bg-orange-900/20"
            />
            <KpiCard
              title="Total Events"
              value={kpis.total_events}
              icon={<RefreshCw className="text-blue-500 dark:text-blue-400" />}
              bgColor="bg-blue-50 dark:bg-blue-900/20"
            />
            <KpiCard
              title="Ack Rate"
              value={`${(kpis.ack_rate_percent ?? 0).toFixed(1)}%`}
              icon={<CheckCircle2 className="text-green-500 dark:text-green-400" />}
              bgColor="bg-green-50 dark:bg-green-900/20"
            />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 p-4 mb-6 transition-colors duration-500">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">State</label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              >
                <option value="all">All States</option>
                <option value="active">Active</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="returned">Returned</option>
                <option value="shelved">Shelved</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="ml-auto flex items-end gap-2">
              <button
                onClick={() => setShowAIInsights(!showAIInsights)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors ${
                  showAIInsights
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Brain className="h-4 w-4" />
                AI Insights
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 transition-colors">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Alarms Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden transition-colors duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 transition-colors">
                <tr>
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Severity</th>
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Alarm</th>
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Tag</th>
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">State</th>
                  {showAIInsights && <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">AI Priority</th>}
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Triggered</th>
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500 dark:text-slate-400">
                      No alarms match the current filters.
                    </td>
                  </tr>
                ) : (
                  sortedEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <SeverityBadge severity={event.severity} />
                      </td>
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">{event.rule_name}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">{event.message}</div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">{event.tag_name}</td>
                      <td className="p-4">
                        <StateBadge state={event.state} />
                      </td>
                      {showAIInsights && (
                        <td className="p-4">
                          <AIPriorityBadge eventId={event.id} priorities={aiPriorities} />
                        </td>
                      )}
                      <td className="p-4 text-slate-600 dark:text-slate-400 text-sm">
                        {new Date(event.triggered_at).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {canManageAlarms && (
                            <>
                              {event.state === 'active' && (
                                <button
                                  onClick={() => handleAck(event.id)}
                                  disabled={actionLoadingId === event.id}
                                  className="p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                  title="Acknowledge"
                                >
                                  {actionLoadingId === event.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 size={16} />
                                  )}
                                </button>
                              )}
                              {event.state === 'active' && (
                                <button
                                  onClick={() => handleShelve(event.id)}
                                  disabled={actionLoadingId === event.id}
                                  className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                  title="Shelve"
                                >
                                  {actionLoadingId === event.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <PauseCircle size={16} />
                                  )}
                                </button>
                              )}
                              {event.state === 'shelved' && (
                                <button
                                  onClick={() => handleUnshelve(event.id)}
                                  disabled={actionLoadingId === event.id}
                                  className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                  title="Unshelve"
                                >
                                  {actionLoadingId === event.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw size={16} />
                                  )}
                                </button>
                              )}
                            </>
                          )}
                          {/* AI Root Cause Button */}
                          <button
                            onClick={() => { setRootCauseModal(event.id); setRootCauseResult(null); }}
                            className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
                            title="AI Root Cause Analysis"
                          >
                            <Brain size={16} />
                          </button>
                          {!canManageAlarms && (
                            <span className="text-slate-400 text-sm">View only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* AI Correlated Alarms Section */}
        {showAIInsights && aiPriorities.length > 1 && (
          <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2 mb-2">
              <Brain size={16} /> AI: These alarms may be related
            </h3>
            <div className="flex flex-wrap gap-2">
              {aiPriorities.slice(0, 5).map((p) => (
                <span key={p.id} className="px-3 py-1 bg-white dark:bg-slate-800 rounded-full text-xs font-medium text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
                  {p.rule_name} ({p.tag_name}) — Score: {(p.priority_score ?? 0).toFixed(1)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Root Cause Modal */}
      {rootCauseModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRootCauseModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border dark:border-slate-700 max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Brain className="text-purple-500" /> AI Root Cause Analysis
              </h2>
              <button onClick={() => setRootCauseModal(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                <X size={20} />
              </button>
            </div>
            {!rootCauseResult && !rootCauseLoading && (
              <button
                onClick={async () => {
                  setRootCauseLoading(true);
                  try {
                    const res = await aiInsightsApi.getRootCause(rootCauseModal);
                    setRootCauseResult(res.data);
                  } catch { setRootCauseResult(null); }
                  finally { setRootCauseLoading(false); }
                }}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                <Search className="inline mr-2" size={16} /> Analyze Root Cause
              </button>
            )}
            {rootCauseLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <span className="ml-2 text-slate-500">Analyzing...</span>
              </div>
            )}
            {rootCauseResult && (
              <div className="space-y-3">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-sm font-medium text-purple-800 dark:text-purple-300">Root Cause</div>
                  <div className="text-slate-900 dark:text-white font-semibold">{rootCauseResult.root_cause}</div>
                  <div className="text-xs text-slate-500 mt-1">Confidence: {((rootCauseResult.confidence ?? 0) * 100).toFixed(0)}%</div>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">{rootCauseResult.explanation}</div>
                {rootCauseResult.correlated_tags?.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-1">Correlated Tags</div>
                    {rootCauseResult.correlated_tags.map((t, i) => (
                      <span key={i} className="inline-block mr-2 mb-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">
                        {t.tag_name}: {(t.deviation ?? 0).toFixed(2)}
                      </span>
                    ))}
                  </div>
                )}
                {rootCauseResult.recommendations?.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-1">Recommendations</div>
                    <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400">
                      {rootCauseResult.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </PageTransition>
  );
}

function AIPriorityBadge({ eventId, priorities }: { eventId: number; priorities: AIAlarmPriority[] }) {
  const match = Array.isArray(priorities) ? priorities.find((p) => p.id === eventId) : undefined;
  if (!match) return <span className="text-slate-400 text-xs">—</span>;
  const score = match.priority_score;
  const color = score >= 80 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
    : score >= 50 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
    : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
  return (
    <div>
      <span className={`px-2 py-1 rounded-full text-xs font-bold ${color}`}>{(score ?? 0).toFixed(0)}</span>
      {match.ai_recommendation && (
        <div className="text-xs text-purple-600 dark:text-purple-400 mt-1 max-w-[150px] truncate" title={match.ai_recommendation}>
          {match.ai_recommendation}
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, icon, bgColor }: { title: string; value: string | number; icon: React.ReactNode; bgColor: string }) {
  return (
    <div className={`${bgColor} rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    critical: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    high: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
    medium: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
    low: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[severity as keyof typeof colors] || colors.low}`}>
      {severity}
    </span>
  );
}

function StateBadge({ state }: { state: string }) {
  const colors = {
    active: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    acknowledged: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    returned: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    shelved: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    suppressed: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[state as keyof typeof colors] || colors.active}`}>
      {state}
    </span>
  );
}