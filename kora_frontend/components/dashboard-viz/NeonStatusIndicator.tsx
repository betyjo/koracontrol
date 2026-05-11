'use client';

import type { VizStatusLevel } from './types';

export function NeonStatusIndicator({
  title,
  unit,
  value,
  statusLevel,
}: {
  title: string;
  unit: string;
  value: number | null;
  statusLevel: VizStatusLevel;
}) {
  const display = value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const styles: Record<
    VizStatusLevel,
    { orb: string; ring: string; label: string; pulse: boolean }
  > = {
    normal: {
      orb: 'bg-emerald-400 dark:bg-emerald-400 shadow-[inset_0_0_10px_rgba(255,255,255,.45)]',
      ring: 'ring-emerald-300/95 shadow-[0_0_24px_rgba(34,197,94,0.92),0_0_52px_rgba(34,197,94,0.35)]',
      label: 'text-emerald-700 dark:text-emerald-400',
      pulse: false,
    },
    warning: {
      orb: 'bg-amber-400 dark:bg-amber-400 shadow-[inset_0_0_10px_rgba(255,255,255,.4)]',
      ring: 'ring-amber-200/95 shadow-[0_0_20px_rgba(251,191,36,0.85)]',
      label: 'text-amber-800 dark:text-amber-300',
      pulse: false,
    },
    alarm: {
      orb: 'bg-red-500 dark:bg-red-600 shadow-[inset_0_0_10px_rgba(255,255,255,.25)]',
      ring: 'ring-red-400/95 shadow-[0_0_22px_rgba(239,68,68,1),0_0_54px_rgba(239,68,68,.45)]',
      label: 'text-red-800 dark:text-red-400',
      pulse: true,
    },
  };

  const s = styles[statusLevel];
  const cap =
    statusLevel === 'alarm' ? 'ALARM' : statusLevel === 'warning' ? 'WARNING' : 'NORMAL';

  return (
    <div className="flex flex-col gap-4 h-full min-h-[188px]">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{unit ? `Reading (${unit})` : 'Reading'}</p>
      </div>

      <div className="flex flex-1 items-center justify-center gap-5">
        <div
          className={`relative w-28 h-28 rounded-full ring-4 ${s.ring} ${s.pulse ? 'motion-safe:animate-pulse' : ''}`}
        >
          <div className={`absolute inset-2 rounded-full ${s.orb}`} />
        </div>

        <div className="text-left space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
          <p className={`text-lg font-black tracking-[0.2em] ${s.label}`}>{cap}</p>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Live value</p>
          <p className={`text-3xl font-bold tracking-tight text-slate-900 dark:text-white`}>{display}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mapped from Django admin alarm & warning bounds.
          </p>
        </div>
      </div>
    </div>
  );
}
