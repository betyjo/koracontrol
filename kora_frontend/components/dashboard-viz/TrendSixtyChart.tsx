'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { VizStatusLevel } from './types';

export function TrendSixtyChart({
  title,
  unit,
  series,
  statusLevel,
}: {
  title: string;
  unit: string;
  series: { t: string; value: number }[];
  statusLevel: VizStatusLevel;
}) {
  const accent =
    statusLevel === 'alarm'
      ? '#ef4444'
      : statusLevel === 'warning'
        ? '#f59e0b'
        : '#2563eb';

  const formatted = series.map((p) => ({
    ts: new Date(p.t).getTime(),
    value: p.value,
  }));

  const liveEdge = formatted.length >= 2;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Last ~60 seconds{unit ? ` · ${unit}` : ''}
          </p>
        </div>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
            statusLevel === 'alarm'
              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800'
              : statusLevel === 'warning'
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-100 dark:border-blue-900'
          }`}
        >
          {statusLevel}
        </span>
      </div>
      <div
        className={`rounded-2xl h-[172px] w-full px-2 transition-opacity ${
          statusLevel === 'alarm' ? 'motion-safe:animate-pulse opacity-95' : ''
        }`}
      >
        {!liveEdge ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-400 px-6 text-center">
            Waiting for at least two points in this window. Continuous tag pushes make this sweep look fast-moving.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formatted} margin={{ top: 4, left: -12, right: 6, bottom: 4 }}>
              <CartesianGrid
                strokeDasharray="4 12"
                vertical={false}
                stroke="#e2e8f0"
                className="dark:stroke-slate-700"
              />
              <XAxis
                dataKey="ts"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v) =>
                  typeof v === 'number' && Number.isFinite(v)
                    ? new Date(v).toLocaleTimeString([], {
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : ''
                }
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={40}
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                labelFormatter={(label) =>
                  typeof label === 'number' && Number.isFinite(label)
                    ? new Date(label).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : ''
                }
                formatter={(value: unknown) => [
                  typeof value === 'number' ? value.toFixed(3) : String(value),
                  unit.trim() ? unit.trim() : 'reading',
                ]}
                contentStyle={{
                  borderRadius: 10,
                  borderColor: '#e2e8f0',
                  backgroundColor: 'rgba(248,250,252,0.96)',
                  color: '#0f172a',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={accent}
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: accent }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
