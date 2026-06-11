"use client";
import { useEffect, useState } from 'react';
import { Building2, Activity, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { operationsApi, type EquipmentHealth } from '@/lib/api';

export default function AssetsPage() {
  const [assets, setAssets] = useState<EquipmentHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<EquipmentHealth | null>(null);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await operationsApi.getEquipmentHealth();
        setAssets(res.data);
      } catch (err) {
        console.error('Failed to load asset health:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, []);

  const healthScore = (asset: EquipmentHealth) => parseFloat(asset.health_score);
  const healthColor = (score: number) => score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';
  const healthBg = (score: number) => score >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/20' : score >= 50 ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-red-100 dark:bg-red-900/20';

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Asset Management</h1>
          <p className="text-slate-600 dark:text-slate-300">Inspect asset health scores, maintenance readiness, and inspection schedules.</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Activity className="animate-spin text-blue-600" size={48} />
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-slate-500 dark:text-slate-400 shadow-sm">
            No equipment health records found. Create equipment in the admin panel to track asset health.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              {assets.map((asset) => {
                const score = healthScore(asset);
                return (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className={`text-left rounded-3xl border p-6 shadow-sm transition-all hover:border-blue-400 ${selectedAsset?.id === asset.id ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-slate-200 dark:border-slate-800'} bg-white dark:bg-slate-900`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{asset.equipment_name}</p>
                        <h2 className={`text-xl font-semibold ${healthColor(score)}`}>Health {score}%</h2>
                      </div>
                      <span className={`rounded-full p-2 ${healthBg(score)}`}>
                        {score >= 80 ? <CheckCircle size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-amber-600" />}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-4">
                      <div className={`h-2 rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
                    </div>
                    <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Last inspection</span>
                        <span className="text-slate-900 dark:text-white">{asset.last_inspection_at ? new Date(asset.last_inspection_at).toLocaleDateString() : 'Never'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Next due</span>
                        <span className="text-slate-900 dark:text-white">{asset.next_due_at ? new Date(asset.next_due_at).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <aside className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm h-fit sticky top-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Asset Details</h2>
              {selectedAsset ? (
                <div className="space-y-4">
                  <div className="rounded-3xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Equipment</p>
                    <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">{selectedAsset.equipment_name}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-3xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Health</p>
                      <p className={`text-xl font-semibold ${healthColor(healthScore(selectedAsset))}`}>{healthScore(selectedAsset)}%</p>
                    </div>
                    <div className="rounded-3xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Condition</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedAsset.condition || 'No data'}</p>
                    </div>
                  </div>
                  {selectedAsset.recommended_action && (
                    <div className="rounded-3xl bg-amber-50 dark:bg-amber-900/10 p-4 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-600 mb-1">Recommended Action</p>
                      <p className="text-sm text-amber-800 dark:text-amber-200">{selectedAsset.recommended_action}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">Select an asset to view detailed health information.</p>
              )}
            </aside>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
