"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, AlertTriangle, TrendingUp, Activity, Loader2, RefreshCw, Shield, Zap, Wrench, HeartPulse } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import {
  aiInsightsApi,
  type AIAnomalyDashboard,
  type AIPredictiveMaintenanceItem,
  type AIFinding,
  type EquipmentHealthItem,
  type MaintenanceAlert,
} from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export default function AIInsightsPage() {
  const [anomalyData, setAnomalyData] = useState<AIAnomalyDashboard | null>(null);
  const [predictions, setPredictions] = useState<AIPredictiveMaintenanceItem[]>([]);
  const [findings, setFindings] = useState<AIFinding[]>([]);
  const [equipmentHealth, setEquipmentHealth] = useState<EquipmentHealthItem[]>([]);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [findingFilter, setFindingFilter] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [anomalyRes, predRes, findingsRes, healthRes, alertsRes] = await Promise.allSettled([
        aiInsightsApi.getAnomalyDashboard(),
        aiInsightsApi.getPredictiveMaintenance(),
        aiInsightsApi.getFindings(findingFilter !== "all" ? { finding_type: findingFilter } : undefined),
        aiInsightsApi.getEquipmentHealth(),
        aiInsightsApi.getMaintenanceAlerts(),
      ]);
      if (anomalyRes.status === "fulfilled") setAnomalyData(anomalyRes.value.data);
      if (predRes.status === "fulfilled") setPredictions(predRes.value.data);
      if (findingsRes.status === "fulfilled") setFindings(findingsRes.value.data);
      if (healthRes.status === "fulfilled") setEquipmentHealth(healthRes.value.data);
      if (alertsRes.status === "fulfilled") setMaintenanceAlerts(alertsRes.value.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [findingFilter]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading && !anomalyData) {
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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Brain className="text-purple-500" />
              AI Intelligence Dashboard
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Anomaly detection, predictive maintenance, and intelligent analysis
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <SummaryCard
            title="Anomalies (24h)"
            value={anomalyData?.anomaly_count_24h ?? 0}
            icon={<AlertTriangle className="text-red-500" />}
            bg="bg-red-50 dark:bg-red-900/20"
          />
          <SummaryCard
            title="Anomalies (7d)"
            value={anomalyData?.anomaly_count_7d ?? 0}
            icon={<Activity className="text-orange-500" />}
            bg="bg-orange-50 dark:bg-orange-900/20"
          />
          <SummaryCard
            title="Avg Confidence"
            value={`${((anomalyData?.avg_confidence ?? 0) * 100).toFixed(1)}%`}
            icon={<Shield className="text-green-500" />}
            bg="bg-green-50 dark:bg-green-900/20"
          />
          <SummaryCard
            title="Active Predictions"
            value={predictions.length}
            icon={<Zap className="text-purple-500" />}
            bg="bg-purple-50 dark:bg-purple-900/20"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Anomalous Tags */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-500" />
              Top Anomalous Tags
            </h2>
            {anomalyData?.top_anomalous_tags?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={anomalyData.top_anomalous_tags}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="tag_name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm">No anomaly data available</p>
            )}
          </div>

          {/* Detection Timeline */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity size={20} className="text-green-500" />
              Recent Detections
            </h2>
            {anomalyData?.recent_detections?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={anomalyData.recent_detections.slice(0, 20).map((d, i) => ({
                    idx: i + 1,
                    confidence: ((d.result_json?.confidence as number) ?? 0) * 100,
                    tag: d.tag_name ?? "unknown",
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="idx" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="confidence" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm">No recent detections</p>
            )}
          </div>
        </div>

        {/* Predictive Maintenance Alerts */}
        {predictions.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 p-6 mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap size={20} className="text-amber-500" />
              Predictive Maintenance Alerts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictions.map((p, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg border dark:border-slate-700"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor: p.health_score < 50 ? "#EF4444" : p.health_score < 75 ? "#F59E0B" : "#10B981",
                  }}
                >
                  <div className="font-bold text-slate-900 dark:text-white">{p.equipment_name}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{p.tag_name}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
                      backgroundColor: p.health_score < 50 ? "#FEE2E2" : p.health_score < 75 ? "#FEF3C7" : "#D1FAE5",
                      color: p.health_score < 50 ? "#991B1B" : p.health_score < 75 ? "#92400E" : "#065F46",
                    }}>
                      Health: {p.health_score.toFixed(0)}%
                    </span>
                    <span className="text-xs text-slate-400">Variance: {p.variance.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{p.prediction}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{p.recommended_action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Equipment Health Monitoring */}
        {equipmentHealth.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 p-6 mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <HeartPulse size={20} className="text-green-500" />
              Equipment Health Monitoring
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {equipmentHealth.map((eq, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg border dark:border-slate-700"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor:
                      eq.status === "critical" ? "#EF4444" :
                      eq.status === "warning" ? "#F59E0B" :
                      eq.status === "degrading" ? "#3B82F6" : "#10B981",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {eq.equipment_type.replace("_", " ")}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      eq.status === "critical" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                      eq.status === "warning" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                      eq.status === "degrading" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                      "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    }`}>
                      {eq.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${eq.health_score * 100}%`,
                          backgroundColor:
                            eq.health_score >= 0.8 ? "#10B981" :
                            eq.health_score >= 0.6 ? "#F59E0B" : "#EF4444",
                        }}
                      />
                    </div>
                    <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
                      {(eq.health_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {eq.issues.length > 0 && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                      {eq.issues.slice(0, 2).map((issue, j) => (
                        <div key={j} className="flex items-start gap-1">
                          <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{issue}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {eq.recommendations.length > 0 && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      <Wrench size={10} className="inline mr-1" />
                      {eq.recommendations[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Maintenance Alerts */}
        {maintenanceAlerts.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 p-6 mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Wrench size={20} className="text-amber-500" />
              Active Maintenance Alerts
            </h2>
            <div className="space-y-3">
              {maintenanceAlerts.slice(0, 10).map((alert, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg border dark:border-slate-700 flex items-start gap-4"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor: alert.severity === "critical" ? "#EF4444" : "#F59E0B",
                  }}
                >
                  <div className={`p-2 rounded-lg ${
                    alert.severity === "critical" ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                  }`}>
                    <AlertTriangle size={16} className={
                      alert.severity === "critical" ? "text-red-600" : "text-amber-600"
                    } />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900 dark:text-white">{alert.message}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        alert.severity === "critical" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                        "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{alert.recommended_action}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>Type: {alert.alert_type.replace("_", " ")}</span>
                      <span>Confidence: {(alert.confidence * 100).toFixed(0)}%</span>
                      {alert.estimated_days_to_failure && (
                        <span className="text-red-600 dark:text-red-400 font-semibold">
                          ~{alert.estimated_days_to_failure} days to failure
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* AI Findings table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Brain size={20} className="text-purple-500" />
              AI Findings Log
            </h2>
            <select
              value={findingFilter}
              onChange={(e) => setFindingFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="anomaly">Anomaly</option>
              <option value="prediction">Prediction</option>
              <option value="prioritization">Prioritization</option>
              <option value="root_cause">Root Cause</option>
              <option value="trend_abnormality">Trend Abnormality</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-sm">Type</th>
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-sm">Tag</th>
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-sm">Confidence</th>
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-sm">Explanation</th>
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-sm">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {findings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                      No AI findings recorded yet.
                    </td>
                  </tr>
                ) : (
                  findings.slice(0, 50).map((f) => (
                    <tr key={f.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3">
                        <FindingTypeBadge type={f.finding_type} />
                      </td>
                      <td className="p-3 text-sm text-slate-600 dark:text-slate-400">{f.tag_name ?? "—"}</td>
                      <td className="p-3 text-sm font-mono">
                        {((f.result_json?.confidence as number) ?? 0) > 0
                          ? `${(((f.result_json?.confidence as number) ?? 0) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="p-3 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {(f.result_json?.explanation as string) ?? (f.result_json?.root_cause as string) ?? "—"}
                      </td>
                      <td className="p-3 text-sm text-slate-500">{new Date(f.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function SummaryCard({ title, value, icon, bg }: { title: string; value: string | number; icon: React.ReactNode; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-6 border border-slate-200 dark:border-slate-700`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function FindingTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    anomaly: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    prediction: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
    prioritization: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    root_cause: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    trend_abnormality: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[type] || colors.anomaly}`}>
      {type.replace("_", " ")}
    </span>
  );
}
