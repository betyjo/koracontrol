'use client';

import type { VizStatusLevel } from './types';

export function LiquidTank({
  title,
  unit,
  value,
  fillRatio,
  statusLevel,
}: {
  title: string;
  unit: string;
  value: number | null;
  fillRatio: number | null;
  statusLevel: VizStatusLevel;
}) {
  const pct = Math.round((fillRatio ?? 0) * 1000) / 10;
  const display = value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const liquidClass =
    statusLevel === 'alarm'
      ? 'from-orange-600 via-red-500 to-red-700'
      : statusLevel === 'warning'
        ? 'from-amber-400 via-amber-500 to-orange-600'
        : 'from-blue-600 via-blue-500 to-cyan-400';

  const shimmer =
    statusLevel === 'alarm' ? 'animate-pulse motion-reduce:animate-none' : 'transition-[height] duration-500 ease-out';

  return (
    <div className="flex flex-col gap-3 h-full min-h-[220px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tank level ·{' '}
            <span className="font-medium text-blue-700 dark:text-blue-300">{display}</span>
            {unit ? ` ${unit}` : ''}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wide font-bold text-blue-600/80 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-1 rounded-full">
          {pct.toFixed(0)}%
        </span>
      </div>

      <div className="flex-1 flex justify-center pt-2">
        <div className="relative w-[112px] h-[148px]">
          {/* Cylinder */}
          <div className="absolute inset-0 rounded-[3rem_3rem_2rem_2rem] bg-gradient-to-b from-slate-200/70 to-slate-300/50 dark:from-slate-700 dark:to-slate-800 shadow-inner border border-slate-300 dark:border-slate-600 overflow-hidden ring-2 ring-black/10 dark:ring-white/15">
            <div className="absolute inset-x-[8px] bottom-[8px] top-[26px] rounded-[2rem_2rem_1.5rem_1.5rem] bg-slate-900/90 dark:bg-slate-950/90 overflow-hidden">
              <div
                className={`absolute bottom-0 left-0 right-0 rounded-b-[inherit] bg-gradient-to-t ${liquidClass} opacity-95 ${shimmer}`}
                style={{ height: `${Math.min(100, Math.max(2, pct))}%` }}
              />
              {/* liquid surface ripple */}
              <div
                className="pointer-events-none absolute left-2 right-2 h-[6px] rounded-full bg-white/35 blur-[1px]"
                style={{ bottom: `calc(${Math.min(100, Math.max(2, pct))}% - 2px)` }}
              />
              <div className="pointer-events-none absolute inset-x-6 top-[10px] h-px bg-white/40 rounded-full blur-[2px]" />
            </div>
          </div>
          <div className="absolute -bottom-3 left-[10%] right-[10%] h-7 rounded-[50%] bg-slate-300/60 dark:bg-slate-800/70 border border-black/25 dark:border-white/10 blur-[6px]" />
        </div>
      </div>
    </div>
  );
}
