"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ClipboardList, Activity, Gauge, Building2, Bell } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { operationsApi, MaintenanceTask, PlantOverviewArea } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function OperationsPage() {
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [plantAreas, setPlantAreas] = useState<PlantOverviewArea[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const [maintenanceRes, plantRes] = await Promise.all([
          operationsApi.getMaintenanceTasks(),
          operationsApi.getPlantOverview(),
        ]);

        setMaintenanceTasks(maintenanceRes.data.slice(0, 4));
        setPlantAreas(plantRes.data.areas || []);
      } catch (err) {
        console.error('Failed to load operations data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, []);

  const totalEquipment = plantAreas.reduce((acc, area) => acc + area.equipment.length, 0);
  const totalAlarmCount = plantAreas.reduce(
    (acc, area) => acc + area.equipment.reduce((areaSum, eq) => areaSum + (eq.alarm_count ?? 0), 0),
    0,
  );
  const overdueTasks = maintenanceTasks.filter(
    (task) => {
      const dueDate = task.planned_start || task.scheduled_for;
      return dueDate && new Date(dueDate).getTime() < Date.now() && task.status.toLowerCase() !== 'completed';
    },
  ).length;

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Operations Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-300">Fast access to asset health, maintenance planning, and water quality insights.</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Activity className="animate-spin text-blue-600" size={48} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <SummaryTile title="Plant Zones" value={plantAreas.length.toString()} icon={<Building2 size={20} />} description="Operational process areas monitored." />
              <SummaryTile title="Equipment Units" value={totalEquipment.toString()} icon={<Gauge size={20} />} description="Assets under active monitoring." />
              <SummaryTile title="Open Alarms" value={totalAlarmCount.toString()} icon={<Bell size={20} />} description="Current alarm conditions." />
              <SummaryTile title="Overdue Tasks" value={overdueTasks.toString()} icon={<ClipboardList size={20} />} description="Recent maintenance actions pending." />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <section className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Plant Overview Snapshot</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Live operational metrics across all areas.</p>
                  </div>
                  <button onClick={() => router.push('/dashboard/plant-overview')} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800">
                    View plant map
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {plantAreas.map((area) => (
                    <div key={area.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{area.name}</p>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{area.equipment.length} units</span>
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {area.equipment.filter((eq) => (eq.alarm_count ?? 0) > 0).length} with active alarms
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <ActionCard title="Plant Overview" description="Open the live plant map and equipment status." href="/dashboard/plant-overview" />
                  <ActionCard title="Maintenance" description="Review and assign work orders." href="/dashboard/maintenance" />
                  <ActionCard title="Quality" description="Inspect recent quality readings." href="/dashboard/quality" />
                </div>
              </section>
            </div>

            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Maintenance Task Watchlist</h2>
                <button onClick={() => router.push('/dashboard/maintenance')} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                  See all tasks
                </button>
              </div>
              <div className="space-y-4">
                {maintenanceTasks.length === 0 ? (
                  <div className="text-slate-500">No tasks found.</div>
                ) : (
                  maintenanceTasks.map((task) => (
                    <div key={task.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{task.title}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Assigned to {task.assigned_to}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTaskBadge(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-400">
                        <span>Priority: {task.priority}</span>
                        <span>Scheduled {new Date(task.planned_start || task.scheduled_for || task.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{task.description}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function getTaskBadge(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('complete') || normalized.includes('done')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
  if (normalized.includes('pending') || normalized.includes('open')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  if (normalized.includes('overdue') || normalized.includes('late')) return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function SummaryTile({ title, value, icon, description }: { title: string; value: string; icon: ReactNode; description: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
        <div className="rounded-2xl bg-slate-100 dark:bg-slate-950 p-3 text-blue-600 dark:text-blue-400">{icon}</div>
      </div>
      <p className="text-4xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function ActionCard({ title, description, href }: { title: string; description: string; href: string }) {
  const router = useRouter();
  return (
    <button onClick={() => router.push(href)} className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-left hover:border-blue-400 transition-colors">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
        <ArrowRight size={16} className="text-blue-600" />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </button>
  );
}
