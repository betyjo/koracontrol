"use client";
import { useEffect, useState, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Droplet,
  Activity,
  AlertTriangle,
  CheckCircle,
  Filter,
} from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { operationsApi, type QualityMetric } from "@/lib/api";

const statusConfig = {
  normal: {
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    bar: "bg-emerald-500",
    icon: <CheckCircle size={16} />,
    label: "Normal",
  },
  warning: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    bar: "bg-amber-500",
    icon: <AlertTriangle size={16} />,
    label: "Warning",
  },
  critical: {
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    bar: "bg-red-500",
    icon: <ShieldX size={16} />,
    label: "Critical",
  },
};

export default function QualityPage() {
  const [metrics, setMetrics] = useState<QualityMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [selectedArea, setSelectedArea] = useState<string>("");

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await operationsApi.getQualityMetrics();
        setMetrics(res.data);
      } catch (err) {
        console.error("Failed to load quality metrics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const areas = useMemo(() => {
    const set = new Set(metrics.map((m) => m.area_name || "Unassigned"));
    return Array.from(set).sort();
  }, [metrics]);

  const filtered = useMemo(() => {
    return metrics.filter((m) => {
      if (filterStatus && m.status !== filterStatus) return false;
      if (selectedArea && (m.area_name || "Unassigned") !== selectedArea) return false;
      return true;
    });
  }, [metrics, filterStatus, selectedArea]);

  const grouped = useMemo(() => {
    const map: Record<string, QualityMetric[]> = {};
    for (const m of filtered) {
      const area = m.area_name || "Unassigned";
      if (!map[area]) map[area] = [];
      map[area].push(m);
    }
    return map;
  }, [filtered]);

  const counts = useMemo(() => {
    return {
      normal: metrics.filter((m) => m.status === "normal").length,
      warning: metrics.filter((m) => m.status === "warning").length,
      critical: metrics.filter((m) => m.status === "critical").length,
    };
  }, [metrics]);

  /** Calculate where the current_value sits relative to the threshold range. */
  const thresholdPct = (m: QualityMetric) => {
    if (m.threshold_low == null || m.threshold_high == null) return null;
    const range = m.threshold_high - m.threshold_low;
    if (range <= 0) return null;
    const pct = ((m.current_value - m.threshold_low) / range) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Water Quality</h1>
          <p className="text-slate-600 dark:text-slate-300">Track quality metrics, alert thresholds, and compliance status across plant areas.</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Activity className="animate-spin text-blue-600" size={48} />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <SummaryCard
                label="Normal"
                count={counts.normal}
                total={metrics.length}
                icon={<ShieldCheck size={20} />}
                color="emerald"
              />
              <SummaryCard
                label="Warning"
                count={counts.warning}
                total={metrics.length}
                icon={<ShieldAlert size={20} />}
                color="amber"
              />
              <SummaryCard
                label="Critical"
                count={counts.critical}
                total={metrics.length}
                icon={<ShieldX size={20} />}
                color="red"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Filter size={16} className="text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="normal">Normal</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Areas</option>
                {areas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              {(filterStatus || selectedArea) && (
                <button
                  onClick={() => { setFilterStatus(""); setSelectedArea(""); }}
                  className="text-sm text-blue-600 hover:underline cursor-pointer"
                >
                  Clear filters
                </button>
              )}
              <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
                {filtered.length} of {metrics.length} metrics
              </span>
            </div>

            {/* Grouped by Area */}
            {Object.keys(grouped).length === 0 ? (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-slate-500 dark:text-slate-400 shadow-sm">
                No quality metrics found. Configure metrics in the admin panel.
              </div>
            ) : (
              Object.entries(grouped).map(([area, areaMetrics]) => (
                <div key={area} className="mb-8">
                  <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <Droplet size={16} className="text-blue-500" />
                    {area}
                    <span className="text-sm font-normal text-slate-400">({areaMetrics.length})</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {areaMetrics.map((metric) => {
                      const cfg = statusConfig[metric.status] || statusConfig.normal;
                      const pct = thresholdPct(metric);
                      return (
                        <div
                          key={metric.id}
                          className={`rounded-3xl border ${cfg.border} bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                {metric.metric_name}
                              </h3>
                              {metric.tag_name && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  Tag: {metric.tag_name}
                                </p>
                              )}
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                              {cfg.icon}
                              {cfg.label}
                            </span>
                          </div>

                          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                            {metric.current_value}
                            <span className="text-base font-normal text-slate-400 ml-1">{metric.unit}</span>
                          </div>

                          {/* Threshold bar */}
                          {pct !== null && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>Low: {metric.threshold_low}</span>
                                <span>High: {metric.threshold_high}</span>
                              </div>
                              <div className="relative w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                  className={`absolute h-2 rounded-full ${cfg.bar}`}
                                  style={{ width: `${pct}%` }}
                                />
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-slate-900 dark:border-white shadow"
                                  style={{ left: `calc(${pct}% - 6px)` }}
                                />
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-slate-400 mt-3">
                            Updated {new Date(metric.last_updated).toLocaleString()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}

function SummaryCard({
  label,
  count,
  total,
  icon,
  color,
}: {
  label: string;
  count: number;
  total: number;
  icon: React.ReactNode;
  color: "emerald" | "amber" | "red";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400",
    red: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        <span className="text-sm font-medium opacity-80">{label}</span>
      </div>
      <div className="text-3xl font-bold">{count}</div>
      <p className="text-xs opacity-60 mt-1">of {total} metrics</p>
    </div>
  );
}
