"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Clock, Download, Filter, Search, Zap } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { alarmApi, AlarmEvent, dashboardKpiApi, DashboardKpiSummary } from "@/lib/api";

interface SOEEvent {
  id: string;
  timestamp: string;
  type: "alarm" | "operator" | "system";
  severity: string;
  source: string;
  description: string;
}

export default function EventsPage() {
  const [events, setEvents] = useState<SOEEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("24h");

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (severityFilter !== "all") params.severity = severityFilter;

      const [alarmRes, kpiRes] = await Promise.all([
        alarmApi.listEvents(params).catch(() => ({ data: [] as AlarmEvent[] })),
        dashboardKpiApi.getKpiSummary().catch(() => ({ data: null as DashboardKpiSummary | null })),
      ]);

      const soeEvents: SOEEvent[] = [];

      // Map alarm events
      if (Array.isArray(alarmRes.data)) {
        alarmRes.data.forEach((ae: AlarmEvent) => {
          soeEvents.push({
            id: `alarm-${ae.id}`,
            timestamp: ae.triggered_at || new Date().toISOString(),
            type: "alarm",
            severity: ae.severity || "medium",
            source: ae.tag_name || ae.rule_name || "Unknown",
            description: ae.message || ae.rule_name || `Alarm event #${ae.id}`,
          });
        });
      }

      // Map operator events from KPI summary
      if (kpiRes.data?.recent_operator_events) {
        kpiRes.data.recent_operator_events.forEach((oe) => {
          soeEvents.push({
            id: `op-${oe.id}`,
            timestamp: oe.occurred_at || new Date().toISOString(),
            type: "operator",
            severity: "info",
            source: oe.author || "Operator",
            description: oe.title || `Operator action #${oe.id}`,
          });
        });
      }

      // Sort by timestamp descending
      soeEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEvents(soeEvents);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  }, [severityFilter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    let result = events;

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((e) => e.type === typeFilter);
    }

    // Time range filter
    if (dateRange !== "all") {
      const now = Date.now();
      const hours = dateRange === "24h" ? 24 : dateRange === "7d" ? 168 : 720;
      result = result.filter((e) => now - new Date(e.timestamp).getTime() < hours * 3600000);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) => e.source.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [events, typeFilter, severityFilter, search, dateRange]);

  const exportCSV = () => {
    const header = "Timestamp,Type,Severity,Source,Description\n";
    const rows = filteredEvents
      .map((e) => `${e.timestamp},${e.type},${e.severity},"${e.source}","${e.description}"`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `soe_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const severityColor = (sev: string) => {
    switch (sev.toLowerCase()) {
      case "critical": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      case "high": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
      case "medium": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "low": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "alarm": return <AlertTriangle size={16} className="text-red-500" />;
      case "operator": return <Zap size={16} className="text-blue-500" />;
      default: return <Activity size={16} className="text-slate-500" />;
    }
  };

  const stats = useMemo(() => ({
    total: filteredEvents.length,
    alarms: filteredEvents.filter((e) => e.type === "alarm").length,
    operator: filteredEvents.filter((e) => e.type === "operator").length,
    critical: filteredEvents.filter((e) => e.severity === "critical").length,
  }), [filteredEvents]);

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Sequence of Events</h1>
            <p className="text-slate-600 dark:text-slate-300">Chronological log of all system events, alarms, and operator actions.</p>
          </div>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold">
            <Download size={16} /> Export CSV
          </button>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Events", value: stats.total, color: "text-slate-900 dark:text-white" },
            { label: "Alarm Events", value: stats.alarms, color: "text-red-600 dark:text-red-400" },
            { label: "Operator Actions", value: stats.operator, color: "text-blue-600 dark:text-blue-400" },
            { label: "Critical", value: stats.critical, color: "text-red-700 dark:text-red-300" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
            <option value="all">All Types</option>
            <option value="alarm">Alarms</option>
            <option value="operator">Operator</option>
            <option value="system">System</option>
          </select>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button onClick={loadEvents} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            Refresh
          </button>
        </div>

        {/* Event Table */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Activity className="animate-spin text-blue-600" size={36} />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400">
              <Clock size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold">No events found</p>
              <p className="text-sm">Adjust filters or check back later.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Severity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Source</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((ev) => (
                    <tr key={ev.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono text-xs">
                        {new Date(ev.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold capitalize">
                          {typeIcon(ev.type)} {ev.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${severityColor(ev.severity)}`}>
                          {ev.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{ev.source}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{ev.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
