"use client";
import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Gauge, TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { operationsApi, EquipmentHealth, alarmApi, AlarmEvent } from "@/lib/api";

interface OEEData {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export default function PerformancePage() {
  const [equipment, setEquipment] = useState<EquipmentHealth[]>([]);
  const [alarms, setAlarms] = useState<AlarmEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [eqRes, alarmRes] = await Promise.all([
          operationsApi.getEquipmentHealth().catch(() => ({ data: [] as EquipmentHealth[] })),
          alarmApi.listEvents({}).catch(() => ({ data: [] as AlarmEvent[] })),
        ]);
        setEquipment(Array.isArray(eqRes.data) ? eqRes.data : []);
        setAlarms(Array.isArray(alarmRes.data) ? alarmRes.data : []);
      } catch (err) {
        console.error("Failed to load performance data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const oee = useMemo<OEEData>(() => {
    // Availability: % of equipment in good/excellent condition
    const total = equipment.length || 1;
    const healthy = equipment.filter((e) => {
      const s = (e.condition || "").toLowerCase();
      return s === "excellent" || s === "good" || s === "normal";
    }).length;
    const availability = Math.round((healthy / total) * 100);

    // Performance: inverse of alarm frequency (fewer alarms = better)
    const criticalAlarms = alarms.filter((a) => (a.severity || "").toLowerCase() === "critical").length;
    const totalAlarms = alarms.length || 1;
    const alarmImpact = Math.min(100, (criticalAlarms / totalAlarms) * 200);
    const performance = Math.max(0, Math.round(100 - alarmImpact));

    // Quality: based on equipment health scores
    const avgHealth = equipment.length > 0
      ? equipment.reduce((sum, e) => sum + parseFloat(e.health_score || "0"), 0) / equipment.length
      : 85;
    const quality = Math.round(Math.min(100, avgHealth));

    const oeeScore = Math.round((availability / 100) * (performance / 100) * (quality / 100) * 100);

    return { availability, performance, quality, oee: oeeScore };
  }, [equipment, alarms]);

  const getOeeGrade = (score: number) => {
    if (score >= 85) return { label: "World Class", color: "text-emerald-600 dark:text-emerald-400" };
    if (score >= 70) return { label: "Good", color: "text-blue-600 dark:text-blue-400" };
    if (score >= 50) return { label: "Fair", color: "text-amber-600 dark:text-amber-400" };
    return { label: "Needs Improvement", color: "text-red-600 dark:text-red-400" };
  };

  const conditionColor = (condition: string) => {
    const c = (condition || "").toLowerCase();
    if (c === "excellent" || c === "good") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (c === "fair" || c === "normal") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    if (c === "poor") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  };

  const grade = getOeeGrade(oee.oee);

  // Equipment utilization by condition
  const conditionBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    equipment.forEach((e) => {
      const c = (e.condition || "Unknown").toLowerCase();
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [equipment]);

  // Downtime Pareto (alarm frequency by source)
  const alarmPareto = useMemo(() => {
    const counts: Record<string, number> = {};
    alarms.forEach((a) => {
      const src = a.tag_name || a.rule_name || "Unknown";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [alarms]);

  const maxAlarmCount = alarmPareto.length > 0 ? alarmPareto[0][1] : 1;

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Performance &amp; OEE</h1>
          <p className="text-slate-600 dark:text-slate-300">Overall Equipment Effectiveness and operational performance metrics.</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Activity className="animate-spin text-blue-600" size={48} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* OEE Score Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <OeeCard title="OEE Score" value={`${oee.oee}%`} subtitle={grade.label} subtitleColor={grade.color} icon={<Target size={20} />} highlight />
              <OeeCard title="Availability" value={`${oee.availability}%`} subtitle="Equipment uptime" icon={<Gauge size={20} />} />
              <OeeCard title="Performance" value={`${oee.performance}%`} subtitle="Alarm-adjusted" icon={<TrendingUp size={20} />} />
              <OeeCard title="Quality" value={`${oee.quality}%`} subtitle="Health compliance" icon={<BarChart3 size={20} />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Downtime Pareto */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Alarm Frequency Pareto</h2>
                {alarmPareto.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No alarm data available.</p>
                ) : (
                  <div className="space-y-3">
                    {alarmPareto.map(([name, count]) => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 dark:text-slate-400 w-28 truncate">{name}</span>
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                            style={{ width: `${(count / maxAlarmCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Equipment Condition Distribution */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Equipment Condition</h2>
                {Object.keys(conditionBreakdown).length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No equipment data available.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(conditionBreakdown).map(([cond, count]) => (
                      <div key={cond} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${conditionColor(cond)}`}>{cond}</span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Equipment Health Table */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Equipment Health Details</h2>
              {equipment.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No equipment data available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Equipment</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Health Score</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Condition</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipment.map((eq) => (
                        <tr key={eq.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{eq.equipment_name || eq.asset_name || `EQ-${eq.id}`}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${parseFloat(eq.health_score || "0")}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{eq.health_score}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${conditionColor(eq.condition)}`}>{eq.condition}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{eq.recommended_action || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function OeeCard({ title, value, subtitle, subtitleColor, icon, highlight }: {
  title: string; value: string; subtitle: string; subtitleColor?: string; icon: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className={`rounded-3xl border p-6 shadow-sm ${highlight ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
        <div className="rounded-2xl bg-slate-100 dark:bg-slate-950 p-2 text-blue-600 dark:text-blue-400">{icon}</div>
      </div>
      <p className={`text-3xl font-bold ${highlight ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-white"}`}>{value}</p>
      <p className={`mt-2 text-sm font-medium ${subtitleColor || "text-slate-500 dark:text-slate-400"}`}>{subtitle}</p>
    </div>
  );
}
