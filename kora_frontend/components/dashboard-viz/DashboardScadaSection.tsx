'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { CircularGauge } from './CircularGauge';
import { LiquidTank } from './LiquidTank';
import { NeonStatusIndicator } from './NeonStatusIndicator';
import { TrendSixtyChart } from './TrendSixtyChart';
import type { VizLivePanel } from './types';

interface VizPayload {
  panels: VizLivePanel[];
  refreshed_at: string;
}

function renderWidget(panel: VizLivePanel) {
  switch (panel.widget_type) {
    case 'tank':
      return (
        <LiquidTank
          title={panel.title}
          unit={panel.unit}
          value={panel.value}
          fillRatio={panel.fill_ratio}
          statusLevel={panel.status_level}
        />
      );
    case 'gauge':
      return (
        <CircularGauge
          title={panel.title}
          unit={panel.unit}
          value={panel.value}
          needleDegrees={panel.needle_degrees}
          statusLevel={panel.status_level}
        />
      );
    case 'status':
      return (
        <NeonStatusIndicator
          title={panel.title}
          unit={panel.unit}
          value={panel.value}
          statusLevel={panel.status_level}
        />
      );
    case 'trend':
      return (
        <TrendSixtyChart
          title={panel.title}
          unit={panel.unit}
          series={panel.series || []}
          statusLevel={panel.status_level}
        />
      );
    default:
      return null;
  }
}

export default function DashboardScadaSection() {
  const [data, setData] = useState<VizPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await api.get<VizPayload>('dashboard/viz-live/');
        if (!cancelled) setData(res.data);
      } catch {
        /* keep last good payload for operators */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const id = window.setInterval(poll, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const panels = data?.panels ?? [];

  if (loading && panels.length === 0) {
    return (
      <div className="mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-8 py-10 flex justify-center shadow-sm transition-colors duration-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Loading SCADA visuals" />
      </div>
    );
  }

  if (panels.length === 0) {
    return (
      <div className="mb-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/60 px-6 py-10 text-center text-slate-500 dark:text-slate-400 text-sm shadow-sm">
        No live SCADA widgets yet. Operators can attach sensors from{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          Django Admin → Dashboard visuals
        </span>{' '}
        (tank · gauge · neon status · 60-second trend chart).
      </div>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex flex-wrap justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Industrial instrumentation
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configured via admin dashboards — updates every second for pumps, reactors, boilers, substations…
          </p>
        </div>
        {data?.refreshed_at && (
          <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 self-start">
            Live&nbsp;±1&nbsp;s&nbsp;UTC
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-5">
        {panels.map((panel) => (
          <div
            key={panel.id}
            className={`rounded-2xl border shadow-sm backdrop-blur-[1px] transition-colors duration-500 p-5 
              bg-gradient-to-br from-white via-blue-50/30 to-transparent 
              dark:from-slate-900 dark:via-blue-950/15 dark:to-slate-950
              border-slate-200 dark:border-slate-800 hover:shadow-md
              ${panel.widget_type === 'trend' ? 'md:col-span-2 xl:col-span-6' : 'md:col-span-1 xl:col-span-2'}
            `}
          >
            {renderWidget(panel)}
          </div>
        ))}
      </div>
    </section>
  );
}
