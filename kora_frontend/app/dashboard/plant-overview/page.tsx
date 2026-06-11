"use client";
import { useEffect, useState, useCallback } from 'react';
import { Map as MapIcon, Activity, Droplets, Thermometer, Gauge, Waves, Zap, RefreshCw, ChevronRight, X, AlertTriangle, ShieldCheck, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import api, { alarmApi, aiInsightsApi, operationsApi, PlantOverviewArea, PlantOverviewEquipment, EquipmentHealthItem, AlarmEvent, ProcessState } from '@/lib/api';
import { useRealtimeStream } from '@/lib/useRealtimeStream';
import { LineChart, Line, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';

// Default state used before the first SSE / REST response arrives.
const DEFAULT_PROCESS_STATE: ProcessState = {
  tankA: { level: 0, inflow: 0, outflow: 0 },
  tankB: { level: 0, inflow: 0, outflow: 0 },
  tankC: { level: 0, inflow: 0, outflow: 0 },
  mainFlow: 0,
  pressure: 0,
  temperature: 0,
  pumpStatus: 'stopped',
  valveStatus: { inlet: false, outlet: false, bypass: false },
};

function clampLevel(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * useProcessState
 * ----------------
 * Replaces the previous `useProcessSimulation` Math.random() hook.
 *
 * 1. On mount, fetch a REST snapshot from `/operations/process-state/`
 *    so the UI has real values immediately.
 * 2. Subscribe to the SSE stream (`process_state` events) for live updates
 *    pushed by the MQTT consumer daemon + Django `realtime_service.py`.
 * 3. Periodically poll the REST endpoint as a safety net for dropped SSE
 *    events (e.g. when the user tab is backgrounded).
 */
function useProcessState(): ProcessState {
  const [state, setState] = useState<ProcessState>(DEFAULT_PROCESS_STATE);
  const [hydrated, setHydrated] = useState(false);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await operationsApi.getProcessState();
      const incoming = res.data;
      if (!incoming) return;
      setState((prev) => ({
        ...prev,
        ...incoming,
        tankA: { ...prev.tankA, ...incoming.tankA, level: clampLevel(incoming.tankA?.level ?? 0) },
        tankB: { ...prev.tankB, ...incoming.tankB, level: clampLevel(incoming.tankB?.level ?? 0) },
        tankC: { ...prev.tankC, ...incoming.tankC, level: clampLevel(incoming.tankC?.level ?? 0) },
        valveStatus: { ...prev.valveStatus, ...(incoming.valveStatus || {}) },
      }));
    } catch (err) {
      // Non-fatal — SSE may still be flowing.
      console.warn('process-state snapshot failed:', err);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  useRealtimeStream({
    channels: ['process', 'tags'],
    events: ['process_state'],
    enabled: hydrated,
    onEvent: (data, eventName) => {
      if (eventName !== 'process_state') return;
      const incoming = data as Partial<ProcessState>;
      if (!incoming || typeof incoming !== 'object') return;
      setState((prev) => ({
        ...prev,
        ...incoming,
        tankA: { ...prev.tankA, ...(incoming.tankA || {}), level: clampLevel(incoming.tankA?.level ?? prev.tankA.level) },
        tankB: { ...prev.tankB, ...(incoming.tankB || {}), level: clampLevel(incoming.tankB?.level ?? prev.tankB.level) },
        tankC: { ...prev.tankC, ...(incoming.tankC || {}), level: clampLevel(incoming.tankC?.level ?? prev.tankC.level) },
        valveStatus: { ...prev.valveStatus, ...(incoming.valveStatus || {}) },
      }));
    },
  });

  return state;
}

export default function PlantOverviewPage() {
  const [areas, setAreas] = useState<PlantOverviewArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<PlantOverviewArea | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<PlantOverviewEquipment | null>(null);
  const [equipmentHealth, setEquipmentHealth] = useState<EquipmentHealthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'alarmed'>('all');
  const [viewMode, setViewMode] = useState<'pid' | 'cascade'>('cascade');
  const process = useProcessState();
  // Treat the cascade as "live" as soon as we have any non-zero reading
  // (REST snapshot or first SSE frame). If everything is still 0 the user
  // sees the WAITING pill so they know to start the bridge.
  const cascadeLive =
    process.mainFlow > 0 ||
    process.pressure > 0 ||
    process.tankA.level > 0 ||
    process.tankB.level > 0 ||
    process.tankC.level > 0;

  const fetchData = useCallback(async () => {
    try {
      const res = await operationsApi.getPlantOverview();
      const areasData = res.data.areas || [];
      setAreas(areasData);
      setSelectedArea((prev) => {
        const matched = prev ? areasData.find((area) => area.id === prev.id) : null;
        return matched ?? areasData[0] ?? null;
      });

      const healthRes = await aiInsightsApi.getEquipmentHealth();
      setEquipmentHealth(healthRes.data || []);
    } catch (err) {
      console.error('Failed to load plant overview:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getStatusColor = (alarmCount: number) => (alarmCount > 0 ? '#EF4444' : '#10B981');
  const getStatusLabel = (alarmCount: number) => (alarmCount > 0 ? `${alarmCount} alarm${alarmCount !== 1 ? 's' : ''}` : 'Normal');

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                <Droplets className="text-blue-500" />
                Plant Overview
              </h1>
              <p className="text-slate-600 dark:text-slate-300">Real-time process visualization with multi-tank cascade system monitoring.</p>
            </div>
            <button onClick={fetchData} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
              <RefreshCw className="text-slate-600 dark:text-slate-300" size={20} />
            </button>
          </div>
        </header>

        {/* View Mode Toggle */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              onClick={() => setViewMode('cascade')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'cascade' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <Waves size={16} />
              Cascade View
            </button>
            <button
              onClick={() => setViewMode('pid')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'pid' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <MapIcon size={16} />
              P&ID View
            </button>
          </div>

          {viewMode === 'pid' && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}>
                All Status
              </button>
              <button
                onClick={() => setFilter('alarmed')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'alarmed' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}>
                Alarms Only
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Activity className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="text-slate-500">Loading plant topology...</p>
          </div>
        ) : viewMode === 'cascade' ? (
          <CascadeView process={process} live={cascadeLive} />
        ) : selectedArea ? (
          <PIDView 
            areas={areas} 
            selectedArea={selectedArea} 
            setSelectedArea={setSelectedArea} 
            filter={filter} 
            selectedEquipment={selectedEquipment} 
            setSelectedEquipment={setSelectedEquipment} 
            getStatusColor={getStatusColor} 
            getStatusLabel={getStatusLabel} 
            equipmentHealth={equipmentHealth}
          />
        ) : (
          <div className="py-24 text-center text-slate-500 dark:text-slate-400">No plant overview data available.</div>
        )}
      </div>

      <AnimatePresence>
        {selectedEquipment && (
          <EquipmentDetailDrawer 
            equipment={selectedEquipment} 
            onClose={() => setSelectedEquipment(null)} 
            healthItem={equipmentHealth.find(h => h.equipment_type === selectedEquipment.name.toLowerCase().replace(' ', '_')) || null}
            getStatusColor={getStatusColor}
            getStatusLabel={getStatusLabel}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

// --- Cascade View Component ---
function CascadeView({ process, live }: { process: ProcessState; live: boolean }) {
  return (
    <div className="space-y-6">
      {/* Process Flow Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={<Gauge className="text-blue-500" />} label="Main Flow" value={`${process.mainFlow.toFixed(1)} L/min`} trend="stable" />
        <MetricCard icon={<Gauge className="text-purple-500" />} label="Pressure" value={`${process.pressure.toFixed(2)} bar`} trend={process.pressure > 4.5 ? 'up' : 'stable'} />
        <MetricCard icon={<Thermometer className="text-orange-500" />} label="Temperature" value={`${process.temperature.toFixed(1)} °C`} trend="stable" />
        <MetricCard icon={<Zap className={process.pumpStatus === 'running' ? 'text-green-500' : 'text-red-500'} />} label="Pump Status" value={process.pumpStatus.toUpperCase()} trend={process.pumpStatus === 'running' ? 'stable' : 'down'} />
      </div>

      {/* Cascade Visualization */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Waves className="text-blue-500" size={24} />
            Multi-Tank Cascade System
          </h2>
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full ${
              live
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}
            data-testid="cascade-live-status"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                live ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {live ? 'LIVE • simulation engine' : 'WAITING • start MQTT consumer + simulation bridge'}
          </span>
        </div>
        
        <div className="relative">
          <svg viewBox="0 0 900 400" className="w-full h-[400px]">
            <defs>
              <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="pipeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Intake pipe */}
            <rect x="0" y="100" width="80" height="20" fill="url(#pipeGradient)" rx="4" />
            <motion.circle
              animate={{ cx: [10, 70] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              cy="110" r="6" fill="#60a5fa"
            />

            {/* Tank A */}
            <TankComponent x={80} y={40} width={180} height={180} level={process.tankA.level} label="Tank A" sublabel="Primary Intake" color="#3b82f6" />
            
            {/* Pipe A to B */}
            <rect x="260" y="180" width="80" height="20" fill="url(#pipeGradient)" rx="4" />
            <motion.circle
              animate={{ cx: [270, 330] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              cy="190" r="5" fill="#60a5fa"
            />
            <text x="300" y="170" textAnchor="middle" fontSize="10" fill="#64748b">{process.tankA.outflow.toFixed(0)} L/m</text>

            {/* Tank B */}
            <TankComponent x={340} y={60} width={180} height={160} level={process.tankB.level} label="Tank B" sublabel="Treatment" color="#8b5cf6" />
            
            {/* Pipe B to C */}
            <rect x="520" y="200" width="80" height="20" fill="url(#pipeGradient)" rx="4" />
            <motion.circle
              animate={{ cx: [530, 590] }}
              transition={{ duration: 1.0, repeat: Infinity, ease: "linear" }}
              cy="210" r="5" fill="#60a5fa"
            />
            <text x="560" y="190" textAnchor="middle" fontSize="10" fill="#64748b">{process.tankB.outflow.toFixed(0)} L/m</text>

            {/* Tank C */}
            <TankComponent x={600} y={80} width={180} height={140} level={process.tankC.level} label="Tank C" sublabel="Final Treatment" color="#06b6d4" />

            {/* Output pipe */}
            <rect x="780" y="150" width="120" height="20" fill="url(#pipeGradient)" rx="4" />
            <motion.circle
              animate={{ cx: [790, 890] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              cy="160" r="6" fill="#60a5fa"
            />
            <text x="840" y="140" textAnchor="middle" fontSize="10" fill="#64748b">Output</text>

            {/* Valve indicators */}
            <ValveIndicator x={50} y={130} open={process.valveStatus.inlet} label="Inlet" />
            <ValveIndicator x={270} y={210} open={process.valveStatus.outlet} label="V1" />
            <ValveIndicator x={530} y={230} open={true} label="V2" />
            <ValveIndicator x={790} y={180} open={process.valveStatus.outlet} label="Outlet" />
            
            {/* Pump indicator */}
            <PumpIndicator x={30} y={60} running={process.pumpStatus === 'running'} />
          </svg>
        </div>

        {/* Tank Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <TankStatsCard tank={process.tankA} label="Tank A - Primary" color="#3b82f6" />
          <TankStatsCard tank={process.tankB} label="Tank B - Treatment" color="#8b5cf6" />
          <TankStatsCard tank={process.tankC} label="Tank C - Final" color="#06b6d4" />
        </div>
      </div>

      {/* System Health Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SystemHealthCard label="Cascade Efficiency" value={85} unit="%" status="good" />
        <SystemHealthCard label="Total Volume" value={process.tankA.level * 100 + process.tankB.level * 80 + process.tankC.level * 60} unit="L" status="good" />
        <SystemHealthCard label="Active Pumps" value={1} unit="/1" status="good" />
        <SystemHealthCard label="System Pressure" value={process.pressure} unit="bar" status={process.pressure > 4.5 ? 'warning' : 'good'} />
      </div>
    </div>
  );
}

// --- Tank Component for SVG ---
function TankComponent({ x, y, width, height, level, label, sublabel, color }: { x: number; y: number; width: number; height: number; level: number; label: string; sublabel: string; color: string }) {
  const waterHeight = (level / 100) * (height - 20);
  const waterY = y + height - waterHeight - 10;
  
  return (
    <g>
      {/* Tank body */}
      <rect x={x} y={y} width={width} height={height} rx="12" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="3" className="dark:fill-slate-800" />
      
      {/* Water fill */}
      <motion.rect
        x={x + 5}
        y={waterY}
        width={width - 10}
        height={waterHeight}
        rx="8"
        fill="url(#waterGradient)"
        animate={{ y: waterY, height: waterHeight }}
        transition={{ duration: 0.5 }}
      />
      
      {/* Level lines */}
      {[20, 40, 60, 80].map(mark => (
        <line key={mark} x1={x + 10} y1={y + height - (mark / 100) * (height - 20) - 10} x2={x + 25} y2={y + height - (mark / 100) * (height - 20) - 10} stroke="#cbd5e1" strokeWidth="1" />
      ))}
      
      {/* Labels */}
      <text x={x + width / 2} y={y - 10} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b" className="dark:fill-white">{label}</text>
      <text x={x + width / 2} y={y + 20} textAnchor="middle" fontSize="10" fill="#64748b">{sublabel}</text>
      
      {/* Level percentage */}
      <text x={x + width / 2} y={y + height / 2} textAnchor="middle" fontSize="28" fontWeight="700" fill="#1e293b" filter="url(#glow)" className="dark:fill-white">{level.toFixed(0)}%</text>
      
      {/* Status indicator */}
      <circle cx={x + width - 15} cy={y + 15} r="8" fill={level > 80 ? '#22c55e' : level > 30 ? '#f59e0b' : '#ef4444'}>
        <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

function ValveIndicator({ x, y, open, label }: { x: number; y: number; open: boolean; label: string }) {
  return (
    <g>
      <polygon points={`${x},${y - 8} ${x + 16},${y} ${x},${y + 8}`} fill={open ? '#22c55e' : '#ef4444'} />
      <polygon points={`${x + 16},${y - 8} ${x},${y} ${x + 16},${y + 8}`} fill={open ? '#22c55e' : '#ef4444'} />
      <text x={x + 8} y={y + 20} textAnchor="middle" fontSize="8" fill="#64748b">{label}</text>
    </g>
  );
}

function PumpIndicator({ x, y, running }: { x: number; y: number; running: boolean }) {
  return (
    <g>
      <circle cx={x + 15} cy={y + 15} r="15" fill={running ? '#22c55e' : '#94a3b8'} stroke="#64748b" strokeWidth="2" />
      {running && (
        <motion.path
          d={`M${x + 8} ${y + 15} L${x + 15} ${y + 8} L${x + 22} ${y + 15} L${x + 15} ${y + 22} Z`}
          fill="white"
          animate={{ rotate: 360 }}
          style={{ transformOrigin: `${x + 15}px ${y + 15}px` }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      )}
      <text x={x + 15} y={y + 40} textAnchor="middle" fontSize="8" fill="#64748b">Pump</text>
    </g>
  );
}

function TankStatsCard({ tank, label, color }: { tank: { level: number; inflow: number; outflow: number }; label: string; color: string }) {
  const netFlow = tank.inflow - tank.outflow;
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-semibold text-slate-900 dark:text-white">{label}</span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Level</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-white">{tank.level.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Inflow</span>
          <span className="font-mono text-green-600">{tank.inflow.toFixed(1)} L/m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Outflow</span>
          <span className="font-mono text-red-600">{tank.outflow.toFixed(1)} L/m</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400">Net Flow</span>
          <span className={`font-mono font-semibold ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {netFlow >= 0 ? '+' : ''}{netFlow.toFixed(1)} L/m
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value: string; trend: 'up' | 'down' | 'stable' }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-slate-900 dark:text-white">{value}</span>
        <span className={`text-xs font-semibold ${trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-blue-500' : 'text-slate-400'}`}>
          {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '●'}
        </span>
      </div>
    </div>
  );
}

function SystemHealthCard({ label, value, unit, status }: { label: string; value: number; unit: string; status: 'good' | 'warning' | 'critical' }) {
  const statusColors = {
    good: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-900 dark:text-white">
          {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}
        </span>
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
      <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[status]}`}>
        {status.toUpperCase()}
      </span>
    </div>
  );
}

// --- PID View Component ---
function PIDView({ areas, selectedArea, setSelectedArea, filter, selectedEquipment, setSelectedEquipment, getStatusColor, getStatusLabel, equipmentHealth }: {
  areas: PlantOverviewArea[];
  selectedArea: PlantOverviewArea;
  setSelectedArea: (area: PlantOverviewArea) => void;
  filter: 'all' | 'alarmed';
  selectedEquipment: PlantOverviewEquipment | null;
  setSelectedEquipment: (eq: PlantOverviewEquipment | null) => void;
  getStatusColor: (count: number) => string;
  getStatusLabel: (count: number) => string;
  equipmentHealth: EquipmentHealthItem[];
}) {
  // Calculate aggregate area metrics
  const flowEquips = selectedArea.equipment.filter(e => e.name.toLowerCase().includes('flow') || e.code.toLowerCase().startsWith('f'));
  const pressEquips = selectedArea.equipment.filter(e => e.name.toLowerCase().includes('pressure') || e.code.toLowerCase().startsWith('pr'));
  const alarmsCount = selectedArea.equipment.reduce((acc, e) => acc + (e.alarm_count ?? 0), 0);
  
  const avgFlow = flowEquips.length ? flowEquips.reduce((sum, e) => sum + (e.current_value || 0), 0) / flowEquips.length : 45.2;
  const avgPress = pressEquips.length ? pressEquips.reduce((sum, e) => sum + (e.current_value || 0), 0) / pressEquips.length : 3.8;
  
  const areaHealths = selectedArea.equipment.map(e => {
    const item = equipmentHealth.find(h => h.equipment_type === e.name.toLowerCase().replace(' ', '_'));
    return item ? item.health_score : 0.95;
  });
  const avgHealth = areaHealths.length ? areaHealths.reduce((sum, v) => sum + v, 0) / areaHealths.length : 0.95;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <aside className="lg:col-span-1 space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Area Summary</h2>
          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex justify-between">
              <span>Area code</span>
              <span className="font-semibold text-slate-900 dark:text-white">{selectedArea.code}</span>
            </div>
            <div className="flex justify-between">
              <span>Total units</span>
              <span className="font-semibold text-slate-900 dark:text-white">{selectedArea.equipment.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Alarms active</span>
              <span className="font-semibold text-red-600">{alarmsCount}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {areas.map((area) => (
            <button
              key={area.id}
              onClick={() => { setSelectedArea(area); setSelectedEquipment(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${selectedArea?.id === area.id ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>
              {area.name}
            </button>
          ))}
        </div>
      </aside>

      <main className="lg:col-span-3">
        {/* Area level KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Avg Flow Rate</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block font-mono">{avgFlow.toFixed(1)} L/m</span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Avg Pressure</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block font-mono">{avgPress.toFixed(2)} bar</span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Active Alarms</span>
            <span className={`text-xl font-bold mt-1 block font-mono ${alarmsCount > 0 ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
              {alarmsCount} Active
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Area Health Index</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block font-mono">{(avgHealth * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="relative rounded-3xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="absolute top-4 left-4 flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <MapIcon size={16} />
            <span className="text-xs font-semibold uppercase tracking-[0.25em]">{selectedArea.name} Layout</span>
          </div>
          <div className="pt-10">
            <svg viewBox="0 0 960 560" className="w-full h-[560px] rounded-3xl overflow-visible">
              <defs>
                <linearGradient id="plantPipeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>

              <rect x="64" y="100" width="832" height="120" rx="60" fill="url(#plantPipeGradient)" opacity="0.35" />
              <rect x="64" y="340" width="832" height="120" rx="60" fill="url(#plantPipeGradient)" opacity="0.35" />
              <path d="M220 220 L220 340" stroke="#94a3b8" strokeWidth="18" strokeLinecap="round" opacity="0.6" />
              <path d="M480 220 L480 340" stroke="#94a3b8" strokeWidth="18" strokeLinecap="round" opacity="0.6" />
              <path d="M740 220 L740 340" stroke="#94a3b8" strokeWidth="18" strokeLinecap="round" opacity="0.6" />

              {/* Pipe Flow Animation Dots */}
              <g>
                {/* Horizontal pipe 1 flow */}
                <motion.circle cx={64} cy={160} r="4" fill="#38bdf8" animate={{ cx: [64, 896] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }} />
                <motion.circle cx={64} cy={160} r="4" fill="#38bdf8" animate={{ cx: [64, 896] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear', delay: 1.2 }} />
                <motion.circle cx={64} cy={160} r="4" fill="#38bdf8" animate={{ cx: [64, 896] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear', delay: 2.4 }} />

                {/* Horizontal pipe 2 flow */}
                <motion.circle cx={64} cy={400} r="4" fill="#38bdf8" animate={{ cx: [64, 896] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }} />
                <motion.circle cx={64} cy={400} r="4" fill="#38bdf8" animate={{ cx: [64, 896] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear', delay: 1.7 }} />

                {/* Vertical pipe 1 flow */}
                <motion.circle cx={220} cy={220} r="3" fill="#3b82f6" animate={{ cy: [220, 340] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }} />
                
                {/* Vertical pipe 2 flow */}
                <motion.circle cx={480} cy={220} r="3" fill="#3b82f6" animate={{ cy: [220, 340] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }} />

                {/* Vertical pipe 3 flow */}
                <motion.circle cx={740} cy={220} r="3" fill="#3b82f6" animate={{ cy: [220, 340] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }} />
              </g>

              {selectedArea.equipment
                .filter((eq) => filter === 'all' || (eq.alarm_count ?? 0) > 0)
                .map((equipment, idx) => {
                  const rect = getEquipmentRect(equipment, idx);
                  const fillColor = (equipment.alarm_count ?? 0) > 0 ? '#fee2e2' : '#f8fafc';
                  const strokeColor = (equipment.alarm_count ?? 0) > 0 ? '#ef4444' : '#38bdf8';
                  
                  // Map equipment health score
                  const healthItem = equipmentHealth.find(h => h.equipment_type === equipment.name.toLowerCase().replace(' ', '_'));
                  const healthScore = healthItem ? healthItem.health_score : 0.95;
                  const healthColor = healthScore >= 0.8 ? '#10b981' : healthScore >= 0.6 ? '#f59e0b' : '#ef4444';

                  return (
                    <g key={equipment.id} className="cursor-pointer" onClick={() => setSelectedEquipment(equipment)}>
                      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx="20" fill={fillColor} stroke={strokeColor} strokeWidth="4" />
                      <text x={rect.x + 18} y={rect.y + 30} fontSize="16" fontWeight="700" fill="#0f172a">{equipment.code}</text>
                      <text x={rect.x + 18} y={rect.y + 54} fontSize="12" fill="#475569">{equipment.name}</text>
                      <text x={rect.x + 18} y={rect.y + 76} fontSize="12" fill="#0f172a">{equipment.current_value !== null ? equipment.current_value.toFixed(1) : 'Offline'}</text>
                      
                      {/* Health score badge */}
                      <g transform={`translate(${rect.x + 18}, ${rect.y + 88})`}>
                        <rect width="65" height="15" rx="4" fill={healthColor} />
                        <text x="32.5" y="11" textAnchor="middle" fontSize="8" fontWeight="700" fill="#ffffff">
                          Health: {(healthScore * 100).toFixed(0)}%
                        </text>
                      </g>

                      {/* Floating value overlay badge */}
                      {equipment.current_value !== null && (
                        <g transform={`translate(${rect.x + rect.width - 90}, ${rect.y - 12})`}>
                          <rect width="80" height="22" rx="11" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" className="filter drop-shadow-md" />
                          <text x="40" y="14" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ffffff">
                            {equipment.current_value.toFixed(1)} {
                              equipment.name.toLowerCase().includes('flow') || equipment.code.toLowerCase().startsWith('f') ? 'L/m' :
                              equipment.name.toLowerCase().includes('pressure') || equipment.code.toLowerCase().startsWith('pr') ? 'bar' :
                              equipment.name.toLowerCase().includes('level') || equipment.code.toLowerCase().startsWith('l') ? '%' : ''
                            }
                          </text>
                        </g>
                      )}

                      {(equipment.alarm_count ?? 0) > 0 && (
                        <g>
                          <circle cx={rect.x + rect.width - 20} cy={rect.y + 20} r="16" fill="#ef4444" />
                          <text x={rect.x + rect.width - 20} y={rect.y + 24} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{(equipment.alarm_count ?? 0)}</text>
                        </g>
                      )}
                    </g>
                  );
                })}
            </svg>
          </div>
        </div>
      </main>
    </div>
  );
}

interface DrawerProps {
  equipment: PlantOverviewEquipment | null;
  onClose: () => void;
  healthItem: EquipmentHealthItem | null;
  getStatusColor: (count: number) => string;
  getStatusLabel: (count: number) => string;
}

interface HistoryDataPoint {
  time: string;
  value: number;
}

function EquipmentDetailDrawer({ equipment, onClose, healthItem, getStatusColor, getStatusLabel }: DrawerProps) {
  const [history, setHistory] = useState<HistoryDataPoint[]>([]);
  const [alarms, setAlarms] = useState<AlarmEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!equipment?.primary_tag_id) return;
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // Fetch tag log history
    api.get(`/history/query/?tag_id=${equipment.primary_tag_id}`)
      .then(res => {
        const raw = res.data.data || [];
        const formatted = raw.slice(-25).map((pt: { timestamp: string; value: number }) => ({
          time: new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          value: pt.value
        }));
        setHistory(formatted);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));

    // Fetch alarm events
    alarmApi.listEvents({ tag_id: equipment.primary_tag_id })
      .then(res => {
        setAlarms(res.data || []);
      })
      .catch(err => console.error(err));

  }, [equipment]);

  if (!equipment) return null;

  const healthScore = healthItem ? healthItem.health_score * 100 : 95;
  const status = healthItem ? healthItem.status : 'healthy';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 h-screen w-full md:w-[450px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-6 overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b dark:border-slate-800">
          <div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">{equipment.code}</span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{equipment.name}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Health Score Panel */}
        <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/45 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-500">Asset Health Score</span>
            <span className={`text-xs font-bold capitalize px-2.5 py-0.5 rounded-full ${
              status === 'critical' ? 'bg-red-105 text-red-700' :
              status === 'warning' ? 'bg-amber-105 text-amber-700' :
              status === 'degrading' ? 'bg-blue-105 text-blue-700' : 'bg-green-105 text-green-700'
            }`}>
              {status}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  healthScore >= 80 ? 'bg-green-500' : healthScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <span className="text-lg font-bold font-mono text-slate-800 dark:text-white">{healthScore.toFixed(0)}%</span>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-xl">
            <span className="text-xs text-slate-500 block">Current Value</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white mt-1 block">
              {equipment.current_value !== null ? equipment.current_value.toFixed(2) : 'Offline'}
            </span>
          </div>
          <div className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-xl">
            <span className="text-xs text-slate-500 block">Alarm Status</span>
            <span 
              className="text-lg font-bold mt-1 block"
              style={{ color: getStatusColor(equipment.alarm_count ?? 0) }}
            >
              {getStatusLabel(equipment.alarm_count ?? 0)}
            </span>
          </div>
        </div>

        {/* Tag History Sparkline */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-350 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" /> Recent Value Trend
          </h4>
          <div className="h-44 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-xl p-3 flex flex-col justify-center">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-blue-500" size={24} />
              </div>
            ) : history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <ChartTooltip 
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px'
                    }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-xs text-slate-400 py-10">No recent data points</div>
            )}
          </div>
        </div>

        {/* Alarm History Log */}
        <div>
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-350 mb-3 flex items-center gap-2">
            <Clock size={16} className="text-red-500" /> Alarm History
          </h4>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {alarms.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No alarm logs for this equipment.
              </div>
            ) : (
              alarms.slice(0, 10).map((alarm, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-slate-150 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 text-xs">
                  <div className="flex justify-between items-start">
                    <span className={`font-semibold capitalize ${
                      alarm.severity === 'critical' ? 'text-red-600' :
                      alarm.severity === 'high' ? 'text-orange-600' : 'text-slate-600'
                    }`}>
                      {alarm.severity} Alert
                    </span>
                    <span className="text-slate-400 text-[10px]">{new Date(alarm.triggered_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mt-1 leading-normal font-sans">{alarm.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

type RectBounds = { x: number; y: number; width: number; height: number };

function isRectBounds(rect: unknown): rect is RectBounds {
  if (typeof rect !== 'object' || rect === null) return false;
  const candidate = rect as Record<string, unknown>;
  return typeof candidate.x === 'number' && typeof candidate.y === 'number' && typeof candidate.width === 'number' && typeof candidate.height === 'number';
}

function getEquipmentRect(equipment: PlantOverviewEquipment, index: number): RectBounds {
  const rect = equipment.map_rect;
  if (isRectBounds(rect)) return rect;
  const column = index % 3;
  const row = Math.floor(index / 3);
  return { x: 80 + column * 280, y: 120 + row * 160, width: 220, height: 120 };
}
