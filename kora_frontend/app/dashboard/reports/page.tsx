"use client";
import { useEffect, useState } from 'react';
import { FileText, BarChart3, ClipboardList, ShieldCheck, Download, Activity } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import api, { alarmApi, operationsApi } from '@/lib/api';

interface ReportStats {
  totalAlarms: number;
  totalEquipment: number;
  totalTasks: number;
  totalMetrics: number;
}

export default function ReportsPage() {
  const [stats, setStats] = useState<ReportStats>({ totalAlarms: 0, totalEquipment: 0, totalTasks: 0, totalMetrics: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [alarmRes, plantRes, taskRes, qualityRes] = await Promise.all([
          alarmApi.getKpis(),
          operationsApi.getPlantOverview(),
          operationsApi.getMaintenanceTasks(),
          operationsApi.getQualityMetrics(),
        ]);
        const eqCount = (plantRes.data.areas || []).reduce((acc, a) => acc + a.equipment.length, 0);
        setStats({
          totalAlarms: alarmRes.data.total_events,
          totalEquipment: eqCount,
          totalTasks: taskRes.data.length,
          totalMetrics: qualityRes.data.length,
        });
      } catch (err) {
        console.error('Failed to load report stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handleExport = async (type: 'plant' | 'alarm' | 'compliance') => {
    setExporting(type);
    try {
      if (type === 'plant') {
        const res = await operationsApi.getPlantOverview();
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `plant-summary-${new Date().toISOString().split('T')[0]}.json`);
      } else if (type === 'alarm') {
        const res = await alarmApi.listEvents({});
        const csv = [
          ['ID', 'Rule', 'Tag', 'Severity', 'State', 'Triggered At', 'Message'].join(','),
          ...res.data.map((e) =>
            [e.id, e.rule_name, e.tag_name, e.severity, e.state, e.triggered_at, `"${(e.message || '').replace(/"/g, '""')}"`].join(',')
          ),
        ].join('\n');
        downloadBlob(new Blob([csv], { type: 'text/csv' }), `alarm-log-${new Date().toISOString().split('T')[0]}.csv`);
      } else if (type === 'compliance') {
        const res = await operationsApi.getQualityMetrics();
        const csv = [
          ['Metric', 'Value', 'Unit', 'Status', 'Area', 'Last Updated'].join(','),
          ...res.data.map((m) =>
            [m.metric_name, m.current_value, m.unit, m.status, m.area_name || '', m.last_updated].join(',')
          ),
        ].join('\n');
        downloadBlob(new Blob([csv], { type: 'text/csv' }), `compliance-report-${new Date().toISOString().split('T')[0]}.csv`);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(null);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Reports</h1>
          <p className="text-slate-600 dark:text-slate-300">Access operational summaries, compliance reports, and energy usage statements.</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Activity className="animate-spin text-blue-600" size={48} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <ReportCard title="Alarm Events" description={`${stats.totalAlarms} total events recorded`} icon={<BarChart3 size={20} />} />
              <ReportCard title="Equipment Assets" description={`${stats.totalEquipment} assets under monitoring`} icon={<ShieldCheck size={20} />} />
              <ReportCard title="Maintenance Tasks" description={`${stats.totalTasks} work orders tracked`} icon={<ClipboardList size={20} />} />
              <ReportCard title="Quality Metrics" description={`${stats.totalMetrics} metrics monitored`} icon={<FileText size={20} />} />
            </div>

            <div className="mt-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Report Library</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Generate CSV or JSON exports of your operations and quality data.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ReportAction
                  title="Export Plant Summary"
                  subtitle="JSON export for operations"
                  loading={exporting === 'plant'}
                  onClick={() => handleExport('plant')}
                />
                <ReportAction
                  title="Download Alarm Log"
                  subtitle="CSV export for alarm history"
                  loading={exporting === 'alarm'}
                  onClick={() => handleExport('alarm')}
                />
                <ReportAction
                  title="Generate Compliance Pack"
                  subtitle="Latest quality metrics CSV"
                  loading={exporting === 'compliance'}
                  onClick={() => handleExport('compliance')}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}

function ReportCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="inline-flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-950 p-3 text-blue-600 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function ReportAction({ title, subtitle, loading, onClick }: { title: string; subtitle: string; loading?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 text-left transition hover:border-blue-400 disabled:opacity-50"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        <Download size={16} className="text-blue-600" />
      </div>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{loading ? 'Exporting...' : subtitle}</p>
    </button>
  );
}
