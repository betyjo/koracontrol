"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Loader2, PauseCircle, RefreshCw } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { alarmApi, AlarmEvent, AlarmKpis } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

const severityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function AlarmsPage() {
  const { showToast } = useToast();
  const [events, setEvents] = useState<AlarmEvent[]>([]);
  const [kpis, setKpis] = useState<AlarmKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: { state?: string; severity?: string } = {};
      if (stateFilter !== "all") params.state = stateFilter;
      if (severityFilter !== "all") params.severity = severityFilter;

      const [eventsRes, kpisRes] = await Promise.all([
        alarmApi.listEvents(params),
        alarmApi.getKpis(),
      ]);
      setEvents(eventsRes.data);
      setKpis(kpisRes.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("Access Denied: You do not have the required role (Admin/Operator) to view or manage alarms.");
      } else {
        setError("Failed to load alarms. Please retry.");
      }
    } finally {
      setLoading(false);
    }
  }, [severityFilter, stateFilter]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

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
    try {
      setActionLoadingId(id);
      await alarmApi.acknowledge(id, "Acknowledged from alarm console");
      showToast("Alarm acknowledged successfully", "success");
      await load();
    } catch (err: any) {
      const msg = err.response?.status === 403 
        ? "Permission Denied: Only Admins/Operators can act on alarms." 
        : "Failed to acknowledge alarm.";
      showToast(msg, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleShelve = async (id: number) => {
    try {
      setActionLoadingId(id);
      await alarmApi.shelve(id, 30, "Temporary shelving from alarm console");
      showToast("Alarm shelved for 30 minutes", "success");
      await load();
    } catch (err: any) {
      const msg = err.response?.status === 403 
        ? "Permission Denied: Only Admins/Operators can act on alarms." 
        : "Failed to shelve alarm.";
      showToast(msg, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnshelve = async (id: number) => {
    try {
      setActionLoadingId(id);
      await alarmApi.unshelve(id);
      showToast("Alarm unshelved", "success");
      await load();
    } catch (err: any) {
      const msg = err.response?.status === 403 
        ? "Permission Denied: Only Admins/Operators can act on alarms." 
        : "Failed to unshelve alarm.";
      showToast(msg, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Alarm Console</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Live alarm lifecycle tracking with acknowledgment and shelving actions.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm cursor-pointer"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Standing alarms" value={kpis?.standing_alarms ?? 0} icon={<Bell size={18} />} />
          <KpiCard label="Critical open" value={kpis?.critical_open ?? 0} icon={<AlertTriangle size={18} />} />
          <KpiCard label="Total events" value={kpis?.total_events ?? 0} icon={<PauseCircle size={18} />} />
          <KpiCard
            label="Ack rate"
            value={`${kpis?.ack_rate_percent ?? 0}%`}
            icon={<CheckCircle2 size={18} />}
          />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-4 mb-4 flex flex-wrap gap-3">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          >
            <option value="all">All states</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="shelved">Shelved</option>
            <option value="returned">Returned</option>
            <option value="suppressed">Suppressed</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 overflow-hidden">
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="p-6 text-red-600">{error}</div>
          ) : sortedEvents.length === 0 ? (
            <div className="p-10 text-center text-slate-500 dark:text-slate-400">No alarm events found.</div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="p-3 text-xs uppercase">Tag</th>
                  <th className="p-3 text-xs uppercase">Rule</th>
                  <th className="p-3 text-xs uppercase">Severity</th>
                  <th className="p-3 text-xs uppercase">State</th>
                  <th className="p-3 text-xs uppercase">Value</th>
                  <th className="p-3 text-xs uppercase">Triggered</th>
                  <th className="p-3 text-xs uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map((event) => (
                  <tr key={event.id} className="border-t dark:border-slate-800">
                    <td className="p-3">{event.tag_name}</td>
                    <td className="p-3">{event.rule_name}</td>
                    <td className="p-3 capitalize">{event.severity}</td>
                    <td className="p-3 capitalize">{event.state}</td>
                    <td className="p-3">{event.triggered_value}</td>
                    <td className="p-3 text-sm">{new Date(event.triggered_at).toLocaleString()}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        {event.state !== "acknowledged" && event.state !== "returned" && (
                          <button
                            disabled={actionLoadingId === event.id}
                            onClick={() => handleAck(event.id)}
                            className="px-2 py-1 text-xs rounded bg-emerald-600 text-white cursor-pointer"
                          >
                            Ack
                          </button>
                        )}
                        {event.state !== "shelved" && event.state !== "returned" && (
                          <button
                            disabled={actionLoadingId === event.id}
                            onClick={() => handleShelve(event.id)}
                            className="px-2 py-1 text-xs rounded bg-amber-600 text-white cursor-pointer"
                          >
                            Shelve
                          </button>
                        )}
                        {event.state === "shelved" && (
                          <button
                            disabled={actionLoadingId === event.id}
                            onClick={() => handleUnshelve(event.id)}
                            className="px-2 py-1 text-xs rounded bg-blue-600 text-white cursor-pointer"
                          >
                            Unshelve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
