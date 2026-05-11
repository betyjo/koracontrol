'use client';

import type { VizStatusLevel } from './types';

const CX = 110;
const CY = 110;

export function CircularGauge({
  title,
  unit,
  value,
  needleDegrees,
  statusLevel,
}: {
  title: string;
  unit: string;
  value: number | null;
  needleDegrees: number | null;
  statusLevel: VizStatusLevel;
}) {
  const needle = needleDegrees ?? -135;
  const dialStroke =
    statusLevel === 'alarm'
      ? 'stroke-red-500/90'
      : statusLevel === 'warning'
        ? 'stroke-amber-500/85'
        : 'stroke-blue-500/85';

  const rimGlow =
    statusLevel === 'alarm'
      ? 'drop-shadow-[0_0_10px_rgba(248,113,113,0.55)] animate-pulse motion-reduce:animate-none'
      : statusLevel === 'warning'
        ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]'
        : 'drop-shadow-[0_0_10px_rgba(59,130,246,0.35)]';

  const display = value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col gap-3 h-full min-h-[200px]">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Pressure / temp ·{' '}
          <span className="font-medium text-blue-700 dark:text-blue-300">{display}</span>
          {unit ? ` ${unit}` : ''}
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <svg viewBox="0 0 220 190" className={`w-[200px] h-[170px] ${rimGlow}`}>
          <defs>
            <linearGradient id="gauge_arc" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#64748b" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.25} />
            </linearGradient>
          </defs>
          {/* bezel */}
          <path
            fill="none"
            stroke="#33415555"
            strokeWidth={18}
            strokeLinecap="round"
            className={`dark:[stroke:rgba(148,163,184,0.25)]`}
            d="M38 154 A94 94 0 1 1 182 154"
          />
          <path
            fill="none"
            stroke="url(#gauge_arc)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray="2 14"
            d="M48 154 A82 82 0 1 1 172 154"
          />

          {/* active arc */}
          <path
            fill="none"
            className={dialStroke}
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.9}
            d="M54 154 A74 74 0 1 1 166 154"
          />

          {[ -135, 0, 135 ].map((deg) => (
            <line
              key={deg}
              x1={CX}
              y1={CY}
              x2={CX}
              y2={56}
              stroke="currentColor"
              className="text-slate-400 dark:text-slate-600"
              strokeWidth={deg === 0 ? 3 : 2}
              opacity={0.55}
              transform={`rotate(${deg} ${CX} ${CY})`}
            />
          ))}

          <circle cx={CX} cy={CY} r={14} className="fill-slate-200 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-500" />

          <g transform={`rotate(${needle} ${CX} ${CY})`} className="transition-transform duration-500 ease-out">
            <line
              x1={CX}
              y1={CY + 6}
              x2={CX}
              y2={58}
              strokeWidth={6}
              strokeLinecap="round"
              stroke="currentColor"
              className={
                statusLevel === 'alarm'
                  ? 'text-red-600 dark:text-red-400'
                  : statusLevel === 'warning'
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-blue-600 dark:text-blue-400'
              }
            />
          </g>
          <circle cx={CX} cy={CY} r={6} className="fill-slate-800 dark:fill-white" stroke="currentColor" strokeWidth={1} />
        </svg>
      </div>
    </div>
  );
}
