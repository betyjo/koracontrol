"use client";
import { useEffect, useState } from 'react';
import { AlertCircle, Zap, Waves, Map as MapIcon, Box, Activity, ChevronRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import api from '@/lib/api';

interface Equipment {
  id: number;
  code: string;
  name: string;
  current_value: number | null;
  primary_tag_name: string | null;
  alarm_count: number;
  map_rect: any;
}

interface PlantArea {
  id: number;
  code: string;
  name: string;
  layout: any;
  equipment: Equipment[];
}

export default function PlantOverviewPage() {
  const [areas, setAreas] = useState<PlantArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<PlantArea | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'alarmed'>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/operations/plant-overview/');
        const areasData = res.data.areas || [];
        setAreas(areasData);
        if (areasData.length > 0 && !selectedArea) {
          setSelectedArea(areasData[0]);
        }
      } catch (err) {
        console.error('Failed to load plant overview:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (alarmCount: number) => {
    if (alarmCount > 0) return '#EF4444'; // Red for alarms
    return '#10B981'; // Green for normal
  };

  const getStatusLabel = (alarmCount: number) => {
    if (alarmCount > 0) return `${alarmCount} alarm${alarmCount !== 1 ? 's' : ''}`;
    return 'Normal';
  };

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Plant Overview</h1>
          <p className="text-slate-600 dark:text-slate-300">Real-time P&ID-style view of equipment status and alarms</p>
        </header>

        {/* Filter & Area Selection */}
        <div className="mb-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setFilter('alarmed')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'alarmed'
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              Alarms Only
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {areas.map(area => (
              <button
                key={area.id}
                onClick={() => setSelectedArea(area)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                  selectedArea?.id === area.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'
                }`}
              >
                {area.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Activity className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="text-slate-500">Scanning plant network...</p>
          </div>
        ) : selectedArea && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar: Area Stats */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Info size={18} className="text-blue-600" />
                  Area Overview
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Status</span>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">Healthy</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Total Units</span>
                    <span className="font-bold">{selectedArea.equipment.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Active Alarms</span>
                    <span className={`font-bold ${selectedArea.equipment.some(e => e.alarm_count > 0) ? 'text-red-600' : 'text-slate-900'}`}>
                      {selectedArea.equipment.reduce((acc, eq) => acc + eq.alarm_count, 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
                <Zap size={32} className="mb-4 text-blue-200" />
                <h4 className="font-bold mb-1">Energy Profile</h4>
                <p className="text-xs text-blue-100 mb-4">Total consumption in this zone</p>
                <div className="text-3xl font-mono font-bold">4,120.5 <span className="text-lg">kWh</span></div>
              </div>
            </div>

            {/* Main: Visual Map Layout */}
            <div className="lg:col-span-3">
              <div className="bg-slate-100 dark:bg-slate-900/50 rounded-3xl p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 min-h-[600px] relative overflow-hidden">
                <div className="absolute top-4 left-4 flex items-center gap-2 text-slate-400">
                  <MapIcon size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">{selectedArea.name} FLOOR PLAN</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-8">
                  {selectedArea.equipment
                    .filter(eq => filter === 'all' || eq.alarm_count > 0)
                    .map((equipment, idx) => (
                      <motion.div
                        key={equipment.id}
                        layoutId={`eq-${equipment.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => setSelectedEquipment(equipment)}
                        role="button"
                        className={`group relative bg-white dark:bg-slate-800 rounded-2xl p-5 border-2 transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 ${
                          equipment.alarm_count > 0 
                            ? 'border-red-500 shadow-red-500/10' 
                            : 'border-white dark:border-slate-800 shadow-sm hover:border-blue-400'
                        }`}
                      >
                        {equipment.alarm_count > 0 && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce shadow-lg">
                            {equipment.alarm_count}
                          </div>
                        )}

                        <div className="flex items-center gap-3 mb-4">
                          <div className={`p-2 rounded-lg ${
                            equipment.alarm_count > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-blue-50 dark:bg-blue-900/30'
                          }`}>
                            <Box size={20} className={equipment.alarm_count > 0 ? 'text-red-600' : 'text-blue-600'} />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                              {equipment.name}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-mono">{equipment.code}</p>
                          </div>
                        </div>

                        {equipment.primary_tag_name && (
                          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 mb-3 border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] text-slate-400 uppercase tracking-tight">{equipment.primary_tag_name}</span>
                              <Activity size={12} className="text-emerald-500" />
                            </div>
                            <div className="text-xl font-mono font-bold text-slate-900 dark:text-white">
                              {equipment.current_value?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-auto">
                          <div className={`h-2 w-2 rounded-full ${
                            equipment.alarm_count > 0 ? 'bg-red-600 animate-pulse' : 'bg-emerald-500'
                          }`} />
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Details</span>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
                        </div>
                      </motion.div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Equipment Detail Modal */}
        {selectedEquipment && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 cursor-pointer"
            onClick={() => setSelectedEquipment(null)}
            role="button"
            aria-label="Close equipment details"
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{selectedEquipment.name}</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {selectedEquipment.code}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEquipment(null)}
                  className="text-xl text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {selectedEquipment.primary_tag_name && (
                  <div>
                    <h3 className="font-semibold mb-2">Current Reading</h3>
                    <div className="bg-slate-100 dark:bg-slate-700 rounded p-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {selectedEquipment.primary_tag_name}
                      </p>
                      <p className="text-3xl font-mono font-bold">
                        {selectedEquipment.current_value !== null
                          ? selectedEquipment.current_value.toFixed(2)
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2">Status</h3>
                  <div
                    className="px-4 py-2 rounded text-white font-semibold"
                    style={{ backgroundColor: getStatusColor(selectedEquipment.alarm_count) }}
                  >
                    {getStatusLabel(selectedEquipment.alarm_count)}
                  </div>
                </div>

                {selectedEquipment.alarm_count > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                    <p className="text-sm text-red-800 dark:text-red-300">
                      <AlertCircle className="inline mr-2" size={16} />
                      {selectedEquipment.alarm_count} active alarm{selectedEquipment.alarm_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
